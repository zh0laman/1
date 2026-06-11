import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class DeleteEducationUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(id: number): Promise<void> {
    await this.profileRepository.deleteEducation(id)
  }
}
