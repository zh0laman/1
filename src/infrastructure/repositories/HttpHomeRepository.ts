import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
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
} from '../../domain/entities/HomeDashboard'
import type { HomeRepository } from '../../domain/repositories/HomeRepository'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'

interface FavoriteDto {
  id: number | string
  app_name: string
  link: string
  app_photo: string | null
  is_favorite: boolean
  is_global: boolean
  is_private?: boolean
  web_view: boolean
  position?: number | string
  tags?: string[] | null
  average_rating?: number | string | null
  rating_count?: number | string | null
  my_rating?: number | string | null
  favorite_count?: number | string | null
  category?: string
}

interface NotificationDto {
  id: string
  title: string
  content: string
  type: string
  is_read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

interface NotificationEnvelopeDto {
  data: NotificationDto[]
}

interface UpcomingEventDto {
  id: string
  title: string
  start_time: string
  end_time: string
  location: string
  is_online: boolean
}

interface SharedItemsCountDto {
  count: number
  items?: unknown[]
}

interface WeekEventsDto {
  count: number
}

interface WeekEventsFallbackDto {
  events?: unknown[]
}

interface TodoTaskDto {
  id: string
  title: string
  status: string
  due_at?: string
  due_date?: string
  deadline?: string
}

interface TodoTasksDto {
  tasks?: TodoTaskDto[]
}

interface GamificationDto {
  period_score: number
  total_score: number
  level: number
}

export class HttpHomeRepository implements HomeRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async getPublicApps(options?: {
    sort?: 'position' | 'rating'
    name?: string
    downloaded?: boolean
    category?: string
  }): Promise<FavoriteApp[]> {
    const params = new URLSearchParams()
    if (options?.sort) {
      params.set('sort', options.sort)
    }
    if (options?.name) {
      params.set('name', options.name)
    }
    if (typeof options?.downloaded === 'boolean') {
      params.set('downloaded', String(options.downloaded))
    }
    if (options?.category) {
      params.set('category', options.category)
    }
    const query = params.toString()
    const response = await this.authorizedFetch(`/api/v1/public-apps${query ? `?${query}` : ''}`)
    const raw = (await response.json()) as unknown
    const data = HttpHomeRepository.unwrapFavoriteList(raw)
    return this.mapFavoriteApps(data)
  }

  async getFavorites(): Promise<FavoriteApp[]> {
    const response = await this.authorizedFetch('/api/v1/public-apps/favorites')
    const raw = (await response.json()) as unknown
    const data = HttpHomeRepository.unwrapFavoriteList(raw)
    return this.mapFavoriteApps(data)
  }

