import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import {
  deriveX25519PublicKeyBase64,
  generateX25519DeviceKeyMaterial,
  getDefaultWebDeviceName,
} from '../../../shared/utils/e2eeDeviceCrypto'

export class SsoE2eeBootstrapUseCase {
  private readonly authRepository: AuthRepository
  private readonly sessionStore: AuthSessionStore
  private readonly keyStore: IndexedDbKeyStore
  private readonly webDeviceSessionStore: WebDeviceSessionStore

  constructor(
    authRepository: AuthRepository,
    sessionStore: AuthSessionStore,
    keyStore: IndexedDbKeyStore,
    webDeviceSessionStore: WebDeviceSessionStore,
  ) {
    this.authRepository = authRepository
    this.sessionStore = sessionStore
    this.keyStore = keyStore
    this.webDeviceSessionStore = webDeviceSessionStore
  }

  async execute(): Promise<void> {
    const tokens = this.sessionStore.getTokens()
    if (!tokens) return

    try {
      // 1. Identify current user
      const currentUser = await this.authRepository.me(tokens.accessToken)
      
      // 2. Resolve or generate device ID
      const initialDeviceId = this.webDeviceSessionStore.getOrCreateCurrentDeviceId()
      
      // 3. Resolve or generate local key material (scoped to user)
      const initialDeviceStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, initialDeviceId)
      
      let deviceId = initialDeviceId
      let deviceStorageKey = initialDeviceStorageKey
      let keyMaterial = await this.resolveStoredDeviceKeys(deviceStorageKey)
      
      if (!keyMaterial) {
        // Fallback to fresh keys if missing
        const generated = await generateX25519DeviceKeyMaterial(deviceId)
        keyMaterial = {
          privateKey: generated.privateKey,
          publicKey: generated.publicKey,
        }
        await this.keyStore.saveDeviceKeyMaterial(deviceStorageKey, keyMaterial.privateKey, keyMaterial.publicKey)
      }

      // 4. Explicitly register this device on the server
      // This ensures that senders can see this web device and encrypt messages for it.
      const registration = await this.authRepository.registerWebDevice(
        {
          deviceId,
          publicKey: keyMaterial.publicKey,
          deviceName: getDefaultWebDeviceName(),
          platform: 'web',
          replaceOtherWebSessions: false,
          includeBackup: false, // We don't have password context in SSO callback
        },
        tokens.accessToken,
      )

      // 5. Update session state with potentially enriched tokens (with device claims)
      this.sessionStore.setTokens(registration.tokens)

      // 6. Handle device ID normalization from server
      if (registration.deviceId && registration.deviceId !== deviceId) {
        deviceId = registration.deviceId
        deviceStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, registration.deviceId)
        await this.keyStore.saveDeviceKeyMaterial(deviceStorageKey, keyMaterial.privateKey, keyMaterial.publicKey)
      }

      this.webDeviceSessionStore.setCurrentDeviceId(deviceId)
    } catch (error) {
      console.warn('[SSO E2EE Bootstrap] Failed to bootstrap E2EE during SSO callback:', error)
      // We don't throw here to allow user to reach the dashboard, 
      // but they will have limited E2EE access (same as before).
    }
  }

  private async resolveStoredDeviceKeys(storageKey: string): Promise<{ privateKey: string; publicKey: string } | null> {
    const stored = await this.keyStore.getDeviceKeyMaterial(storageKey)
    if (!stored?.privateKey) {
      return null
    }

    if (stored.publicKey) {
      return {
        privateKey: stored.privateKey,
        publicKey: stored.publicKey,
      }
    }

    try {
      const derivedPublicKey = await deriveX25519PublicKeyBase64(stored.privateKey)
      await this.keyStore.saveDeviceKeyMaterial(storageKey, stored.privateKey, derivedPublicKey)
      return {
        privateKey: stored.privateKey,
        publicKey: derivedPublicKey,
      }
    } catch {
      return null
    }
  }
}
