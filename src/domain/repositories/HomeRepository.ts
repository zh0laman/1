import type {
  FavoriteApp,
  HomeGamificationStats,
  HomeNotification,
  HomeSharedItemsSummary,
  HomeTodoTask,
  HomeUpcomingEvent,
  HomeWeekEventsSummary,
  HomeDashboardSummaryResponse,
  SLACompliance,
  CycleTime,
  ReopenRate,
  WorkloadDistribution,
  Capacity,
  EfficiencyTrend,
  OverdueTask,
  StaleTask,
} from '../entities/HomeDashboard'

export interface HomeRepository {
  getPublicApps(options?: {
    sort?: 'position' | 'rating'
    name?: string
    downloaded?: boolean
    category?: string
  }): Promise<FavoriteApp[]>
  getFavorites(): Promise<FavoriteApp[]>
  addFavoriteApp(appId: number): Promise<void>
  ratePublicApp(appId: number, rating: number): Promise<FavoriteApp>
  removePublicAppRating(appId: number): Promise<FavoriteApp>
  getNotifications(limit: number, offset: number): Promise<HomeNotification[]>
  getUpcomingEvents(): Promise<HomeUpcomingEvent[]>
  getSharedItemsSummary(): Promise<HomeSharedItemsSummary>
  getWeekEventsSummary(timezoneOffset: number): Promise<HomeWeekEventsSummary>
  getMyTodoTasks(): Promise<HomeTodoTask[]>
  getGamificationStats(startDate: string, endDate: string): Promise<HomeGamificationStats>
  getDashboardSummary(): Promise<HomeDashboardSummaryResponse>
  reorderFavoriteApp(appId: number, newPosition: number): Promise<void>
  removeFavoriteApp(appId: number): Promise<void>
  searchAll(query: string, limit: number): Promise<unknown>

  // Advanced Metrics
  getSLACompliance(period: string, boardId?: string): Promise<SLACompliance>
  getCycleTime(period: string, boardId?: string): Promise<CycleTime>
  getReopenRate(period: string, boardId?: string): Promise<ReopenRate>
  getWorkloadDistribution(groupBy: string, boardId?: string): Promise<WorkloadDistribution>
  getCapacity(boardId?: string): Promise<Capacity>
  getEfficiencyTrend(period: string, boardId?: string): Promise<EfficiencyTrend>
  getOverdueTasks(boardId?: string): Promise<OverdueTask[]>
  getStaleTasks(thresholdDays: number, boardId?: string): Promise<StaleTask[]>
}
