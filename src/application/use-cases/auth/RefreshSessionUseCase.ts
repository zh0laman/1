import type { AuthTokens } from '../../../domain/entities/AuthTokens'
import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export class RefreshSessionUseCase {
  private readonly authRepository: AuthRepository
  private readonly sessionStore: AuthSessionStore

  constructor(authRepository: AuthRepository, sessionStore: AuthSessionStore) {
    this.authRepository = authRepository
    this.sessionStore = sessionStore
  }

  async execute(): Promise<AuthTokens> {
    const tokens = this.sessionStore.getTokens()
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    const refreshedTokens = await this.authRepository.refresh(tokens.refreshToken)
    this.sessionStore.setTokens(refreshedTokens)

    return refreshedTokens
  }
}
