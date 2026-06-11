import type { AuthTokens } from '../entities/AuthTokens'
import type { CurrentUser } from '../entities/CurrentUser'
import type {
  E2eeKeyBackup,
  RegisterWebDeviceInput,
  RegisterWebDeviceResult,
  SaveE2eeKeyBackupInput,
} from '../entities/WebE2eeBootstrap'

export interface AuthRepository {
  login(identifier: string, password: string): Promise<AuthTokens>
  refresh(refreshToken: string): Promise<AuthTokens>
  logout(refreshToken: string): Promise<void>
  me(accessToken?: string): Promise<CurrentUser>
  getE2eeBackup(accessToken?: string): Promise<E2eeKeyBackup | null>
  saveE2eeBackup(input: SaveE2eeKeyBackupInput, accessToken: string): Promise<void>
  registerWebDevice(input: RegisterWebDeviceInput, accessToken: string): Promise<RegisterWebDeviceResult>
  completeOnboarding(): Promise<void>
}
