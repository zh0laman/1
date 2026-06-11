import type { AuthRepository } from '../../../domain/repositories/AuthRepository'

export class CompleteOnboardingUseCase {
  private readonly authRepository: AuthRepository
  constructor(authRepository: AuthRepository) {
    this.authRepository = authRepository
  }

  async execute(): Promise<void> {
    await this.authRepository.completeOnboarding()
  }
}
