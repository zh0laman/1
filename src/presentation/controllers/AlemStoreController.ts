import { AddFavoriteAppUseCase } from '../../application/use-cases/alemstore/AddFavoriteAppUseCase'
import { ClearPublicAppRatingUseCase } from '../../application/use-cases/alemstore/ClearPublicAppRatingUseCase'
import { LoadAllPublicAppsUseCase } from '../../application/use-cases/alemstore/LoadAllPublicAppsUseCase'
import { LoadFavoritePublicAppsUseCase } from '../../application/use-cases/alemstore/LoadFavoritePublicAppsUseCase'
import { RatePublicAppUseCase } from '../../application/use-cases/alemstore/RatePublicAppUseCase'
import { RemoveFavoriteAppUseCase } from '../../application/use-cases/alemstore/RemoveFavoriteAppUseCase'
import { WorkspaceFavoritesController } from './WorkspaceFavoritesController'
import type { AlemStoreViewModel } from '../view-models/AlemStoreViewModel'
import { toAlemStoreViewModel } from '../view-models/AlemStoreViewModel'

export class AlemStoreController {
  private static cache = new Map<string, AlemStoreViewModel>()
  private static cacheAtMs = new Map<string, number>()
  private static inFlight = new Map<string, Promise<AlemStoreViewModel>>()
  private static readonly cacheTtlMs = 15_000

  private readonly loadAllPublicAppsUseCase: LoadAllPublicAppsUseCase
  private readonly loadFavoritePublicAppsUseCase: LoadFavoritePublicAppsUseCase
  private readonly addFavoriteAppUseCase: AddFavoriteAppUseCase
  private readonly removeFavoriteAppUseCase: RemoveFavoriteAppUseCase
  private readonly ratePublicAppUseCase: RatePublicAppUseCase
  private readonly clearPublicAppRatingUseCase: ClearPublicAppRatingUseCase

  constructor(
    loadAllPublicAppsUseCase: LoadAllPublicAppsUseCase,
    loadFavoritePublicAppsUseCase: LoadFavoritePublicAppsUseCase,
    addFavoriteAppUseCase: AddFavoriteAppUseCase,
    removeFavoriteAppUseCase: RemoveFavoriteAppUseCase,
    ratePublicAppUseCase: RatePublicAppUseCase,
    clearPublicAppRatingUseCase: ClearPublicAppRatingUseCase,
  ) {
    this.loadAllPublicAppsUseCase = loadAllPublicAppsUseCase
    this.loadFavoritePublicAppsUseCase = loadFavoritePublicAppsUseCase
    this.addFavoriteAppUseCase = addFavoriteAppUseCase
    this.removeFavoriteAppUseCase = removeFavoriteAppUseCase
    this.ratePublicAppUseCase = ratePublicAppUseCase
    this.clearPublicAppRatingUseCase = clearPublicAppRatingUseCase
  }

  async load(options?: {
    force?: boolean
    sort?: 'position' | 'rating'
    name?: string
    downloaded?: boolean
    category?: string
  }): Promise<AlemStoreViewModel> {
    const force = options?.force ?? false
    const sort = options?.sort ?? 'position'
    const name = options?.name?.trim() ?? ''
    const downloaded =
      typeof options?.downloaded === 'boolean' ? String(options.downloaded) : 'all'
    const category = options?.category ?? ''
    const cacheKey = `public-apps:${sort}:name=${name}:downloaded=${downloaded}:category=${category}`
    const now = Date.now()
    const cached = AlemStoreController.cache.get(cacheKey) ?? null
    const cacheAtMs = AlemStoreController.cacheAtMs.get(cacheKey) ?? 0
    const isCacheFresh = cached !== null && now - cacheAtMs < AlemStoreController.cacheTtlMs

    if (!force && isCacheFresh) {
      return cached
    }

    const inFlight = AlemStoreController.inFlight.get(cacheKey)
    if (!force && inFlight) {
      return inFlight
    }

    const request = this.loadAllPublicAppsUseCase
      .execute({
        sort,
        name: name || undefined,
        downloaded: typeof options?.downloaded === 'boolean' ? options.downloaded : undefined,
        category: category || undefined,
      })
      .then(async (apps) => {
        const favorites = await this.loadFavoritePublicAppsUseCase.execute()
        const favoriteIds = new Set(favorites.map((item) => item.id))
        return apps.map((item) => ({
          ...item,
          isFavorite: item.isFavorite || favoriteIds.has(item.id),
        }))
      })
      .then((apps) => toAlemStoreViewModel(apps, { sort }))
      .then((viewModel) => {
        AlemStoreController.cache.set(cacheKey, viewModel)
        AlemStoreController.cacheAtMs.set(cacheKey, Date.now())
        return viewModel
      })
      .finally(() => {
        AlemStoreController.inFlight.delete(cacheKey)
      })

    AlemStoreController.inFlight.set(cacheKey, request)
    return request
  }

  async addToFavorites(appId: number): Promise<void> {
    await this.addFavoriteAppUseCase.execute(appId)
    this.invalidateCache()
    WorkspaceFavoritesController.invalidateCache()
  }

  async removeFromFavorites(appId: number): Promise<void> {
    await this.removeFavoriteAppUseCase.execute(appId)
    this.invalidateCache()
    WorkspaceFavoritesController.invalidateCache()
  }

  async rateApp(appId: number, rating: number): Promise<AlemStoreViewModel['apps'][number]> {
    const app = await this.ratePublicAppUseCase.execute(appId, rating)
    this.invalidateCache()
    return toAlemStoreViewModel([app]).apps[0]
  }

  async clearRating(appId: number): Promise<AlemStoreViewModel['apps'][number]> {
    const app = await this.clearPublicAppRatingUseCase.execute(appId)
    this.invalidateCache()
    return toAlemStoreViewModel([app]).apps[0]
  }

  private invalidateCache(): void {
    AlemStoreController.cache.clear()
    AlemStoreController.cacheAtMs.clear()
    AlemStoreController.inFlight.clear()
  }
}
