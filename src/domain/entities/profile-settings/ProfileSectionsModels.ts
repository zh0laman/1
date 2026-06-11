export interface UserEducationItem {
  id: number
  userId: number
  schoolName: string
  schoolAvatarUrl: string | null
  schoolAvatarObjectName: string | null
  degree: string | null
  fieldOfStudy: string
  startDate: string
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export interface EducationListResponse {
  userId: number
  count: number
  items: UserEducationItem[]
}

export interface UserLicenseCertificationItem {
  id: number
  userId: number
  name: string
  issuingOrganization: string
  skillName: string
  avatarUrl: string | null
  avatarObjectName: string | null
  issueDate: string
  expirationDate: string | null
  attachmentObjectName: string | null
  attachmentFileName: string | null
  attachmentContentType: string | null
  attachmentSizeBytes: number | null
  attachmentDownloadUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface LicenseCertificationListResponse {
  userId: number
  count: number
  items: UserLicenseCertificationItem[]
}

export interface CreateEducationInput {
  schoolName: string
  degree?: string
  fieldOfStudy: string
  startDate: string
  endDate?: string
  avatarFile?: File | null
}

export interface CreateLicenseCertificationInput {
  name: string
  issuingOrganization: string
  skillName: string
  issueDate: string
  expirationDate?: string
  avatarFile?: File | null
  attachmentFile?: File | null
}

export interface UpdateEducationInput {
  schoolName: string
  degree?: string
  fieldOfStudy: string
  startDate: string
  endDate?: string
  avatarFile?: File | null
  removeAvatar?: boolean
}

export interface UpdateLicenseCertificationInput {
  name: string
  issuingOrganization: string
  skillName: string
  issueDate: string
  expirationDate?: string
  avatarFile?: File | null
  attachmentFile?: File | null
  removeAvatar?: boolean
  removeAttachment?: boolean
}
