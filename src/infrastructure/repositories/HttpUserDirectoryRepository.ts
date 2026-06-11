import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'

export interface UserDirectoryEducationItem {
  id: number
  schoolName: string
  schoolAvatarUrl: string | null
  degree: string | null
  fieldOfStudy: string
  startDate: string
  endDate: string | null
}

export interface UserDirectoryLicenseCertificationItem {
  id: number
  name: string
  issuingOrganization: string
  skillName: string
  avatarUrl: string | null
  issueDate: string
  expirationDate: string | null
  attachmentFileName: string | null
  attachmentContentType: string | null
  attachmentDownloadUrl: string | null
}

export interface UserDirectoryUser {
  id: number
  email: string
  username: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  isActive: boolean
  lastSeenAt: string | null
}

export interface UserDirectoryReviewStats {
  targetUserId: number
  period: string
  reviewCount: number
  avgDataFluency: number
  avgProjectManagement: number
  avgDigitalProficiency: number
  avgCrisisCommunication: number
  avgServiceDesignThinking: number
}

export interface CreateUserReviewInput {
  targetUserId: number
  dataFluency: number
  projectManagement: number
  digitalProficiency: number
  crisisCommunication: number
  serviceDesignThinking: number
}

export interface UserDirectoryUserDetails extends UserDirectoryUser {
  keycloakId: string
  iin: string
  ministryId: number | null
  stateBodyId: number | null
  role: string
  availabilityStatus: string
  createdAt: string | null
  lastLoginAt: string | null
  isFirstLogin: boolean
  isSupport: boolean
  ministryName: string
  stateBodyName: string
  bossId: number | null
  bossName: string
  reviewStats: UserDirectoryReviewStats | null
  hasReviewedThisMonth: boolean
  educations: UserDirectoryEducationItem[]
  licenses: UserDirectoryLicenseCertificationItem[]
}

interface UserDirectoryReviewStatsDto {
  target_user_id?: number
  period?: string
  review_count?: number
  avg_data_fluency?: number
  avg_project_management?: number
  avg_digital_proficiency?: number
  avg_crisis_communication?: number
  avg_service_design_thinking?: number
}

interface UserDirectoryUserDto {
  id: number
  email?: string
  username?: string
  first_name?: string
  last_name?: string
  full_name?: string
  avatar_url?: string | null
  is_active?: boolean
  last_seen_at?: string | null
  keycloak_id?: string
  iin?: string
  ministry_id?: number | null
  state_body_id?: number | null
  role?: string
  availability_status?: string | null
  created_at?: string | null
  last_login_at?: string | null
  is_first_login?: boolean
  is_support?: boolean
  ministry_name?: string | null
  state_body_name?: string | null
  boss_id?: number | null
  boss_name?: string | null
  review_stats?: UserDirectoryReviewStatsDto | null
  has_reviewed_this_month?: boolean
}

interface UserDirectoryEducationItemDto {
  id: number
  school_name?: string
  school_avatar_url?: string | null
  degree?: string | null
  field_of_study?: string
  start_date?: string
  end_date?: string | null
}

interface UserDirectoryEducationListDto {
  items?: UserDirectoryEducationItemDto[]
}

interface UserDirectoryLicenseCertificationItemDto {
  id: number
  name?: string
  issuing_organization?: string
  skill_name?: string
  avatar_url?: string | null
  issue_date?: string
  expiration_date?: string | null
  attachment_file_name?: string | null
  attachment_content_type?: string | null
  attachment_download_url?: string | null
}

interface UserDirectoryLicenseCertificationListDto {
  items?: UserDirectoryLicenseCertificationItemDto[]
}

