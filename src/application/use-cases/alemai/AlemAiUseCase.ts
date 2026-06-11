import { HttpAlemAiRepository } from '../../../infrastructure/repositories/HttpAlemAiRepository'

export class AlemAiUseCase {
  private readonly repository: HttpAlemAiRepository

  constructor(repository: HttpAlemAiRepository) {
    this.repository = repository
  }

  get repositoryApi(): HttpAlemAiRepository {
    return this.repository
  }
}
