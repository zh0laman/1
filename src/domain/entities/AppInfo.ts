export type AppStatus = 'healthy' | 'degraded' | 'down'

export interface AppInfo {
  name: string
  version: string
  status: AppStatus
}
