export interface FavoriteApp {
  id: number
  appName: string
  link: string
  appPhoto: string | null
  isFavorite: boolean
  isGlobal: boolean
  isPrivate?: boolean
  webView: boolean
  position?: number
  category?: string
  tags?: string[]
  averageRating?: number
  ratingCount?: number
  myRating?: number | null
  favoriteCount?: number
}

export interface HomeNotification {
  id: string
  title: string
  content: string
  type: string
  isRead: boolean
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface HomeUpcomingEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  location: string
  isOnline: boolean
}

export interface HomeTodoTask {
  id: string
  title: string
  status: string
  dueAt?: string
}

export interface HomeWeekEventsSummary {
  count: number
}

export interface HomeSharedItemsSummary {
  count: number
}

export interface HomeGamificationStats {
  periodScore: number
  totalScore: number
  level: number
}

export interface DashboardMetric {
  count: number
  trend_percentage: number
  sparkline?: number[]
}

export interface DashboardPoints extends DashboardMetric {
  today_points: number
}

export interface DashboardDataset {
  name: string
  data: number[]
}

export interface DashboardEfficiencyDynamics {
  average_load: number
  labels: string[]
  datasets: DashboardDataset[]
}

export interface DashboardTaskStat {
  label: string
  count: number
}

export interface DashboardTaskStructure {
  total_count: number
  stats: DashboardTaskStat[]
}

export interface DashboardCompletionProgress {
  completed_count: number
  total_count: number
  percentage: number
}

export interface DashboardSummary {
  active_tasks: DashboardMetric
  meetings_today: DashboardMetric
  documents: DashboardMetric
  weekly_points: DashboardPoints
}

export interface HomeDashboardSummaryResponse {
  summary: DashboardSummary
  efficiency_dynamics: DashboardEfficiencyDynamics
  task_structure: DashboardTaskStructure
  completion_progress: DashboardCompletionProgress
}

export interface SLACompliance {
  total_closed: number
  closed_on_time: number
  closed_overdue: number
  compliance_percent: number
}

export interface CycleTime {
  avg_cycle_hours: number
  avg_cycle_days: number
  median_cycle_hours: number
  sample_size: number
}

export interface ReopenRate {
  total_tasks: number
  reopened_count: number
  reopen_rate_percent: number
}

export interface TimeInStatusItem {
  status: string
  avg_hours: number
  avg_days: number
  task_count: number
}

export interface WorkloadDistribution {
  items: Array<{ key: string; name: string; count: number; percent: number }>
}

export interface Capacity {
  usage_percent: number
  active_task_count: number
  wip_limit: number
  by_assignee?: Array<{ full_name: string; active_tasks: number; usage_percent: number }>
}

export interface EfficiencyTrend {
  data_points: Array<{
    date: string
    efficiency_percent: number
    completed_tasks: number
    total_active: number
  }>
}

export interface OverdueTask {
  id: string
  task_key: string
  title: string
  due_at: string
  days_overdue: number
}

export interface StaleTask {
  id: string
  task_key: string
  title: string
  last_activity: string
  days_since_last_activity: number
}

export interface HomeDashboardData {
  favorites: FavoriteApp[]
  notifications: HomeNotification[]
  upcomingEvents: HomeUpcomingEvent[]
  sharedItems: HomeSharedItemsSummary
  weekEvents: HomeWeekEventsSummary
  myTodoTasks: HomeTodoTask[]
  gamification: HomeGamificationStats
  summary?: HomeDashboardSummaryResponse
  // Advanced metrics
  sla?: SLACompliance
  cycleTime?: CycleTime
  reopenRate?: ReopenRate
  workload?: WorkloadDistribution
  capacity?: Capacity
  efficiencyTrend?: EfficiencyTrend
  overdueTasks?: OverdueTask[]
  staleTasks?: StaleTask[]
}
