import type {
  CreateEducationInput,
  UserEducationItem,
} from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class CreateEducationUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(payload: CreateEducationInput): Promise<UserEducationItem> {
    return this.profileRepository.createEducation(payload)
  }
}