export class HttpUserDirectoryRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  private mapUser = (user: UserDirectoryUserDto): UserDirectoryUser => ({
    id: user.id,
    email: user.email ?? '',
    username: user.username ?? '',
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? '',
    fullName:
      user.full_name?.trim() ||
      `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
      user.username ||
      `User ${user.id}`,
    avatarUrl: normalizeBackendAssetUrl(user.avatar_url) ?? null,
    isActive: user.is_active ?? false,
    lastSeenAt: user.last_seen_at ?? null,
  })

  private mapEducation = (item: UserDirectoryEducationItemDto): UserDirectoryEducationItem => ({
    id: Number(item.id ?? 0),
    schoolName: item.school_name ?? '',
    schoolAvatarUrl: normalizeBackendAssetUrl(item.school_avatar_url ?? null) ?? null,
    degree: item.degree ?? null,
    fieldOfStudy: item.field_of_study ?? '',
    startDate: item.start_date ?? '',
    endDate: item.end_date ?? null,
  })

  private mapLicense = (
    item: UserDirectoryLicenseCertificationItemDto,
  ): UserDirectoryLicenseCertificationItem => ({
    id: Number(item.id ?? 0),
    name: item.name ?? '',
    issuingOrganization: item.issuing_organization ?? '',
    skillName: item.skill_name ?? '',
    avatarUrl: normalizeBackendAssetUrl(item.avatar_url ?? null) ?? null,
    issueDate: item.issue_date ?? '',
    expirationDate: item.expiration_date ?? null,
    attachmentFileName: item.attachment_file_name ?? null,
    attachmentContentType: item.attachment_content_type ?? null,
    attachmentDownloadUrl: normalizeBackendAssetUrl(item.attachment_download_url ?? null) ?? null,
  })

  async getUsers(): Promise<UserDirectoryUser[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/auth/users/never-logged-in')
    const data = (await response.json()) as UserDirectoryUserDto[] | null

    return (data ?? []).map(this.mapUser)
  }

  async getUserDetails(userId: number): Promise<UserDirectoryUserDetails> {
    const [detailsResponse, educationsResponse, licensesResponse] = await Promise.all([
      authorizedFetch(this.sessionStore, `/api/v1/users/${userId}/details`),
      authorizedFetch(this.sessionStore, `/api/v1/users/${userId}/profile/education`),
      authorizedFetch(this.sessionStore, `/api/v1/users/${userId}/profile/licenses-certifications`),
    ])

    const data = (await detailsResponse.json()) as UserDirectoryUserDto
    const educationsData = (await educationsResponse.json()) as UserDirectoryEducationListDto
    const licensesData = (await licensesResponse.json()) as UserDirectoryLicenseCertificationListDto
    const baseUser = this.mapUser(data)
    const reviewStats = data.review_stats
      ? {
          targetUserId: Number(data.review_stats.target_user_id ?? 0),
          period: data.review_stats.period ?? '',
          reviewCount: Number(data.review_stats.review_count ?? 0),
          avgDataFluency: Number(data.review_stats.avg_data_fluency ?? 0),
          avgProjectManagement: Number(data.review_stats.avg_project_management ?? 0),
          avgDigitalProficiency: Number(data.review_stats.avg_digital_proficiency ?? 0),
          avgCrisisCommunication: Number(data.review_stats.avg_crisis_communication ?? 0),
          avgServiceDesignThinking: Number(data.review_stats.avg_service_design_thinking ?? 0),
        }
      : null

    return {
      ...baseUser,
      keycloakId: data.keycloak_id ?? '',
      iin: data.iin ?? '',
      ministryId: typeof data.ministry_id === 'number' ? data.ministry_id : null,
      stateBodyId: typeof data.state_body_id === 'number' ? data.state_body_id : null,
      role: data.role ?? '',
      availabilityStatus: data.availability_status ?? '',
      createdAt: data.created_at ?? null,
      lastLoginAt: data.last_login_at ?? null,
      isFirstLogin: data.is_first_login ?? false,
      isSupport: Boolean(data.is_support),
      ministryName: data.ministry_name ?? '',
      stateBodyName: data.state_body_name ?? '',
      bossId: typeof data.boss_id === 'number' ? data.boss_id : null,
      bossName: data.boss_name ?? '',
      reviewStats,
      hasReviewedThisMonth: Boolean(data.has_reviewed_this_month),
      educations: Array.isArray(educationsData.items) ? educationsData.items.map(this.mapEducation) : [],
      licenses: Array.isArray(licensesData.items) ? licensesData.items.map(this.mapLicense) : [],
    }
  }

  async submitReview(input: CreateUserReviewInput): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/reviews', {
      method: 'POST',
      body: JSON.stringify({
        target_user_id: input.targetUserId,
        data_fluency: input.dataFluency,
        project_management: input.projectManagement,
        digital_proficiency: input.digitalProficiency,
        crisis_communication: input.crisisCommunication,
        service_design_thinking: input.serviceDesignThinking,
      }),
    })
  }
}
