import type { AppInfo } from '../../domain/entities/AppInfo'
import type { AppInfoRepository } from '../../domain/repositories/AppInfoRepository'

export class GetAppInfoUseCase {
  private readonly appInfoRepository: AppInfoRepository

  constructor(appInfoRepository: AppInfoRepository) {
    this.appInfoRepository = appInfoRepository
  }

  execute(): Promise<AppInfo> {
    return this.appInfoRepository.getAppInfo()
  }
}
