import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'
import type {
  CurrentLoginSnapshot,
  E2eeKeyBackup,
  RegisterWebDeviceResult,
} from '../../../domain/entities/WebE2eeBootstrap'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import {
  deriveX25519PublicKeyBase64,
  generateX25519DeviceKeyMaterial,
  getDefaultWebDeviceName,
} from '../../../shared/utils/e2eeDeviceCrypto'
import { createCanonicalE2eeBackup, restorePrivateKeyFromBackup } from '../../../shared/utils/e2eeBackupCrypto'

interface DeviceKeyMaterial {
  privateKey: string
  publicKey: string
}

export type PasswordLoginDeviceKeySource = 'stored' | 'backup' | 'generated'
export type PasswordLoginBackupPasswordSource = 'login' | 'override'

export interface PasswordLoginWithE2eeBootstrapInput {
  identifier: string
  password: string
  restoreHistory?: boolean
  masterPassword?: string
  replaceOtherWebSessions?: boolean
  includeBackup?: boolean
  onProgress?: (message: string) => void
}

export interface PasswordLoginWithE2eeBootstrapResult {
  registration: RegisterWebDeviceResult
  deviceId: string
  currentLogin: CurrentLoginSnapshot | null
  restoredFromBackup: boolean
  deviceKeySource: PasswordLoginDeviceKeySource
  backup: E2eeKeyBackup | null
  backupMissingFallback: boolean
  backupCreated: boolean
  backupCreationError: string | null
  backupPasswordSource: PasswordLoginBackupPasswordSource
  mustChangePassword: boolean
}

export class PasswordLoginWithE2eeBootstrapUseCase {
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

