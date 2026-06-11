import type { FavoriteApp } from '../../domain/entities/HomeDashboard'

export interface WorkspaceFavoriteAppViewModel {
  id: number
  appName: string
  link: string
  appPhoto: string | null
  isGlobal: boolean
  webView: boolean
  position: number
  tags: string[]
  averageRating: number
  ratingCount: number
  myRating: number | null
  favoriteCount: number
}

export interface WorkspaceFavoritesViewModel {
  apps: WorkspaceFavoriteAppViewModel[]
}

const byPositionThenName = (a: WorkspaceFavoriteAppViewModel, b: WorkspaceFavoriteAppViewModel): number => {
  if (a.position !== b.position) {
    return a.position - b.position
  }
  return a.appName.localeCompare(b.appName, 'ru')
}

export const toWorkspaceFavoritesViewModel = (apps: FavoriteApp[]): WorkspaceFavoritesViewModel => {
  const mapped = apps.map((app, index) => ({
    id: app.id,
    appName: app.appName,
    link: app.link,
    appPhoto: app.appPhoto,
    isGlobal: app.isGlobal,
    webView: app.webView,
    position: app.position ?? index + 1,
    tags: Array.isArray(app.tags) ? app.tags : [],
    averageRating: Number(app.averageRating ?? 0),
    ratingCount: Number(app.ratingCount ?? 0),
    myRating: app.myRating === null || typeof app.myRating === 'undefined' ? null : Number(app.myRating),
    favoriteCount: Number(app.favoriteCount ?? 0),
  }))

  mapped.sort(byPositionThenName)

  return {
    apps: mapped.map((item, index) => ({
      ...item,
      position: index + 1,
    })),
  }
}
