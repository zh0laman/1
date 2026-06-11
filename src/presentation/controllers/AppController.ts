import type { AppInfoViewModel } from '../view-models/AppInfoViewModel'
import { toAppInfoViewModel } from '../view-models/AppInfoViewModel'
import { GetAppInfoUseCase } from '../../application/use-cases/GetAppInfoUseCase'

export class AppController {
  private readonly getAppInfoUseCase: GetAppInfoUseCase

  constructor(getAppInfoUseCase: GetAppInfoUseCase) {
    this.getAppInfoUseCase = getAppInfoUseCase
  }

  async loadAppInfo(): Promise<AppInfoViewModel> {
    const appInfo = await this.getAppInfoUseCase.execute()
    return toAppInfoViewModel(appInfo)
  }
}
