import { AlemAiUseCase } from '../../application/use-cases/alemai/AlemAiUseCase'

export class AlemAiController {
  private readonly useCase: AlemAiUseCase

  constructor(useCase: AlemAiUseCase) {
    this.useCase = useCase
  }

  get api() {
    return this.useCase.repositoryApi
  }
}
