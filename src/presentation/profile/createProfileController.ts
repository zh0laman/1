import { CreateEducationUseCase } from '../../application/use-cases/profile/CreateEducationUseCase'
import { CreateLicenseCertificationUseCase } from '../../application/use-cases/profile/CreateLicenseCertificationUseCase'
import { ChangeMyPasswordUseCase } from '../../application/use-cases/profile/ChangeMyPasswordUseCase'
import { ChangeMyPasswordWithE2eeBackupRotationUseCase } from '../../application/use-cases/profile/ChangeMyPasswordWithE2eeBackupRotationUseCase'
import { DeleteEducationUseCase } from '../../application/use-cases/profile/DeleteEducationUseCase'
import { DeleteLicenseCertificationUseCase } from '../../application/use-cases/profile/DeleteLicenseCertificationUseCase'
import { GetCurrentProfileUseCase } from '../../application/use-cases/profile/GetCurrentProfileUseCase'
import { LoadMyEducationsUseCase } from '../../application/use-cases/profile/LoadMyEducationsUseCase'
import { LoadProfileHrByIinUseCase } from '../../application/use-cases/profile/LoadProfileHrByIinUseCase'
import { LoadMyLicenseCertificationsUseCase } from '../../application/use-cases/profile/LoadMyLicenseCertificationsUseCase'
import { LoadProfileStatsUseCase } from '../../application/use-cases/profile/LoadProfileStatsUseCase'
import { LoadProfileUserUseCase } from '../../application/use-cases/profile/LoadProfileUserUseCase'
import { SyncMyE2eeBackupUseCase } from '../../application/use-cases/profile/SyncMyE2eeBackupUseCase'
import { UpdateEducationUseCase } from '../../application/use-cases/profile/UpdateEducationUseCase'
import { UpdateLicenseCertificationUseCase } from '../../application/use-cases/profile/UpdateLicenseCertificationUseCase'
import { UpdateMyAvatarUseCase } from '../../application/use-cases/profile/UpdateMyAvatarUseCase'
import { UpdateMyStatusUseCase } from '../../application/use-cases/profile/UpdateMyStatusUseCase'
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase'
import { CompleteOnboardingUseCase } from '../../application/use-cases/auth/CompleteOnboardingUseCase'
import { HttpAuthRepository } from '../../infrastructure/repositories/HttpAuthRepository'
import { HttpProfileRepository } from '../../infrastructure/repositories/HttpProfileRepository'
import { IndexedDbKeyStore } from '../../infrastructure/storage/IndexedDbKeyStore'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { WebDeviceSessionStore } from '../../infrastructure/storage/WebDeviceSessionStore'
import { ProfileController } from '../controllers/ProfileController'
import { ProfileSettingsController } from '../controllers/ProfileSettingsController'

export const createProfileController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const profileRepository = new HttpProfileRepository(sessionStore)
  const authRepository = new HttpAuthRepository()
  const keyStore = new IndexedDbKeyStore()
  const webDeviceSessionStore = new WebDeviceSessionStore()

  const loadProfileUserUseCase = new LoadProfileUserUseCase(profileRepository)
  const loadProfileHrByIinUseCase = new LoadProfileHrByIinUseCase(profileRepository)
  const loadProfileStatsUseCase = new LoadProfileStatsUseCase(profileRepository)
  const loadMyEducationsUseCase = new LoadMyEducationsUseCase(profileRepository)
  const loadMyLicenseCertificationsUseCase = new LoadMyLicenseCertificationsUseCase(profileRepository)
  const createEducationUseCase = new CreateEducationUseCase(profileRepository)
  const createLicenseCertificationUseCase = new CreateLicenseCertificationUseCase(profileRepository)
  const updateEducationUseCase = new UpdateEducationUseCase(profileRepository)
  const updateLicenseCertificationUseCase = new UpdateLicenseCertificationUseCase(profileRepository)
  const deleteEducationUseCase = new DeleteEducationUseCase(profileRepository)
  const deleteLicenseCertificationUseCase = new DeleteLicenseCertificationUseCase(profileRepository)
  const getCurrentProfileUseCase = new GetCurrentProfileUseCase(profileRepository)
  const updateMyStatusUseCase = new UpdateMyStatusUseCase(profileRepository)
  const updateMyAvatarUseCase = new UpdateMyAvatarUseCase(profileRepository)
  const changeMyPasswordUseCase = new ChangeMyPasswordUseCase(profileRepository)
  const changeMyPasswordWithE2eeBackupRotationUseCase = new ChangeMyPasswordWithE2eeBackupRotationUseCase(
    changeMyPasswordUseCase,
    authRepository,
    sessionStore,
    keyStore,
    webDeviceSessionStore,
  )
  const syncMyE2eeBackupUseCase = new SyncMyE2eeBackupUseCase(
    authRepository,
    sessionStore,
    keyStore,
    webDeviceSessionStore,
  )
  const logoutUseCase = new LogoutUseCase(authRepository, sessionStore)
  const completeOnboardingUseCase = new CompleteOnboardingUseCase(authRepository)

  const profileController = new ProfileController(
    loadProfileUserUseCase,
    loadProfileHrByIinUseCase,
    loadProfileStatsUseCase,
    loadMyEducationsUseCase,
    loadMyLicenseCertificationsUseCase,
    createEducationUseCase,
    createLicenseCertificationUseCase,
    updateEducationUseCase,
    updateLicenseCertificationUseCase,
    deleteEducationUseCase,
    deleteLicenseCertificationUseCase,
  )
  const profileSettingsController = new ProfileSettingsController(
    getCurrentProfileUseCase,
    updateMyStatusUseCase,
    updateMyAvatarUseCase,
    changeMyPasswordWithE2eeBackupRotationUseCase,
    syncMyE2eeBackupUseCase,
    logoutUseCase,
    completeOnboardingUseCase,
  )

  return {
    profileController,
    profileSettingsController,
    sessionStore,
  }
}
