import type {
  UpdateEducationInput,
  UserEducationItem,
} from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class UpdateEducationUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(id: number, payload: UpdateEducationInput): Promise<UserEducationItem> {
    return this.profileRepository.updateEducation(id, payload)
  }
}
