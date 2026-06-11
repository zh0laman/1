import type { ProfileStats } from '../entities/ProfileStats'
import type { ProfileHr } from '../entities/ProfileHr'
import type { ProfileUser } from '../entities/ProfileUser'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  CurrentProfile,
  UpdateAvatarRequest,
  UpdateStatusRequest,
  UpdateStatusResponse,
} from '../entities/profile-settings/ProfileSettingsModels'
import type {
  CreateEducationInput,
  CreateLicenseCertificationInput,
  EducationListResponse,
  LicenseCertificationListResponse,
  UpdateEducationInput,
  UpdateLicenseCertificationInput,
  UserEducationItem,
  UserLicenseCertificationItem,
} from '../entities/profile-settings/ProfileSectionsModels'
import type { AlemContactDirectory, HrFilterField, HrUsersListParams } from '../entities/AlemContact'

export interface ProfileRepository {
  getMe(): Promise<CurrentProfile>
  getMyProfile(): Promise<ProfileUser>
  getHrProfileByIin(iin: string): Promise<ProfileHr | null>
  getMyStats(): Promise<ProfileStats>
  getMyEducations(): Promise<EducationListResponse>
  getMyLicenseCertifications(): Promise<LicenseCertificationListResponse>
  createEducation(payload: CreateEducationInput): Promise<UserEducationItem>
  createLicenseCertification(payload: CreateLicenseCertificationInput): Promise<UserLicenseCertificationItem>
  updateEducation(id: number, payload: UpdateEducationInput): Promise<UserEducationItem>
  updateLicenseCertification(
    id: number,
    payload: UpdateLicenseCertificationInput,
  ): Promise<UserLicenseCertificationItem>
  deleteEducation(id: number): Promise<void>
  deleteLicenseCertification(id: number): Promise<void>
  updateStatus(payload: UpdateStatusRequest): Promise<UpdateStatusResponse>
  updateAvatar(payload: UpdateAvatarRequest): Promise<CurrentProfile>
  changePassword(payload: ChangePasswordRequest): Promise<ChangePasswordResponse>
  /** Справочник сотрудников HR: `GET /api/v1/users/hr` */
  listHrUsers(params?: HrUsersListParams): Promise<AlemContactDirectory>
  /** Варианты для фильтров: `GET /api/v1/users/hr/filters/{field}` */
  listHrFilterValues(field: HrFilterField): Promise<string[]>
}
