export interface CurrentUser {
  id: number
  email: string
  username: string
  firstName: string
  lastName: string
  fullName: string
  fullNameLocal: string
  role: string
  avatarUrl: string
  position: string
  isActive: boolean
  isFirstLogin: boolean
  availabilityStatus: string
}
