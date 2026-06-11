import type { AppInfo } from '../entities/AppInfo'

export interface AppInfoRepository {
  getAppInfo(): Promise<AppInfo>
}