  async execute(input: PasswordLoginWithE2eeBootstrapInput): Promise<PasswordLoginWithE2eeBootstrapResult> {
    const replaceOtherWebSessions = input.replaceOtherWebSessions ?? false
    const restoreHistory = input.restoreHistory ?? false
    const includeBackup = input.includeBackup ?? !restoreHistory
    const hasBackupPasswordOverride = (input.masterPassword ?? '').trim().length > 0
    const backupPassword = hasBackupPasswordOverride ? (input.masterPassword ?? '') : input.password
    const backupPasswordSource: PasswordLoginBackupPasswordSource = hasBackupPasswordOverride ? 'override' : 'login'

    input.onProgress?.('Проверяем учетные данные...')

    try {
      const bootstrapTokens = await this.authRepository.login(input.identifier, input.password)
      this.sessionStore.setTokens(bootstrapTokens)
      const currentUser = await this.authRepository.me(bootstrapTokens.accessToken)

      const initialDeviceId = this.webDeviceSessionStore.getOrCreateCurrentDeviceId()
      const initialDeviceStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, initialDeviceId)
      let deviceId = initialDeviceId
      let deviceStorageKey = initialDeviceStorageKey
      let keyMaterial = await this.resolveStoredDeviceKeys(deviceStorageKey)
      let deviceKeySource: PasswordLoginDeviceKeySource = keyMaterial ? 'stored' : 'generated'
      let restoredFromBackup = false
      let usedBackup: E2eeKeyBackup | null = null
      let backupMissingFallback = false
      let shouldCreateBackupAfterRegistration = false

      if (restoreHistory) {
        input.onProgress?.(
          keyMaterial
            ? 'Нашли локальный identity key. Проверяем recovery backup...'
            : 'Проверяем recovery backup...',
        )
        usedBackup = await this.authRepository.getE2eeBackup(bootstrapTokens.accessToken)

        if (!usedBackup) {
          shouldCreateBackupAfterRegistration = true

          if (!keyMaterial) {
            backupMissingFallback = true
            input.onProgress?.('Recovery backup не найден. Продолжаем вход как новое web-устройство...')
          } else {
            input.onProgress?.('Recovery backup не найден. После входа создадим новый backup из локального ключа...')
          }
        } else if (!keyMaterial) {
          input.onProgress?.('Восстанавливаем identity key из recovery backup...')
          const restored = await restorePrivateKeyFromBackup({
            encryptedPrivateKey: usedBackup.encryptedPrivateKey,
            salt: usedBackup.salt,
            iv: usedBackup.iv,
            kdfAlgorithm: usedBackup.kdfAlgorithm,
            kdfParams: usedBackup.kdfParams,
            backupKeyType: usedBackup.backupKeyType,
            backupKeyFormat: usedBackup.backupKeyFormat,
            backupKeyScope: usedBackup.backupKeyScope,
            backupFormatVersion: usedBackup.backupFormatVersion,
            cipherAlgorithm: usedBackup.cipherAlgorithm,
            cipherTagEmbedded: usedBackup.cipherTagEmbedded,
            aadMode: usedBackup.aadMode,
            passwordProcessing: usedBackup.passwordProcessing,
            masterPassword: backupPassword,
            version: usedBackup.version,
          })

          keyMaterial = {
            privateKey: restored.privateKeyBase64,
            publicKey: restored.publicKeyBase64,
          }
          await this.keyStore.saveDeviceKeyMaterial(deviceStorageKey, keyMaterial.privateKey, keyMaterial.publicKey)
          restoredFromBackup = true
          deviceKeySource = 'backup'
        } else {
          input.onProgress?.('Используем уже сохраненный identity key этого браузера.')
        }
      }

      if (!keyMaterial) {
        input.onProgress?.('Генерируем ключи устройства...')
        const generated = await generateX25519DeviceKeyMaterial(deviceId)
        keyMaterial = {
          privateKey: generated.privateKey,
          publicKey: generated.publicKey,
        }
        await this.keyStore.saveDeviceKeyMaterial(deviceStorageKey, keyMaterial.privateKey, keyMaterial.publicKey)
        deviceKeySource = 'generated'
      }

      input.onProgress?.('Регистрируем защищенную web-сессию...')
      const registration = await this.authRepository.registerWebDevice(
        {
          deviceId,
          publicKey: keyMaterial.publicKey,
          deviceName: getDefaultWebDeviceName(),
          platform: 'web',
          replaceOtherWebSessions,
          includeBackup: restoredFromBackup ? false : includeBackup,
        },
        bootstrapTokens.accessToken,
      )

      this.sessionStore.setTokens(registration.tokens)

      if (registration.deviceId && registration.deviceId !== deviceId) {
        deviceId = registration.deviceId
        deviceStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, registration.deviceId)
        await this.keyStore.saveDeviceKeyMaterial(deviceStorageKey, keyMaterial.privateKey, keyMaterial.publicKey)
      }

      this.webDeviceSessionStore.setCurrentDeviceId(deviceId)

      let backupCreated = false
      let backupCreationError: string | null = null

      if (shouldCreateBackupAfterRegistration) {
        input.onProgress?.('Сохраняем recovery backup...')

        try {
          const backupPayload = await createCanonicalE2eeBackup({
            privateKeyBase64: keyMaterial.privateKey,
            masterPassword: backupPassword,
          })
          await this.authRepository.saveE2eeBackup(backupPayload, registration.tokens.accessToken)
          backupCreated = true
        } catch (error) {
          backupCreationError =
            error instanceof Error ? error.message : 'Не удалось сохранить recovery backup для этого браузера.'
        }
      }

      return {
        registration,
        deviceId,
        currentLogin: registration.currentLogin,
        restoredFromBackup,
        deviceKeySource,
        backup: usedBackup ?? registration.backup,
        backupMissingFallback,
        backupCreated,
        backupCreationError,
        backupPasswordSource,
        mustChangePassword: registration.tokens.mustChangePassword ?? false,
      }
    } catch (error) {
      this.sessionStore.clearTokens()
      throw error
    }
  }

  private async resolveStoredDeviceKeys(deviceId: string): Promise<DeviceKeyMaterial | null> {
    const stored = await this.keyStore.getDeviceKeyMaterial(deviceId)
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
      await this.keyStore.saveDeviceKeyMaterial(deviceId, stored.privateKey, derivedPublicKey)
      return {
        privateKey: stored.privateKey,
        publicKey: derivedPublicKey,
      }
    } catch {
      return null
    }
  }
}
