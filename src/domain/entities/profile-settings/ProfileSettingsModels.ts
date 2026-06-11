import type { SaveE2eeKeyBackupInput } from '../WebE2eeBootstrap'

export const availabilityStatuses = ['online', 'offline', 'sick', 'vacation'] as const

export type AvailabilityStatus = (typeof availabilityStatuses)[number]

export interface CurrentProfile {
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

export interface UpdateStatusRequest {
  status: AvailabilityStatus
}

export interface UpdateStatusResponse {
  message: string
  status: AvailabilityStatus
}

export interface UpdateAvatarRequest {
  avatarUrl?: string
  avatarFile?: File
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  e2eeBackup: SaveE2eeKeyBackupInput
}

export interface ChangePasswordResponse {
  message: string
}
