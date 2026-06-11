import type { AuthTokens } from '../../domain/entities/AuthTokens'
import type { CurrentUser } from '../../domain/entities/CurrentUser'
import type {
  CurrentLoginSnapshot,
  E2eeKeyBackup,
  RegisteredWebUser,
  RegisterWebDeviceInput,
  RegisterWebDeviceResult,
  SaveE2eeKeyBackupInput,
} from '../../domain/entities/WebE2eeBootstrap'
import type { AuthRepository } from '../../domain/repositories/AuthRepository'
import { dispatchAuthSessionExpired } from '../../shared/auth/authSessionEvents'
import { parseHttpError } from '../http/HttpError'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'
import { WebDeviceSessionStore } from '../storage/WebDeviceSessionStore'

interface LoginRequest {
  identifier: string
  password: string
}

interface RefreshRequest {
  refresh_token?: string
}

interface AuthResponseDto {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  expires_at: string
  must_change_password?: boolean
}

interface E2eeBackupDto {
  user_id: number
  encrypted_private_key: string
  salt: string
  iv: string
  kdf_algorithm: string
  kdf_params?: {
    iterations?: number
    hash?: string
    key_length?: number
    memory?: number
    memory_kib?: number
    parallelism?: number
    passes?: number
  } | null
  version: number
  backup_key_type?: string | null
  backup_key_format?: string | null
  backup_key_scope?: string | null
  backup_format_version?: number | null
  cipher_algorithm?: string | null
  cipher_tag_embedded?: boolean | null
  aad_mode?: string | null
  password_processing?: string | null
  created_at?: string
  updated_at?: string
}

interface RegisterWebDeviceRequestDto {
  device_id: string
  public_key: string
  device_name: string
  platform: 'web'
  replace_other_web_sessions: boolean
  include_backup: boolean
}

interface SaveE2eeBackupRequestDto {
  encrypted_private_key: string
  salt: string
  iv: string
  kdf_algorithm: string
  kdf_params: {
    iterations?: number
    hash?: string
    key_length?: number
    memory?: number
    memory_kib?: number
    parallelism?: number
    passes?: number
  }
  version: number
  backup_key_type: string
  backup_key_format: string
  backup_key_scope: string
  backup_format_version: number
  cipher_algorithm: string
  cipher_tag_embedded: boolean
  aad_mode: string
  password_processing: string
}

interface RegisteredWebUserDto {
  id: number
  email?: string
  username?: string
  first_name?: string
  last_name?: string
}

interface CurrentLoginSnapshotDto {
  ip?: string
  country?: string
  city?: string
  user_agent?: string
}

interface RegisterWebDeviceResponseDto extends AuthResponseDto {
  device_id: string
  message: string
  has_backup?: boolean
  backup_algo?: string | null
  backup?: E2eeBackupDto | null
  user?: RegisteredWebUserDto | null
  current_login?: CurrentLoginSnapshotDto | null
  revoked_device_ids?: string[] | null
  replace_other_web_sessions?: boolean
}

interface MeResponseDto {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  full_name: string
  full_name_local: string
  role: string
  avatar_url: string
  position: string
  is_active: boolean
  is_first_login: boolean
  availability_status: string
}

const toAuthTokens = (dto: AuthResponseDto): AuthTokens => ({
  accessToken: dto.access_token,
  refreshToken: dto.refresh_token,
  tokenType: dto.token_type,
  expiresIn: dto.expires_in,
  expiresAt: dto.expires_at,
  mustChangePassword: dto.must_change_password,
})

const toE2eeKeyBackup = (dto: E2eeBackupDto): E2eeKeyBackup => ({
  userId: dto.user_id,
  encryptedPrivateKey: dto.encrypted_private_key,
  salt: dto.salt,
  iv: dto.iv,
  kdfAlgorithm: dto.kdf_algorithm,
  kdfParams: dto.kdf_params
    ? {
        iterations: dto.kdf_params.iterations,
        hash: dto.kdf_params.hash,
        keyLength: dto.kdf_params.key_length,
        memory: dto.kdf_params.memory,
        memoryKiB: dto.kdf_params.memory_kib,
        parallelism: dto.kdf_params.parallelism,
        passes: dto.kdf_params.passes,
      }
    : null,
  version: dto.version ?? 1,
  backupKeyType: dto.backup_key_type ?? null,
  backupKeyFormat: dto.backup_key_format ?? null,
  backupKeyScope: dto.backup_key_scope ?? null,
  backupFormatVersion: dto.backup_format_version ?? null,
  cipherAlgorithm: dto.cipher_algorithm ?? null,
  cipherTagEmbedded: dto.cipher_tag_embedded ?? null,
  aadMode: dto.aad_mode ?? null,
  passwordProcessing: dto.password_processing ?? null,
  createdAt: dto.created_at ?? '',
  updatedAt: dto.updated_at ?? '',
})

const toRegisteredWebUser = (dto: RegisteredWebUserDto): RegisteredWebUser => ({
  id: dto.id,
  email: dto.email ?? '',
  username: dto.username ?? '',
  firstName: dto.first_name ?? '',
  lastName: dto.last_name ?? '',
})

const toCurrentLoginSnapshot = (dto: CurrentLoginSnapshotDto): CurrentLoginSnapshot => ({
  ip: dto.ip ?? '',
  country: dto.country ?? '',
  city: dto.city ?? '',
  userAgent: dto.user_agent ?? '',
})

