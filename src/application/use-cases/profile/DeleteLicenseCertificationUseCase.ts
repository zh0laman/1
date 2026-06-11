import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class DeleteLicenseCertificationUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(id: number): Promise<void> {
    await this.profileRepository.deleteLicenseCertification(id)
  }
}
