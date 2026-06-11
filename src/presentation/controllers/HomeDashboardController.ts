import { LoadHomeDashboardUseCase } from '../../application/use-cases/dashboard/LoadHomeDashboardUseCase'
import type { HomeDashboardViewModel } from '../view-models/HomeDashboardViewModel'
import { toHomeDashboardViewModel } from '../view-models/HomeDashboardViewModel'

export class HomeDashboardController {
  private readonly loadHomeDashboardUseCase: LoadHomeDashboardUseCase
  private static cachedValue: HomeDashboardViewModel | null = null
  private static cachedAtMs = 0
  private static inFlight: Promise<HomeDashboardViewModel> | null = null
  private static readonly cacheTtlMs = 15_000

  constructor(loadHomeDashboardUseCase: LoadHomeDashboardUseCase) {
    this.loadHomeDashboardUseCase = loadHomeDashboardUseCase
  }

  async load(options?: { force?: boolean, period?: string, boardId?: string }): Promise<HomeDashboardViewModel> {
    const force = options?.force ?? false
    const period = options?.period ?? 'week'
    const boardId = options?.boardId ?? ''
    const now = Date.now()
    
    // We only use cache if it's the same parameters
    const cachedValue = HomeDashboardController.cachedValue
    const isCacheFresh =
      cachedValue !== null &&
      now - HomeDashboardController.cachedAtMs < HomeDashboardController.cacheTtlMs

    if (!force && isCacheFresh) {
      return cachedValue
    }

    if (!force && HomeDashboardController.inFlight) {
      return HomeDashboardController.inFlight
    }

    const request = this.loadHomeDashboardUseCase
      .execute(period, boardId)
      .then((data) => toHomeDashboardViewModel(data))
      .then((viewModel) => {
        HomeDashboardController.cachedValue = viewModel
        HomeDashboardController.cachedAtMs = Date.now()
        return viewModel
      })
      .finally(() => {
        HomeDashboardController.inFlight = null
      })

    HomeDashboardController.inFlight = request
    return request
  }

  static clearCache(): void {
    HomeDashboardController.cachedValue = null
    HomeDashboardController.cachedAtMs = 0
    HomeDashboardController.inFlight = null
  }
}
