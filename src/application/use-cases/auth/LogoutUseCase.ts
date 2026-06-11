import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export class LogoutUseCase {
  private readonly authRepository: AuthRepository
  private readonly sessionStore: AuthSessionStore

  constructor(authRepository: AuthRepository, sessionStore: AuthSessionStore) {
    this.authRepository = authRepository
    this.sessionStore = sessionStore
  }

  async execute(): Promise<void> {
    const refreshToken = this.sessionStore.getTokens()?.refreshToken ?? ''
    this.sessionStore.clearTokens()

    if (refreshToken) {
      await this.authRepository.logout(refreshToken)
    }
  }
}
