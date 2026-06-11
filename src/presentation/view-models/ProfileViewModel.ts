import type { ProfileStats } from '../../domain/entities/ProfileStats'
import type { ProfileHr } from '../../domain/entities/ProfileHr'
import type { ProfileUser } from '../../domain/entities/ProfileUser'
import type { AvailabilityStatus, CurrentProfile } from '../../domain/entities/profile-settings/ProfileSettingsModels'
import type {
  EducationListResponse,
  LicenseCertificationListResponse,
} from '../../domain/entities/profile-settings/ProfileSectionsModels'

export interface ProfileSkillMetricViewModel {
  key: string
  label: string
  score: number
}

export interface ProfileStatsViewModel {
  targetUserId: number
  period: string
  reviewCount: number
  overallScore: number
  skills: ProfileSkillMetricViewModel[]
}

export interface ProfileUserViewModel {
  id: number
  uuid: string
  email: string
  firstName: string
  lastName: string
  username: string
  iin: string
  ministryId: number
  fullName: string
  isActive: boolean
  lastLoginAt: string
  createdAt: string
  avatarUrl: string
  isFirstLogin: boolean
  availabilityStatus: string
}

export interface ProfilePageViewModel {
  user: ProfileUserViewModel | null
  hrProfile: ProfileHrViewModel | null
  stats: ProfileStatsViewModel | null
  sections: ProfileSectionsViewModel | null
}

export interface ProfileHrViewModel {
  nameGo: string
  docType: string
  jobName: string
  subName: string
  lastOrderDate: string
  lastOrderNumber: string
}

export interface ProfileEducationViewModel {
  id: number
  schoolName: string
  schoolAvatarUrl: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate: string
}

export interface ProfileLicenseCertificationViewModel {
  id: number
  name: string
  issuingOrganization: string
  skillName: string
  avatarUrl: string
  issueDate: string
  expirationDate: string
  attachmentFileName: string
  attachmentContentType: string
  attachmentDownloadUrl: string
}

export interface ProfileSectionsViewModel {
  educations: ProfileEducationViewModel[]
  licenses: ProfileLicenseCertificationViewModel[]
}

export interface CurrentProfileViewModel {
  id: number
  keycloakId: string
  iin: string
  email: string
  username: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string
  bio: string
  position: string
  isActive: boolean
  availabilityStatus: AvailabilityStatus | null
  fullNameLocal: string
  isFirstLogin: boolean
  lastLoginAt: string
  lastSeenAt: string
  createdAt: string
  role: string
  ministryId: number | null
  stateBodyId: number | null
  departmentId: number | null
  divisionId: number | null
  isSupport: boolean
}

const clampScore = (score: number): number => Math.max(0, Math.min(5, Number(score) || 0))

export const toProfileUserViewModel = (user: ProfileUser): ProfileUserViewModel => ({
  id: user.id,
  uuid: user.uuid,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  iin: user.iin,
  ministryId: user.ministryId,
  fullName: user.fullName,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  avatarUrl: user.avatarUrl,
  isFirstLogin: user.isFirstLogin,
  availabilityStatus: user.availabilityStatus,
})

export const toProfileStatsViewModel = (stats: ProfileStats): ProfileStatsViewModel => {
  const skills: ProfileSkillMetricViewModel[] = [
    { key: 'dataFluency', label: 'Инициативность', score: clampScore(stats.avgDataFluency) },
    { key: 'projectManagement', label: 'Добропорядочность', score: clampScore(stats.avgProjectManagement) },
    { key: 'digitalProficiency', label: 'Ответственность', score: clampScore(stats.avgDigitalProficiency) },
    { key: 'crisisCommunication', label: 'Оперативность', score: clampScore(stats.avgCrisisCommunication) },
    { key: 'serviceDesignThinking', label: 'Саморазвитие', score: clampScore(stats.avgServiceDesignThinking) },
  ]

  const overallScore = Number((skills.reduce((sum, item) => sum + item.score, 0) / skills.length).toFixed(1))

  return {
    targetUserId: stats.targetUserId,
    period: stats.period,
    reviewCount: stats.reviewCount,
    overallScore,
    skills,
  }
}

export const toProfileHrViewModel = (hr: ProfileHr): ProfileHrViewModel => ({
  nameGo: hr.nameGo,
  docType: hr.docType,
  jobName: hr.jobName,
  subName: hr.subName,
  lastOrderDate: hr.lastOrderDate,
  lastOrderNumber: hr.lastOrderNumber,
})

export const toProfileEducationsViewModel = (
  response: EducationListResponse,
): ProfileEducationViewModel[] =>
  response.items.map((item) => ({
    id: item.id,
    schoolName: item.schoolName,
    schoolAvatarUrl: item.schoolAvatarUrl ?? '',
    degree: item.degree ?? '',
    fieldOfStudy: item.fieldOfStudy,
    startDate: item.startDate,
    endDate: item.endDate ?? '',
  }))

export const toProfileEducationViewModel = (
  item: EducationListResponse['items'][number],
): ProfileEducationViewModel => ({
  id: item.id,
  schoolName: item.schoolName,
  schoolAvatarUrl: item.schoolAvatarUrl ?? '',
  degree: item.degree ?? '',
  fieldOfStudy: item.fieldOfStudy,
  startDate: item.startDate,
  endDate: item.endDate ?? '',
})

export const toProfileLicenseCertificationsViewModel = (
  response: LicenseCertificationListResponse,
): ProfileLicenseCertificationViewModel[] =>
  response.items.map((item) => ({
    id: item.id,
    name: item.name,
    issuingOrganization: item.issuingOrganization,
    skillName: item.skillName,
    avatarUrl: item.avatarUrl ?? '',
    issueDate: item.issueDate,
    expirationDate: item.expirationDate ?? '',
    attachmentFileName: item.attachmentFileName ?? '',
    attachmentContentType: item.attachmentContentType ?? '',
    attachmentDownloadUrl: item.attachmentDownloadUrl ?? '',
  }))

export const toProfileLicenseCertificationViewModel = (
  item: LicenseCertificationListResponse['items'][number],
): ProfileLicenseCertificationViewModel => ({
  id: item.id,
  name: item.name,
  issuingOrganization: item.issuingOrganization,
  skillName: item.skillName,
  avatarUrl: item.avatarUrl ?? '',
  issueDate: item.issueDate,
  expirationDate: item.expirationDate ?? '',
  attachmentFileName: item.attachmentFileName ?? '',
  attachmentContentType: item.attachmentContentType ?? '',
  attachmentDownloadUrl: item.attachmentDownloadUrl ?? '',
})

export const toCurrentProfileViewModel = (profile: CurrentProfile): CurrentProfileViewModel => ({
  id: profile.id,
  keycloakId: profile.keycloakId,
  iin: profile.iin,
  email: profile.email,
  username: profile.username,
  firstName: profile.firstName,
  lastName: profile.lastName,
  fullName: profile.fullName,
  avatarUrl: profile.avatarUrl ?? '',
  bio: profile.bio,
  position: profile.position,
  isActive: profile.isActive,
  availabilityStatus: profile.availabilityStatus,
  fullNameLocal: profile.fullNameLocal,
  isFirstLogin: profile.isFirstLogin,
  lastLoginAt: profile.lastLoginAt,
  lastSeenAt: profile.lastSeenAt,
  createdAt: profile.createdAt,
  role: profile.role,
  ministryId: profile.ministryId,
  stateBodyId: profile.stateBodyId,
  departmentId: profile.departmentId,
  divisionId: profile.divisionId,
  isSupport: profile.isSupport,
})
