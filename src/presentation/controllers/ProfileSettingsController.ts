import type { AvailabilityStatus } from '../../domain/entities/profile-settings/ProfileSettingsModels'
import {
  ChangeMyPasswordWithE2eeBackupRotationUseCase,
  type ChangeMyPasswordWithE2eeBackupRotationResult,
} from '../../application/use-cases/profile/ChangeMyPasswordWithE2eeBackupRotationUseCase'
import { GetCurrentProfileUseCase } from '../../application/use-cases/profile/GetCurrentProfileUseCase'
import { SyncMyE2eeBackupUseCase, type SyncMyE2eeBackupResult } from '../../application/use-cases/profile/SyncMyE2eeBackupUseCase'
import { UpdateMyAvatarUseCase } from '../../application/use-cases/profile/UpdateMyAvatarUseCase'
import { UpdateMyStatusUseCase } from '../../application/use-cases/profile/UpdateMyStatusUseCase'
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase'
import { CompleteOnboardingUseCase } from '../../application/use-cases/auth/CompleteOnboardingUseCase'
import type { CurrentProfileViewModel } from '../view-models/ProfileViewModel'
import { toCurrentProfileViewModel } from '../view-models/ProfileViewModel'

export class ProfileSettingsController {
  private readonly getCurrentProfileUseCase: GetCurrentProfileUseCase
  private readonly updateMyStatusUseCase: UpdateMyStatusUseCase
  private readonly updateMyAvatarUseCase: UpdateMyAvatarUseCase
  private readonly changeMyPasswordUseCase: ChangeMyPasswordWithE2eeBackupRotationUseCase
  private readonly syncMyE2eeBackupUseCase: SyncMyE2eeBackupUseCase
  private readonly logoutUseCase: LogoutUseCase
  private readonly completeOnboardingUseCase: CompleteOnboardingUseCase

  constructor(
    getCurrentProfileUseCase: GetCurrentProfileUseCase,
    updateMyStatusUseCase: UpdateMyStatusUseCase,
    updateMyAvatarUseCase: UpdateMyAvatarUseCase,
    changeMyPasswordUseCase: ChangeMyPasswordWithE2eeBackupRotationUseCase,
    syncMyE2eeBackupUseCase: SyncMyE2eeBackupUseCase,
    logoutUseCase: LogoutUseCase,
    completeOnboardingUseCase: CompleteOnboardingUseCase,
  ) {
    this.getCurrentProfileUseCase = getCurrentProfileUseCase
    this.updateMyStatusUseCase = updateMyStatusUseCase
    this.updateMyAvatarUseCase = updateMyAvatarUseCase
    this.changeMyPasswordUseCase = changeMyPasswordUseCase
    this.syncMyE2eeBackupUseCase = syncMyE2eeBackupUseCase
    this.logoutUseCase = logoutUseCase
    this.completeOnboardingUseCase = completeOnboardingUseCase
  }

  async loadProfile(): Promise<CurrentProfileViewModel> {
    const profile = await this.getCurrentProfileUseCase.execute()
    return toCurrentProfileViewModel(profile)
  }

  async updateStatus(status: AvailabilityStatus): Promise<CurrentProfileViewModel> {
    await this.updateMyStatusUseCase.execute(status)
    const profile = await this.getCurrentProfileUseCase.execute()
    return toCurrentProfileViewModel(profile)
  }

  async updateAvatar(avatarUrl?: string, avatarFile?: File): Promise<CurrentProfileViewModel> {
    const updatedFromWriteEndpoint = await this.updateMyAvatarUseCase.execute(avatarUrl, avatarFile)

    try {
      const syncedProfile = await this.getCurrentProfileUseCase.execute()
      return toCurrentProfileViewModel(syncedProfile)
    } catch {
      return toCurrentProfileViewModel(updatedFromWriteEndpoint)
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<ChangeMyPasswordWithE2eeBackupRotationResult> {
    return this.changeMyPasswordUseCase.execute(oldPassword, newPassword)
  }

  async syncE2eeBackup(masterPassword: string): Promise<SyncMyE2eeBackupResult> {
    return this.syncMyE2eeBackupUseCase.execute(masterPassword)
  }

  async logout(): Promise<void> {
    return this.logoutUseCase.execute()
  }

  async completeOnboarding(): Promise<void> {
    return this.completeOnboardingUseCase.execute()
  }
}