  async addFavoriteApp(appId: number): Promise<void> {
    await this.authorizedFetch('/api/v1/public-apps/favorites', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId }),
    })
  }

  async ratePublicApp(appId: number, rating: number): Promise<FavoriteApp> {
    const response = await this.authorizedFetch(`/api/v1/public-apps/${appId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    })
    const data = (await response.json()) as FavoriteDto
    return this.mapFavoriteApps([data])[0]
  }

  async removePublicAppRating(appId: number): Promise<FavoriteApp> {
    const response = await this.authorizedFetch(`/api/v1/public-apps/${appId}/rating`, {
      method: 'DELETE',
    })
    const data = (await response.json()) as FavoriteDto
    return this.mapFavoriteApps([data])[0]
  }

  async getNotifications(limit: number, offset: number): Promise<HomeNotification[]> {
    const response = await this.authorizedFetch(`/api/v1/notifications?limit=${limit}&offset=${offset}`)
    const raw = (await response.json()) as NotificationDto[] | NotificationEnvelopeDto
    const list = Array.isArray(raw) ? raw : raw?.data ?? []

    return list.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.type,
      isRead: item.is_read,
      createdAt: item.created_at,
      metadata: item.metadata,
    }))
  }

  async getUpcomingEvents(): Promise<HomeUpcomingEvent[]> {
    const response = await this.authorizedFetch('/api/v1/calendar/events/upcoming')
    const raw = (await response.json()) as UpcomingEventDto[] | { events: UpcomingEventDto[] }
    const data = Array.isArray(raw) ? raw : raw?.events ?? []

    return data.map((item) => ({
      id: item.id,
      title: item.title,
      startTime: item.start_time,
      endTime: item.end_time,
      location: item.location ?? '',
      isOnline: Boolean(item.is_online),
    }))
  }

  async getSharedItemsSummary(): Promise<HomeSharedItemsSummary> {
    const response = await this.authorizedFetch('/api/v1/drive/items/shared')
    const raw = (await response.json()) as SharedItemsCountDto | unknown[]

    if (Array.isArray(raw)) {
      return { count: raw.length }
    }

    return { count: Number(raw?.count ?? raw?.items?.length ?? 0) }
  }

  async getWeekEventsSummary(timezoneOffset: number): Promise<HomeWeekEventsSummary> {
    const response = await this.authorizedFetch(`/api/v1/calendar/events/this-week?timezone_offset=${timezoneOffset}`)
    const raw = (await response.json()) as WeekEventsDto | WeekEventsFallbackDto

    if (typeof (raw as WeekEventsDto).count === 'number') {
      return { count: (raw as WeekEventsDto).count }
    }

    return { count: (raw as WeekEventsFallbackDto).events?.length ?? 0 }
  }

  async getMyTodoTasks(): Promise<HomeTodoTask[]> {
    const response = await this.authorizedFetch('/api/v1/kanban/tasks/my-todo')
    const raw = (await response.json()) as TodoTaskDto[] | TodoTasksDto
    const list = Array.isArray(raw) ? raw : raw?.tasks ?? []

    return list.map((task) => ({
      id: String(task.id),
      title: task.title,
      status: task.status,
      dueAt: task.due_at ?? task.due_date ?? task.deadline,
    }))
  }

  async getGamificationStats(startDate: string, endDate: string): Promise<HomeGamificationStats> {
    const response = await this.authorizedFetch(`/api/v1/gamification/my-stats?start_date=${startDate}&end_date=${endDate}`)
    const data = (await response.json()) as GamificationDto

    return {
      periodScore: Number(data.period_score ?? 0),
      totalScore: Number(data.total_score ?? 0),
      level: Number(data.level ?? 0),
    }
  }

  async getDashboardSummary(): Promise<HomeDashboardSummaryResponse> {
    const response = await this.authorizedFetch('/api/v1/dashboard/summary')
    return response.json() as Promise<HomeDashboardSummaryResponse>
  }

  async reorderFavoriteApp(appId: number, newPosition: number): Promise<void> {
    await this.authorizedFetch('/api/v1/public-apps/reorder', {
      method: 'PUT',
      body: JSON.stringify({ app_id: appId, new_position: newPosition }),
    })
  }

  async removeFavoriteApp(appId: number): Promise<void> {
    await this.authorizedFetch(`/api/v1/public-apps/favorites/${appId}`, {
      method: 'DELETE',
    })
  }

  async searchAll(query: string, limit: number): Promise<unknown> {
    const response = await this.authorizedFetch(`/api/v1/search/all?q=${encodeURIComponent(query)}&limit=${limit}`)
    return response.json()
  }

  async getSLACompliance(period: string, boardId?: string): Promise<SLACompliance> {
    const query = new URLSearchParams({ period })
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/metrics/sla-compliance?${query.toString()}`)
    return response.json() as Promise<SLACompliance>
  }

  async getCycleTime(period: string, boardId?: string): Promise<CycleTime> {
    const query = new URLSearchParams({ period })
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/metrics/cycle-time?${query.toString()}`)
    return response.json() as Promise<CycleTime>
  }

  async getReopenRate(period: string, boardId?: string): Promise<ReopenRate> {
    const query = new URLSearchParams({ period })
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/metrics/reopen-rate?${query.toString()}`)
    return response.json() as Promise<ReopenRate>
  }

  async getWorkloadDistribution(groupBy: string, boardId?: string): Promise<WorkloadDistribution> {
    const query = new URLSearchParams({ group_by: groupBy })
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/metrics/workload-distribution?${query.toString()}`)
    return response.json() as Promise<WorkloadDistribution>
  }

  async getCapacity(boardId?: string): Promise<Capacity> {
    const query = new URLSearchParams()
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/metrics/capacity?${query.toString()}`)
    return response.json() as Promise<Capacity>
  }

  async getEfficiencyTrend(period: string, boardId?: string): Promise<EfficiencyTrend> {
    const query = new URLSearchParams({ period })
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/metrics/efficiency-trend?${query.toString()}`)
    return response.json() as Promise<EfficiencyTrend>
  }

  async getOverdueTasks(boardId?: string): Promise<OverdueTask[]> {
    const query = new URLSearchParams()
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/tasks/overdue?${query.toString()}`)
    const data = await response.json() as { tasks: OverdueTask[] }
    return data.tasks || []
  }

  async getStaleTasks(thresholdDays: number, boardId?: string): Promise<StaleTask[]> {
    const query = new URLSearchParams({ threshold_days: String(thresholdDays) })
    if (boardId) query.set('board_id', boardId)
    const response = await this.authorizedFetch(`/api/v1/tasks/stale?${query.toString()}`)
    const data = await response.json() as { tasks: StaleTask[] }
    return data.tasks || []
  }

  /** Бэкенд может отдать массив или обёртку `{ data: [...] }`. */
  private static unwrapFavoriteList(raw: unknown): FavoriteDto[] {
    if (Array.isArray(raw)) {
      return raw as FavoriteDto[]
    }
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>
      const nested = o.data ?? o.items ?? o.favorites
      if (Array.isArray(nested)) {
        return nested as FavoriteDto[]
      }
    }
    return []
  }

  private mapFavoriteApps(data: FavoriteDto[] | null | undefined): FavoriteApp[] {
    return (data ?? []).map((item) => ({
      id: Number(item.id),
      appName: item.app_name,
      link: item.link,
      appPhoto: normalizeBackendAssetUrl(item.app_photo) ?? null,
      isFavorite: item.is_favorite,
      isGlobal: item.is_global,
      isPrivate: Boolean(item.is_private),
      webView: item.web_view,
      position: typeof item.position === 'undefined' ? undefined : Number(item.position),
      tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
      averageRating: Number(item.average_rating ?? 0),
      ratingCount: Number(item.rating_count ?? 0),
      myRating:
        item.my_rating === null || typeof item.my_rating === 'undefined' ? null : Number(item.my_rating),
      favoriteCount: Number(item.favorite_count ?? 0),
      category: item.category ?? '',
    }))
  }

  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return authorizedFetch(this.sessionStore, path, init)
  }
}