const toCurrentUser = (dto: MeResponseDto): CurrentUser => ({
  id: dto.id,
  email: dto.email ?? '',
  username: dto.username ?? '',
  firstName: dto.first_name ?? '',
  lastName: dto.last_name ?? '',
  fullName: dto.full_name ?? '',
  fullNameLocal: dto.full_name_local ?? '',
  role: dto.role ?? '',
  avatarUrl: normalizeBackendAssetUrl(dto.avatar_url) ?? '',
  position: dto.position ?? '',
  isActive: dto.is_active ?? false,
  isFirstLogin: dto.is_first_login ?? false,
  availabilityStatus: dto.availability_status ?? '',
})

export class HttpAuthRepository implements AuthRepository {
  private readonly webDeviceSessionStore = new WebDeviceSessionStore()

  async login(identifier: string, password: string): Promise<AuthTokens> {
    const body: LoginRequest = { identifier, password }

    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw await parseHttpError(response)
    }

    const data = (await response.json()) as AuthResponseDto
    return toAuthTokens(data)
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const body: RefreshRequest = refreshToken ? { refresh_token: refreshToken } : {}

    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw await parseHttpError(response)
    }

    const data = (await response.json()) as AuthResponseDto
    return toAuthTokens(data)
  }

  async logout(refreshToken: string): Promise<void> {
    const body: RefreshRequest = refreshToken ? { refresh_token: refreshToken } : {}

    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw await parseHttpError(response)
    }
  }

  async me(_accessToken?: string): Promise<CurrentUser> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    const currentDeviceId = this.webDeviceSessionStore.getCurrentDeviceId()

    if (currentDeviceId) {
      headers['X-Web-Device-ID'] = currentDeviceId
    }

    const response = await fetch('/api/v1/auth/me', {
      method: 'GET',
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        dispatchAuthSessionExpired({ reason: 'unauthorized' })
      }
      throw await parseHttpError(response)
    }

    const data = (await response.json()) as MeResponseDto
    return toCurrentUser(data)
  }

  async getE2eeBackup(_accessToken?: string): Promise<E2eeKeyBackup | null> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    const currentDeviceId = this.webDeviceSessionStore.getCurrentDeviceId()

    if (currentDeviceId) {
      headers['X-Web-Device-ID'] = currentDeviceId
    }

    const response = await fetch('/api/v1/e2ee/backup', {
      method: 'GET',
      headers,
      credentials: 'include',
    })

    if (response.status === 204) {
      return null
    }

    if (!response.ok) {
      if (response.status === 401) {
        dispatchAuthSessionExpired({ reason: 'unauthorized' })
      }
      throw await parseHttpError(response)
    }

    return toE2eeKeyBackup((await response.json()) as E2eeBackupDto)
  }

  async saveE2eeBackup(input: SaveE2eeKeyBackupInput, _accessToken: string): Promise<void> {
    const body: SaveE2eeBackupRequestDto = {
      encrypted_private_key: input.encryptedPrivateKey,
      salt: input.salt,
      iv: input.iv,
      kdf_algorithm: input.kdfAlgorithm,
      kdf_params: {
        iterations: input.kdfParams.iterations,
        hash: input.kdfParams.hash,
        key_length: input.kdfParams.keyLength,
        memory: input.kdfParams.memory,
        memory_kib: input.kdfParams.memoryKiB,
        parallelism: input.kdfParams.parallelism,
        passes: input.kdfParams.passes,
      },
      version: input.version,
      backup_key_type: input.backupKeyType,
      backup_key_format: input.backupKeyFormat,
      backup_key_scope: input.backupKeyScope,
      backup_format_version: input.backupFormatVersion,
      cipher_algorithm: input.cipherAlgorithm,
      cipher_tag_embedded: input.cipherTagEmbedded,
      aad_mode: input.aadMode,
      password_processing: input.passwordProcessing,
    }

    const response = await fetch('/api/v1/e2ee/backup', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      if (response.status === 401) {
        dispatchAuthSessionExpired({ reason: 'unauthorized' })
      }
      throw await parseHttpError(response)
    }
  }

  async registerWebDevice(input: RegisterWebDeviceInput, _accessToken: string): Promise<RegisterWebDeviceResult> {
    const body: RegisterWebDeviceRequestDto = {
      device_id: input.deviceId,
      public_key: input.publicKey,
      device_name: input.deviceName,
      platform: input.platform,
      replace_other_web_sessions: input.replaceOtherWebSessions,
      include_backup: input.includeBackup,
    }

    const response = await fetch('/api/v1/e2ee/device/register', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Web-Device-ID': input.deviceId,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      if (response.status === 401) {
        dispatchAuthSessionExpired({ reason: 'unauthorized' })
      }
      throw await parseHttpError(response)
    }

    const data = (await response.json()) as RegisterWebDeviceResponseDto
    const deviceId = data.device_id || input.deviceId
    this.webDeviceSessionStore.setCurrentDeviceId(deviceId)

    return {
      deviceId,
      message: data.message ?? '',
      hasBackup: Boolean(data.has_backup),
      backupAlgo: data.backup_algo ?? null,
      backup: data.backup ? toE2eeKeyBackup(data.backup) : null,
      user: data.user ? toRegisteredWebUser(data.user) : null,
      currentLogin: data.current_login ? toCurrentLoginSnapshot(data.current_login) : null,
      revokedDeviceIds: data.revoked_device_ids ?? [],
      replaceOtherWebSessions: data.replace_other_web_sessions ?? input.replaceOtherWebSessions,
      tokens: toAuthTokens(data),
    }
  }

  async completeOnboarding(): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    const currentDeviceId = this.webDeviceSessionStore.getCurrentDeviceId()

    if (currentDeviceId) {
      headers['X-Web-Device-ID'] = currentDeviceId
    }

    const response = await fetch('/api/v1/auth/onboarding/complete', {
      method: 'POST',
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        dispatchAuthSessionExpired({ reason: 'unauthorized' })
      }
      throw await parseHttpError(response)
    }
  }
}
