import type { AuthTokens } from './AuthTokens'

export interface E2eeBackupKdfParams {
  iterations?: number
  hash?: string
  keyLength?: number
  memory?: number
  memoryKiB?: number
  parallelism?: number
  passes?: number
}

export interface E2eeKeyBackup {
  userId: number
  encryptedPrivateKey: string
  salt: string
  iv: string
  kdfAlgorithm: string
  kdfParams: E2eeBackupKdfParams | null
  version: number
  backupKeyType: string | null
  backupKeyFormat: string | null
  backupKeyScope: string | null
  backupFormatVersion: number | null
  cipherAlgorithm: string | null
  cipherTagEmbedded: boolean | null
  aadMode: string | null
  passwordProcessing: string | null
  createdAt: string
  updatedAt: string
}

export interface RegisterWebDeviceInput {
  deviceId: string
  publicKey: string
  deviceName: string
  platform: 'web'
  replaceOtherWebSessions: boolean
  includeBackup: boolean
}

export interface SaveE2eeKeyBackupInput {
  encryptedPrivateKey: string
  salt: string
  iv: string
  kdfAlgorithm: string
  kdfParams: E2eeBackupKdfParams
  version: number
  backupKeyType: string
  backupKeyFormat: string
  backupKeyScope: string
  backupFormatVersion: number
  cipherAlgorithm: string
  cipherTagEmbedded: boolean
  aadMode: string
  passwordProcessing: string
}

export interface RegisteredWebUser {
  id: number
  email: string
  username: string
  firstName: string
  lastName: string
}

export interface CurrentLoginSnapshot {
  ip: string
  country: string
  city: string
  userAgent: string
}

export interface RegisterWebDeviceResult {
  deviceId: string
  message: string
  hasBackup: boolean
  backupAlgo: string | null
  backup: E2eeKeyBackup | null
  user: RegisteredWebUser | null
  currentLogin: CurrentLoginSnapshot | null
  revokedDeviceIds: string[]
  replaceOtherWebSessions: boolean
  tokens: AuthTokens
}
