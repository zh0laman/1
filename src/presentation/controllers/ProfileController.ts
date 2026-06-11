import { CreateEducationUseCase } from '../../application/use-cases/profile/CreateEducationUseCase'
import { CreateLicenseCertificationUseCase } from '../../application/use-cases/profile/CreateLicenseCertificationUseCase'
import { DeleteEducationUseCase } from '../../application/use-cases/profile/DeleteEducationUseCase'
import { DeleteLicenseCertificationUseCase } from '../../application/use-cases/profile/DeleteLicenseCertificationUseCase'
import { LoadMyEducationsUseCase } from '../../application/use-cases/profile/LoadMyEducationsUseCase'
import { LoadProfileHrByIinUseCase } from '../../application/use-cases/profile/LoadProfileHrByIinUseCase'
import { LoadMyLicenseCertificationsUseCase } from '../../application/use-cases/profile/LoadMyLicenseCertificationsUseCase'
import { LoadProfileStatsUseCase } from '../../application/use-cases/profile/LoadProfileStatsUseCase'
import { LoadProfileUserUseCase } from '../../application/use-cases/profile/LoadProfileUserUseCase'
import { UpdateEducationUseCase } from '../../application/use-cases/profile/UpdateEducationUseCase'
import { UpdateLicenseCertificationUseCase } from '../../application/use-cases/profile/UpdateLicenseCertificationUseCase'
import type {
  CreateEducationInput,
  CreateLicenseCertificationInput,
  UpdateEducationInput,
  UpdateLicenseCertificationInput,
} from '../../domain/entities/profile-settings/ProfileSectionsModels'
import { HttpError } from '../../infrastructure/http/HttpError'
import type {
  ProfileEducationViewModel,
  ProfileLicenseCertificationViewModel,
  ProfilePageViewModel,
} from '../view-models/ProfileViewModel'
import {
  toProfileEducationViewModel,
  toProfileEducationsViewModel,
  toProfileHrViewModel,
  toProfileLicenseCertificationViewModel,
  toProfileLicenseCertificationsViewModel,
  toProfileStatsViewModel,
  toProfileUserViewModel,
} from '../view-models/ProfileViewModel'

export interface ProfileLoadResult {
  viewModel: ProfilePageViewModel
  userError: string
  statsError: string
  sectionsError: string
  isUnauthorized: boolean
}

export class ProfileController {
  private readonly loadProfileUserUseCase: LoadProfileUserUseCase
  private readonly loadProfileHrByIinUseCase: LoadProfileHrByIinUseCase
  private readonly loadProfileStatsUseCase: LoadProfileStatsUseCase
  private readonly loadMyEducationsUseCase: LoadMyEducationsUseCase
  private readonly loadMyLicenseCertificationsUseCase: LoadMyLicenseCertificationsUseCase
  private readonly createEducationUseCase: CreateEducationUseCase
  private readonly createLicenseCertificationUseCase: CreateLicenseCertificationUseCase
  private readonly updateEducationUseCase: UpdateEducationUseCase
  private readonly updateLicenseCertificationUseCase: UpdateLicenseCertificationUseCase
  private readonly deleteEducationUseCase: DeleteEducationUseCase
  private readonly deleteLicenseCertificationUseCase: DeleteLicenseCertificationUseCase

  constructor(
    loadProfileUserUseCase: LoadProfileUserUseCase,
    loadProfileHrByIinUseCase: LoadProfileHrByIinUseCase,
    loadProfileStatsUseCase: LoadProfileStatsUseCase,
    loadMyEducationsUseCase: LoadMyEducationsUseCase,
    loadMyLicenseCertificationsUseCase: LoadMyLicenseCertificationsUseCase,
    createEducationUseCase: CreateEducationUseCase,
    createLicenseCertificationUseCase: CreateLicenseCertificationUseCase,
    updateEducationUseCase: UpdateEducationUseCase,
    updateLicenseCertificationUseCase: UpdateLicenseCertificationUseCase,
    deleteEducationUseCase: DeleteEducationUseCase,
    deleteLicenseCertificationUseCase: DeleteLicenseCertificationUseCase,
  ) {
    this.loadProfileUserUseCase = loadProfileUserUseCase
    this.loadProfileHrByIinUseCase = loadProfileHrByIinUseCase
    this.loadProfileStatsUseCase = loadProfileStatsUseCase
    this.loadMyEducationsUseCase = loadMyEducationsUseCase
    this.loadMyLicenseCertificationsUseCase = loadMyLicenseCertificationsUseCase
    this.createEducationUseCase = createEducationUseCase
    this.createLicenseCertificationUseCase = createLicenseCertificationUseCase
    this.updateEducationUseCase = updateEducationUseCase
    this.updateLicenseCertificationUseCase = updateLicenseCertificationUseCase
    this.deleteEducationUseCase = deleteEducationUseCase
    this.deleteLicenseCertificationUseCase = deleteLicenseCertificationUseCase
  }

