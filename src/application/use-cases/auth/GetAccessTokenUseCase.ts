import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'

export class GetAccessTokenUseCase {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  execute(): string | null {
    return this.sessionStore.getTokens()?.accessToken ?? null
  }
}
