import type { ProfileUser } from '../../../domain/entities/ProfileUser'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class LoadProfileUserUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(): Promise<ProfileUser> {
    return this.profileRepository.getMyProfile()
  }
}
