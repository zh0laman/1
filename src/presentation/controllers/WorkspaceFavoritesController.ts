import { ClearWorkspaceFavoriteRatingUseCase } from '../../application/use-cases/workspace/ClearWorkspaceFavoriteRatingUseCase'
import { LoadWorkspaceFavoritesUseCase } from '../../application/use-cases/workspace/LoadWorkspaceFavoritesUseCase'
import { RateWorkspaceFavoriteUseCase } from '../../application/use-cases/workspace/RateWorkspaceFavoriteUseCase'
import { RemoveWorkspaceFavoriteUseCase } from '../../application/use-cases/workspace/RemoveWorkspaceFavoriteUseCase'
import { ReorderWorkspaceFavoriteUseCase } from '../../application/use-cases/workspace/ReorderWorkspaceFavoriteUseCase'
import type { WorkspaceFavoritesViewModel } from '../view-models/WorkspaceFavoritesViewModel'
import { toWorkspaceFavoritesViewModel } from '../view-models/WorkspaceFavoritesViewModel'

export class WorkspaceFavoritesController {
  private static cache: WorkspaceFavoritesViewModel | null = null
  private static cacheAtMs = 0
  private static inFlight: Promise<WorkspaceFavoritesViewModel> | null = null
  private static readonly cacheTtlMs = 15_000

  private readonly loadWorkspaceFavoritesUseCase: LoadWorkspaceFavoritesUseCase
  private readonly reorderWorkspaceFavoriteUseCase: ReorderWorkspaceFavoriteUseCase
  private readonly removeWorkspaceFavoriteUseCase: RemoveWorkspaceFavoriteUseCase
  private readonly rateWorkspaceFavoriteUseCase: RateWorkspaceFavoriteUseCase
  private readonly clearWorkspaceFavoriteRatingUseCase: ClearWorkspaceFavoriteRatingUseCase

  static invalidateCache(): void {
    WorkspaceFavoritesController.cache = null
    WorkspaceFavoritesController.cacheAtMs = 0
    WorkspaceFavoritesController.inFlight = null
  }

  constructor(
    loadWorkspaceFavoritesUseCase: LoadWorkspaceFavoritesUseCase,
    reorderWorkspaceFavoriteUseCase: ReorderWorkspaceFavoriteUseCase,
    removeWorkspaceFavoriteUseCase: RemoveWorkspaceFavoriteUseCase,
    rateWorkspaceFavoriteUseCase: RateWorkspaceFavoriteUseCase,
    clearWorkspaceFavoriteRatingUseCase: ClearWorkspaceFavoriteRatingUseCase,
  ) {
    this.loadWorkspaceFavoritesUseCase = loadWorkspaceFavoritesUseCase
    this.reorderWorkspaceFavoriteUseCase = reorderWorkspaceFavoriteUseCase
    this.removeWorkspaceFavoriteUseCase = removeWorkspaceFavoriteUseCase
    this.rateWorkspaceFavoriteUseCase = rateWorkspaceFavoriteUseCase
    this.clearWorkspaceFavoriteRatingUseCase = clearWorkspaceFavoriteRatingUseCase
  }

  async load(options?: { force?: boolean }): Promise<WorkspaceFavoritesViewModel> {
    const force = options?.force ?? false
    const now = Date.now()
    const cached = WorkspaceFavoritesController.cache
    const isCacheFresh =
      cached !== null &&
      now - WorkspaceFavoritesController.cacheAtMs < WorkspaceFavoritesController.cacheTtlMs

    if (!force && isCacheFresh) {
      return cached
    }

    if (!force && WorkspaceFavoritesController.inFlight) {
      return WorkspaceFavoritesController.inFlight
    }

    const request = this.loadWorkspaceFavoritesUseCase
      .execute()
      .then((apps) => toWorkspaceFavoritesViewModel(apps))
      .then((viewModel) => {
        WorkspaceFavoritesController.cache = viewModel
        WorkspaceFavoritesController.cacheAtMs = Date.now()
        return viewModel
      })
      .finally(() => {
        WorkspaceFavoritesController.inFlight = null
      })

    WorkspaceFavoritesController.inFlight = request
    return request
  }

  async reorder(appId: number, newPosition: number): Promise<void> {
    await this.reorderWorkspaceFavoriteUseCase.execute(appId, newPosition)
    WorkspaceFavoritesController.invalidateCache()
  }

  async remove(appId: number): Promise<void> {
    await this.removeWorkspaceFavoriteUseCase.execute(appId)
    WorkspaceFavoritesController.invalidateCache()
  }

  async rate(appId: number, rating: number): Promise<WorkspaceFavoritesViewModel['apps'][number]> {
    const app = await this.rateWorkspaceFavoriteUseCase.execute(appId, rating)
    WorkspaceFavoritesController.invalidateCache()
    return toWorkspaceFavoritesViewModel([app]).apps[0]
  }

  async clearRating(appId: number): Promise<WorkspaceFavoritesViewModel['apps'][number]> {
    const app = await this.clearWorkspaceFavoriteRatingUseCase.execute(appId)
    WorkspaceFavoritesController.invalidateCache()
    return toWorkspaceFavoritesViewModel([app]).apps[0]
  }
}
