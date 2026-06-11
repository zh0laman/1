import type { AppInfo, AppStatus } from '../../domain/entities/AppInfo'

const statusLabel: Record<AppStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
}

export interface AppInfoViewModel {
  title: string
  subtitle: string
  statusText: string
  statusClassName: string
}

export const toAppInfoViewModel = (appInfo: AppInfo): AppInfoViewModel => ({
  title: appInfo.name,
  subtitle: `Version ${appInfo.version}`,
  statusText: statusLabel[appInfo.status],
  statusClassName: `status status--${appInfo.status}`,
})
