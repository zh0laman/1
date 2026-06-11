import { createCanonicalE2eeBackup, restorePrivateKeyFromBackup } from '../../../shared/utils/e2eeBackupCrypto'
import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export interface SyncMyE2eeBackupResult {
  backupSynced: boolean
  keySource: 'local' | 'backup'
  hadExistingBackup: boolean
}

export class SyncMyE2eeBackupUseCase {
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

  async execute(masterPassword: string): Promise<SyncMyE2eeBackupResult> {
    const tokens = this.sessionStore.getTokens()
    if (!tokens?.accessToken) {
      throw new Error('Не удалось обновить резервную копию: в текущей web-сессии нет access token.')
    }

    const deviceId = this.webDeviceSessionStore.getCurrentDeviceId()
    if (!deviceId) {
      throw new Error('Не удалось обновить резервную копию: не найден текущий web device id.')
    }

    const currentUser = await this.authRepository.me(tokens.accessToken)
    const scopedDeviceStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, deviceId)
    const existingBackup = await this.authRepository.getE2eeBackup(tokens.accessToken)

    const resolved = await this.resolveDeviceKeyMaterial(
      scopedDeviceStorageKey,
      deviceId,
      masterPassword,
      tokens.accessToken,
      existingBackup,
    )

    const backupPayload = await createCanonicalE2eeBackup({
      privateKeyBase64: resolved.privateKey,
      masterPassword,
    })

    await this.authRepository.saveE2eeBackup(backupPayload, tokens.accessToken)

    return {
      backupSynced: true,
      keySource: resolved.keySource,
      hadExistingBackup: Boolean(existingBackup),
    }
  }

  private async resolveDeviceKeyMaterial(
    scopedDeviceStorageKey: string,
    legacyDeviceId: string,
    masterPassword: string,
    accessToken: string,
    existingBackup: Awaited<ReturnType<AuthRepository['getE2eeBackup']>>,
  ): Promise<{ privateKey: string; publicKey: string | null; keySource: 'local' | 'backup' }> {
    const scopedKeyMaterial = await this.keyStore.getDeviceKeyMaterial(scopedDeviceStorageKey)
    if (scopedKeyMaterial?.privateKey) {
      return {
        ...scopedKeyMaterial,
        keySource: 'local',
      }
    }

    const legacyKeyMaterial = await this.keyStore.getDeviceKeyMaterial(legacyDeviceId)
    if (legacyKeyMaterial?.privateKey) {
      await this.keyStore.saveDeviceKeyMaterial(
        scopedDeviceStorageKey,
        legacyKeyMaterial.privateKey,
        legacyKeyMaterial.publicKey ?? undefined,
      )

      return {
        ...legacyKeyMaterial,
        keySource: 'local',
      }
    }

    const backup = existingBackup ?? (await this.authRepository.getE2eeBackup(accessToken))
    if (!backup) {
      throw new Error('Локальный ключ и резервная копия не найдены. Войдите через password login или используйте QR linked-device flow.')
    }

    const restored = await restorePrivateKeyFromBackup({
      encryptedPrivateKey: backup.encryptedPrivateKey,
      salt: backup.salt,
      iv: backup.iv,
      kdfAlgorithm: backup.kdfAlgorithm,
      kdfParams: backup.kdfParams,
      backupKeyType: backup.backupKeyType,
      backupKeyFormat: backup.backupKeyFormat,
      backupKeyScope: backup.backupKeyScope,
      backupFormatVersion: backup.backupFormatVersion,
      cipherAlgorithm: backup.cipherAlgorithm,
      cipherTagEmbedded: backup.cipherTagEmbedded,
      aadMode: backup.aadMode,
      passwordProcessing: backup.passwordProcessing,
      masterPassword,
      version: backup.version,
    })

    const restoredKeyMaterial = {
      privateKey: restored.privateKeyBase64,
      publicKey: restored.publicKeyBase64,
    }

    await this.keyStore.saveDeviceKeyMaterial(
      scopedDeviceStorageKey,
      restoredKeyMaterial.privateKey,
      restoredKeyMaterial.publicKey,
    )

    return {
      ...restoredKeyMaterial,
      keySource: 'backup',
    }
  }
}
