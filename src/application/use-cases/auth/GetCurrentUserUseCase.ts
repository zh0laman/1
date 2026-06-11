import type { CurrentUser } from '../../../domain/entities/CurrentUser'
import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export class GetCurrentUserUseCase {
  private readonly authRepository: AuthRepository
  private readonly sessionStore: AuthSessionStore

  constructor(authRepository: AuthRepository, sessionStore: AuthSessionStore) {
    this.authRepository = authRepository
    this.sessionStore = sessionStore
  }

  async execute(): Promise<CurrentUser> {
    const accessToken = this.sessionStore.getTokens()?.accessToken
    return this.authRepository.me(accessToken)
  }
}
