import { GetCurrentUserUseCase } from '../../application/use-cases/auth/GetCurrentUserUseCase'
import { GetStoredSessionUseCase } from '../../application/use-cases/auth/GetStoredSessionUseCase'
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase'
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase'
import { RefreshSessionUseCase } from '../../application/use-cases/auth/RefreshSessionUseCase'
import { HttpAuthRepository } from '../../infrastructure/repositories/HttpAuthRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { AuthController } from '../controllers/AuthController'

export const createAuthController = () => {
  const repository = new HttpAuthRepository()
  const sessionStore = new LocalStorageAuthSessionStore()

  const getStoredSessionUseCase = new GetStoredSessionUseCase(sessionStore)
  const getCurrentUserUseCase = new GetCurrentUserUseCase(repository, sessionStore)
  const loginUseCase = new LoginUseCase(repository, sessionStore)
  const refreshSessionUseCase = new RefreshSessionUseCase(repository, sessionStore)
  const logoutUseCase = new LogoutUseCase(repository, sessionStore)

  const authController = new AuthController(
    getStoredSessionUseCase,
    getCurrentUserUseCase,
    loginUseCase,
    refreshSessionUseCase,
    logoutUseCase,
  )

  return {
    authController,
    sessionStore,
  }
}