  async loadPage(): Promise<ProfileLoadResult> {
    const [userResult, statsResult, educationsResult, licensesResult] = await Promise.allSettled([
      this.loadProfileUserUseCase.execute(),
      this.loadProfileStatsUseCase.execute(),
      this.loadMyEducationsUseCase.execute(),
      this.loadMyLicenseCertificationsUseCase.execute(),
    ])
    const hrLookupIin =
      userResult.status === 'fulfilled' && typeof userResult.value.iin === 'string'
        ? userResult.value.iin.trim()
        : ''

    const hrResult = hrLookupIin
      ? await Promise.allSettled([this.loadProfileHrByIinUseCase.execute(hrLookupIin)]).then(
          (results) => results[0],
        )
      : null

    const isUnauthorizedRejection = (result: PromiseSettledResult<unknown>): boolean =>
      result.status === 'rejected' &&
      result.reason instanceof HttpError &&
      (result.reason.status === 401 || result.reason.status === 403)

    return {
      viewModel: {
        user: userResult.status === 'fulfilled' ? toProfileUserViewModel(userResult.value) : null,
        hrProfile:
          hrResult?.status === 'fulfilled' && hrResult.value
            ? toProfileHrViewModel(hrResult.value)
            : null,
        stats: statsResult.status === 'fulfilled' ? toProfileStatsViewModel(statsResult.value) : null,
        sections:
          educationsResult.status === 'fulfilled' && licensesResult.status === 'fulfilled'
            ? {
                educations: toProfileEducationsViewModel(educationsResult.value),
                licenses: toProfileLicenseCertificationsViewModel(licensesResult.value),
              }
            : null,
      },
      userError: userResult.status === 'rejected' ? 'Не удалось загрузить данные профиля.' : '',
      statsError: statsResult.status === 'rejected' ? 'Не удалось загрузить статистику профиля.' : '',
      sectionsError:
        educationsResult.status === 'rejected' || licensesResult.status === 'rejected'
          ? 'Не удалось загрузить разделы образования и сертификатов.'
          : '',
      isUnauthorized:
        isUnauthorizedRejection(userResult) ||
        isUnauthorizedRejection(statsResult) ||
        isUnauthorizedRejection(educationsResult) ||
        isUnauthorizedRejection(licensesResult),
    }
  }

  async createEducation(payload: CreateEducationInput): Promise<ProfileEducationViewModel> {
    const education = await this.createEducationUseCase.execute(payload)
    return toProfileEducationViewModel(education)
  }

  async createLicenseCertification(
    payload: CreateLicenseCertificationInput,
  ): Promise<ProfileLicenseCertificationViewModel> {
    const certification = await this.createLicenseCertificationUseCase.execute(payload)
    return toProfileLicenseCertificationViewModel(certification)
  }

  async updateEducation(id: number, payload: UpdateEducationInput): Promise<ProfileEducationViewModel> {
    const education = await this.updateEducationUseCase.execute(id, payload)
    return toProfileEducationViewModel(education)
  }

  async updateLicenseCertification(
    id: number,
    payload: UpdateLicenseCertificationInput,
  ): Promise<ProfileLicenseCertificationViewModel> {
    const certification = await this.updateLicenseCertificationUseCase.execute(id, payload)
    return toProfileLicenseCertificationViewModel(certification)
  }

  async deleteEducation(id: number): Promise<void> {
    await this.deleteEducationUseCase.execute(id)
  }

  async deleteLicenseCertification(id: number): Promise<void> {
    await this.deleteLicenseCertificationUseCase.execute(id)
  }
}
