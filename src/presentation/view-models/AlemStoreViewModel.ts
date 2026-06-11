import type { FavoriteApp } from '../../domain/entities/HomeDashboard'

export interface AlemStoreAppViewModel {
  id: number
  appName: string
  link: string
  appPhoto: string | null
  isGlobal: boolean
  isPrivate: boolean
  isFavorite: boolean
  webView: boolean
  position: number
  tags: string[]
  averageRating: number
  ratingCount: number
  myRating: number | null
  favoriteCount: number
  category: string
}

export interface AlemStoreViewModel {
  apps: AlemStoreAppViewModel[]
}

const byPositionThenName = (a: AlemStoreAppViewModel, b: AlemStoreAppViewModel): number => {
  if (a.position !== b.position) {
    return a.position - b.position
  }
  return a.appName.localeCompare(b.appName, 'ru')
}

const byRatingThenPosition = (a: AlemStoreAppViewModel, b: AlemStoreAppViewModel): number => {
  if (a.averageRating !== b.averageRating) {
    return b.averageRating - a.averageRating
  }
  if (a.ratingCount !== b.ratingCount) {
    return b.ratingCount - a.ratingCount
  }
  if (a.position !== b.position) {
    return a.position - b.position
  }
  return b.id - a.id
}

export const toAlemStoreViewModel = (
  apps: FavoriteApp[],
  options?: { sort?: 'position' | 'rating' },
): AlemStoreViewModel => {
  const mapped = apps.map((app, index) => ({
    id: app.id,
    appName: app.appName,
    link: app.link,
    appPhoto: app.appPhoto,
    isGlobal: app.isGlobal,
    isPrivate: Boolean(app.isPrivate),
    isFavorite: app.isFavorite,
    webView: app.webView,
    position: app.position ?? index + 1,
    tags: Array.isArray(app.tags) ? app.tags : [],
    averageRating: Number(app.averageRating ?? 0),
    ratingCount: Number(app.ratingCount ?? 0),
    myRating:
      app.myRating === null || typeof app.myRating === 'undefined' ? null : Number(app.myRating),
    favoriteCount: Number(app.favoriteCount ?? 0),
    category: app.category ?? '',
  }))

  if (options?.sort === 'rating') {
    mapped.sort(byRatingThenPosition)
  } else {
    mapped.sort(byPositionThenName)
  }

  return {
    apps: mapped,
  }
}
