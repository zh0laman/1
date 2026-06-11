import { createCanonicalE2eeBackup, restorePrivateKeyFromBackup } from '../../../shared/utils/e2eeBackupCrypto'
import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'
import { ChangeMyPasswordUseCase } from './ChangeMyPasswordUseCase'

export interface ChangeMyPasswordWithE2eeBackupRotationResult {
  backupRotated: boolean
  backupRotationWarning: string | null
}

export class ChangeMyPasswordWithE2eeBackupRotationUseCase {
  private readonly changeMyPasswordUseCase: ChangeMyPasswordUseCase
  private readonly authRepository: AuthRepository
  private readonly sessionStore: AuthSessionStore
  private readonly keyStore: IndexedDbKeyStore
  private readonly webDeviceSessionStore: WebDeviceSessionStore

  constructor(
    changeMyPasswordUseCase: ChangeMyPasswordUseCase,
    authRepository: AuthRepository,
    sessionStore: AuthSessionStore,
    keyStore: IndexedDbKeyStore,
    webDeviceSessionStore: WebDeviceSessionStore,
  ) {
    this.changeMyPasswordUseCase = changeMyPasswordUseCase
    this.authRepository = authRepository
    this.sessionStore = sessionStore
    this.keyStore = keyStore
    this.webDeviceSessionStore = webDeviceSessionStore
  }

  async execute(
    oldPassword: string,
    newPassword: string,
  ): Promise<ChangeMyPasswordWithE2eeBackupRotationResult> {
    const tokens = this.sessionStore.getTokens()
    if (!tokens?.accessToken) {
      throw new Error('Пароль не изменен: в текущей web-сессии нет access token для подготовки recovery backup.')
    }

    const deviceId = this.webDeviceSessionStore.getCurrentDeviceId()
    if (!deviceId) {
      throw new Error('Пароль не изменен: не найден текущий web device id для подготовки recovery backup.')
    }

    const currentUser = await this.authRepository.me(tokens.accessToken)
    const scopedDeviceStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, deviceId)
    const keyMaterial = await this.resolveDeviceKeyMaterial(scopedDeviceStorageKey, deviceId, oldPassword, tokens.accessToken)

    const backupPayload = await createCanonicalE2eeBackup({
      privateKeyBase64: keyMaterial.privateKey,
      masterPassword: newPassword,
    })

    await this.changeMyPasswordUseCase.execute(oldPassword, newPassword, backupPayload)

    return {
      backupRotated: true,
      backupRotationWarning: null,
    }
  }

  private async resolveDeviceKeyMaterial(
    scopedDeviceStorageKey: string,
    deviceId: string,
    oldPassword: string,
    accessToken: string,
  ): Promise<{ privateKey: string; publicKey: string | null }> {
    const scopedKeyMaterial = await this.keyStore.getDeviceKeyMaterial(scopedDeviceStorageKey)
    if (scopedKeyMaterial?.privateKey) {
      return scopedKeyMaterial
    }

    const legacyKeyMaterial = await this.keyStore.getDeviceKeyMaterial(deviceId)
    if (legacyKeyMaterial?.privateKey) {
      await this.keyStore.saveDeviceKeyMaterial(
        scopedDeviceStorageKey,
        legacyKeyMaterial.privateKey,
        legacyKeyMaterial.publicKey ?? undefined,
      )
      return legacyKeyMaterial
    }

    const backup = await this.authRepository.getE2eeBackup(accessToken)
    if (!backup) {
      throw new Error('Пароль не изменен: на аккаунте нет recovery backup, а в этом браузере нет локального E2EE private key.')
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
      masterPassword: oldPassword,
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
    return restoredKeyMaterial
  }
}
