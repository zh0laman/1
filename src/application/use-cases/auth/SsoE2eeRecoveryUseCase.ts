import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import { restorePrivateKeyFromBackup } from '../../../shared/utils/e2eeBackupCrypto'
import { getDefaultWebDeviceName } from '../../../shared/utils/e2eeDeviceCrypto'

export class SsoE2eeRecoveryUseCase {
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

  async execute(masterPassword: string): Promise<void> {
    const tokens = this.sessionStore.getTokens()
    if (!tokens) throw new Error('Сессия истекла')

    const currentUser = await this.authRepository.me(tokens.accessToken)
    const backup = await this.authRepository.getE2eeBackup(tokens.accessToken)
    if (!backup) throw new Error('Резервная копия ключей не найдена на сервере')

    // 1. Восстанавливаем приватный ключ из бэкапа с помощью введенного пароля
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

    // 2. Сохраняем восстановленные ключи локально
    const deviceId = this.webDeviceSessionStore.getOrCreateCurrentDeviceId()
    const storageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, deviceId)

    await this.keyStore.saveDeviceKeyMaterial(
      storageKey,
      restored.privateKeyBase64,
      restored.publicKeyBase64,
    )

    // 3. Перерегистрируем устройство с восстановленным публичным ключом
    const registration = await this.authRepository.registerWebDevice(
      {
        deviceId,
        publicKey: restored.publicKeyBase64,
        deviceName: getDefaultWebDeviceName(),
        platform: 'web',
        replaceOtherWebSessions: false,
        includeBackup: false,
      },
      tokens.accessToken,
    )

    // 4. Обновляем токены и ID устройства, если сервер их нормализовал
    this.sessionStore.setTokens(registration.tokens)
    
    if (registration.deviceId && registration.deviceId !== deviceId) {
      const nextStorageKey = IndexedDbKeyStore.buildScopedStorageKey(currentUser.id, registration.deviceId)
      await this.keyStore.saveDeviceKeyMaterial(
        nextStorageKey,
        restored.privateKeyBase64,
        restored.publicKeyBase64,
      )
      this.webDeviceSessionStore.setCurrentDeviceId(registration.deviceId)
    }
  }
}
