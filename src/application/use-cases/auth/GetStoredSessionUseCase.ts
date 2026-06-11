import type { AuthTokens } from '../../../domain/entities/AuthTokens'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export class GetStoredSessionUseCase {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  execute(): AuthTokens | null {
    return this.sessionStore.getTokens()
  }
}
