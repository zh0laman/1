import type { HomeDashboardData } from '../../../domain/entities/HomeDashboard'
import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

const formatYmd = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export class LoadHomeDashboardUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(period: string = 'week', boardId: string = ''): Promise<HomeDashboardData> {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)
    const timezoneOffset = -new Date().getTimezoneOffset()

    const [
      favorites, notifications, upcomingEvents, sharedItems, weekEvents, myTodoTasks, gamification, summary,
      sla, cycleTime, reopenRate, workload, capacity, efficiencyTrend, overdueTasks, staleTasks
    ] = await Promise.all([
      this.homeRepository.getFavorites(),
      this.homeRepository.getNotifications(50, 0),
      this.homeRepository.getUpcomingEvents(),
      this.homeRepository.getSharedItemsSummary(),
      this.homeRepository.getWeekEventsSummary(timezoneOffset),
      this.homeRepository.getMyTodoTasks(),
      this.homeRepository.getGamificationStats(formatYmd(weekStart), formatYmd(now)),
      this.homeRepository.getDashboardSummary(),
      this.homeRepository.getSLACompliance(period, boardId),
      this.homeRepository.getCycleTime(period, boardId),
      this.homeRepository.getReopenRate(period, boardId),
      this.homeRepository.getWorkloadDistribution('priority', boardId),
      this.homeRepository.getCapacity(boardId),
      this.homeRepository.getEfficiencyTrend(period, boardId),
      this.homeRepository.getOverdueTasks(boardId),
      this.homeRepository.getStaleTasks(7, boardId),
    ])

    return {
      favorites,
      notifications,
      upcomingEvents,
      sharedItems,
      weekEvents,
      myTodoTasks,
      gamification,
      summary,
      sla,
      cycleTime,
      reopenRate,
      workload,
      capacity,
      efficiencyTrend,
      overdueTasks,
      staleTasks,
    }
  }
}
