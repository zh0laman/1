import { RefreshSessionUseCase } from '../../application/use-cases/auth/RefreshSessionUseCase'
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase'
import { HttpError, parseHttpError } from './HttpError'

interface ApiClientDeps {
  refreshSessionUseCase: RefreshSessionUseCase
  logoutUseCase: LogoutUseCase
}

export class ApiClient {
  private readonly refreshSessionUseCase: RefreshSessionUseCase
  private readonly logoutUseCase: LogoutUseCase
  private refreshPromise: Promise<void> | null = null

  constructor(deps: ApiClientDeps) {
    this.refreshSessionUseCase = deps.refreshSessionUseCase
    this.logoutUseCase = deps.logoutUseCase
  }

  async request<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await this.executeRequest(input, init)

    if (response.status === 401) {
      await this.refreshWithLock()
      const retryResponse = await this.executeRequest(input, init)

      if (retryResponse.status === 401) {
        this.logoutUseCase.execute()
        throw new HttpError('Сессия истекла. Войдите снова.', 401)
      }

      return this.unwrapJson<T>(retryResponse)
    }

    return this.unwrapJson<T>(response)
  }

  private async executeRequest(input: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)

    headers.set('Accept', 'application/json')

    return fetch(input, {
      ...init,
      headers,
      credentials: init?.credentials ?? 'include',
    })
  }

  private async refreshWithLock(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.refreshSessionUseCase
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logoutUseCase.execute()
        throw error
      })
      .finally(() => {
        this.refreshPromise = null
      })

    return this.refreshPromise
  }

  private async unwrapJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw await parseHttpError(response)
    }

    return (await response.json()) as T
  }
}
