import type { AppInfo } from '../../domain/entities/AppInfo'
import type { AppInfoRepository } from '../../domain/repositories/AppInfoRepository'

export class StaticAppInfoRepository implements AppInfoRepository {
  async getAppInfo(): Promise<AppInfo> {
    await new Promise((resolve) => setTimeout(resolve, 250))

    return {
      name: 'SuperApp',
      version: '1.0.0',
      status: 'healthy',
    }
  }
}
