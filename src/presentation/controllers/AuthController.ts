import type { AuthTokens } from '../../domain/entities/AuthTokens'
import { GetCurrentUserUseCase } from '../../application/use-cases/auth/GetCurrentUserUseCase'
import { GetStoredSessionUseCase } from '../../application/use-cases/auth/GetStoredSessionUseCase'
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase'
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase'
import { RefreshSessionUseCase } from '../../application/use-cases/auth/RefreshSessionUseCase'
import { isExpired } from '../../shared/utils/token'
import type { AuthViewModel } from '../view-models/AuthViewModel'
import { toAuthViewModel } from '../view-models/AuthViewModel'

const isUnauthorizedError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: unknown }).status === 401

export class AuthController {
  private static bootstrapInFlight: Promise<AuthViewModel> | null = null
  private static bootstrapCache:
    | {
        key: string
        model: AuthViewModel
        at: number
      }
    | null = null
  private static readonly bootstrapCacheTtlMs = 10_000

  private readonly getStoredSessionUseCase: GetStoredSessionUseCase
  private readonly getCurrentUserUseCase: GetCurrentUserUseCase
  private readonly loginUseCase: LoginUseCase
  private readonly refreshSessionUseCase: RefreshSessionUseCase
  private readonly logoutUseCase: LogoutUseCase

  constructor(
    getStoredSessionUseCase: GetStoredSessionUseCase,
    getCurrentUserUseCase: GetCurrentUserUseCase,
    loginUseCase: LoginUseCase,
    refreshSessionUseCase: RefreshSessionUseCase,
    logoutUseCase: LogoutUseCase,
  ) {
    this.getStoredSessionUseCase = getStoredSessionUseCase
    this.getCurrentUserUseCase = getCurrentUserUseCase
    this.loginUseCase = loginUseCase
    this.refreshSessionUseCase = refreshSessionUseCase
    this.logoutUseCase = logoutUseCase
  }

  async bootstrap(bypassCache = false): Promise<AuthViewModel> {
    const tokens = this.getStoredSessionUseCase.execute()
    const cacheKey = tokens ? `${tokens.accessToken}:${tokens.expiresAt}` : 'guest'
    const cached = AuthController.bootstrapCache
    const now = Date.now()

    if (!bypassCache && cached && cached.key === cacheKey && now - cached.at < AuthController.bootstrapCacheTtlMs) {
      return cached.model
    }

    if (!bypassCache && AuthController.bootstrapInFlight) {
      return AuthController.bootstrapInFlight
    }


    const request = (async () => {
      if (!tokens) {
        return this.cacheGuestModel(cacheKey)
      }

      if (isExpired(tokens.expiresAt, 30_000)) {
        try {
          const refreshedTokens = await this.refreshSessionUseCase.execute()
          return await this.buildAuthenticatedModel(refreshedTokens)
        } catch {
          await this.logoutSilently()
          return this.cacheGuestModel('guest')
        }
      }

      return this.buildAuthenticatedModel(tokens)
    })().finally(() => {
      AuthController.bootstrapInFlight = null
    })

    AuthController.bootstrapInFlight = request
    return request
  }

  async login(identifier: string, password: string): Promise<AuthViewModel> {
    const tokens = await this.loginUseCase.execute(identifier, password)
    return this.buildAuthenticatedModel(tokens)
  }

  async refresh(): Promise<AuthViewModel> {
    const tokens = await this.refreshSessionUseCase.execute()
    return this.buildAuthenticatedModel(tokens)
  }

  async refreshIfExpiringSoon(): Promise<AuthViewModel> {
    const tokens = this.getStoredSessionUseCase.execute()

    if (!tokens) {
      return toAuthViewModel(null)
    }

    if (isExpired(tokens.expiresAt, 60_000)) {
      try {
        const refreshedTokens = await this.refreshSessionUseCase.execute()
        return await this.buildAuthenticatedModel(refreshedTokens)
      } catch {
        await this.logoutSilently()
        return toAuthViewModel(null)
      }
    }

    return this.buildAuthenticatedModel(tokens)
  }

  async logout(): Promise<AuthViewModel> {
    await this.logoutSilently()
    const guestModel = toAuthViewModel(null)
    AuthController.bootstrapCache = {
      key: 'guest',
      model: guestModel,
      at: Date.now(),
    }
    AuthController.bootstrapInFlight = null
    return guestModel
  }

  private async buildAuthenticatedModel(tokens: AuthTokens): Promise<AuthViewModel> {
    try {
      const currentUser = await this.getCurrentUserUseCase.execute()
      const model = toAuthViewModel(tokens, currentUser)
      AuthController.bootstrapCache = {
        key: `${tokens.accessToken}:${tokens.expiresAt}`,
        model,
        at: Date.now(),
      }
      return model
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await this.logoutSilently()
        return this.cacheGuestModel('guest')
      }

      const model = toAuthViewModel(tokens, null)
      AuthController.bootstrapCache = {
        key: `${tokens.accessToken}:${tokens.expiresAt}`,
        model,
        at: Date.now(),
      }
      return model
    }
  }

  private cacheGuestModel(cacheKey: string): AuthViewModel {
    const guestModel = toAuthViewModel(null)
    AuthController.bootstrapCache = {
      key: cacheKey,
      model: guestModel,
      at: Date.now(),
    }
    return guestModel
  }

  private async logoutSilently(): Promise<void> {
    await this.logoutUseCase.execute().catch(() => undefined)
  }
}
