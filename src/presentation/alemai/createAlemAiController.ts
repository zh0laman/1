import { AlemAiUseCase } from '../../application/use-cases/alemai/AlemAiUseCase'
import { HttpAlemAiRepository } from '../../infrastructure/repositories/HttpAlemAiRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { AlemAiController } from '../controllers/AlemAiController'

let singleton: AlemAiController | null = null

export const createAlemAiController = () => {
  if (!singleton) {
    const sessionStore = new LocalStorageAuthSessionStore()
    const repository = new HttpAlemAiRepository(sessionStore)
    singleton = new AlemAiController(new AlemAiUseCase(repository))
  }

  return { alemAiController: singleton }
}
