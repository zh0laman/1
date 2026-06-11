import type { AuthTokens } from '../../../domain/entities/AuthTokens'
import type { AuthRepository } from '../../../domain/repositories/AuthRepository'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export class LoginUseCase {
  private readonly authRepository: AuthRepository
  private readonly sessionStore: AuthSessionStore

  constructor(authRepository: AuthRepository, sessionStore: AuthSessionStore) {
    this.authRepository = authRepository
    this.sessionStore = sessionStore
  }

  async execute(identifier: string, password: string): Promise<AuthTokens> {
    const tokens = await this.authRepository.login(identifier, password)
    this.sessionStore.setTokens(tokens)
    return tokens
  }
}
