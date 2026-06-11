import type { ProfileHr } from '../../../domain/entities/ProfileHr'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class LoadProfileHrByIinUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(iin: string): Promise<ProfileHr | null> {
    return this.profileRepository.getHrProfileByIin(iin)
  }
}
