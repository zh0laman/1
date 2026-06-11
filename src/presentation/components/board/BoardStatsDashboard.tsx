import type { BoardStatsViewModel } from '../../view-models/BoardViewModel'
import type { KanbanBoardStatsResponse } from '../../../domain/entities/AiTools'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { StatCard } from './stats/StatCard'
import { ChartCard } from './stats/ChartCard'
import { formatHours, getScoreColor } from './stats/StatUtils'

interface BoardStatsDashboardProps {
  stats: BoardStatsViewModel
  aiStats?: KanbanBoardStatsResponse | null
  onClose: () => void
}

const COLORS = ['#1E88E5', '#10B981', '#F59E0B', '#EF4444', '#7C3AED', '#64748B']

export default function BoardStatsDashboard({ stats, aiStats, onClose }: BoardStatsDashboardProps) {
  const { summary, byStatus, byPriority, byDeadline, employees, activity, worklogs } = stats
  const topEmployees = employees.slice(0, 8)
  const totalWorklogLabel = worklogs.length
    ? worklogs.reduce((sum, item) => sum + item.totalSeconds, 0)
    : 0

  const localizedPriorities = byPriority.map((p) => {
    const name = String(p.name || '').toLowerCase().trim()
    let localized = p.name || 'Без приоритета'
    if (name === 'critical') localized = 'КРИТИЧЕСКИЙ'
    if (name === 'high') localized = 'ВЫСОКИЙ'
    if (name === 'medium') localized = 'СРЕДНИЙ'
    if (name === 'low') localized = 'НИЗКИЙ'
    return { ...p, localizedName: localized }
  })

  const localizedActivity = activity.map((a) => {
    const action = String(a.action || '').toLowerCase().trim()
    let localized = a.action || 'Другое'
    if (action === 'moved') localized = 'ПЕРЕМЕЩЕНО'
    if (action === 'assigned') localized = 'НАЗНАЧЕНО'
    if (action === 'created') localized = 'СОЗДАНО'
    if (action === 'updated') localized = 'ОБНОВЛЕНО'
    if (action === 'unassigned') localized = 'СНЯТО'
    if (action === 'comment_added') localized = 'КОММЕНТАРИЙ'
    if (action === 'attachment_added') localized = 'ФАЙЛ'
    if (action === 'deleted') localized = 'УДАЛЕНО'
    return { ...a, localizedName: localized }
  })

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-[#091728]/55 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#DCE4F1] bg-[#F3F6FB] shadow-[0_24px_70_rgba(10,22,40,0.35)]">
        <header className="flex items-center justify-between border-b border-[#E1E7F2] bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <MaterialSymbol name="analytics" size={24} color="#1E88E5" />
            <h2 className="text-lg font-bold text-red-600">СТАТИСТИКА ДОСКИ</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE3EE] bg-white text-[#4D6486] transition hover:bg-[#F3F7FE]"
            aria-label="Закрыть"
          >
            <MaterialSymbol name="close" size={18} color="currentColor" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 mb-6">
            <StatCard label="Всего задач" value={summary.totalTasks} icon="task" color="#1E88E5" />
            <StatCard label="Выполнено" value={summary.completedTasks} subValue={`${summary.completionPercent}%`} icon="check_circle" color="#10B981" />
            <StatCard label="В работе" value={summary.activeTasks} icon="engineering" color="#F59E0B" />
            <StatCard label="Просрочено" value={summary.overdueTasks} icon="event_busy" color="#EF4444" />
            <StatCard label="Затрачено" value={summary.totalSpentLabel} icon="timer" color="#7C3AED" />
            <StatCard label="Worklog" value={formatHours(totalWorklogLabel)} icon="schedule" color="#64748B" />
          </div>

          {aiStats && (
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm border border-[#E1E7F2]">
              <div className="flex items-center gap-2 mb-4">
                <MaterialSymbol name="smart_toy" size={20} color="#1E88E5" />
                <h3 className="text-sm font-bold text-[#0A1628] uppercase tracking-wider">AI Аналитика Доски</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#F0F7FF] border border-[#D0E5FF]">
                  <div className="text-xs font-bold text-[#1E88E5] uppercase mb-1">Завершено в этом месяце</div>
                  <div className="text-2xl font-bold text-[#0A1628]">{aiStats.summary.closed_this_month}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7]">
                  <div className="text-xs font-bold text-[#15803D] uppercase mb-1">Метрика таймлайна</div>
                  <div className="text-sm font-semibold text-[#166534]">{aiStats.timeline_metric === 'closed_tasks' ? 'Закрытые задачи' : 'Обновленные задачи'}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5]">
                  <div className="text-xs font-bold text-[#9A3412] uppercase mb-1">Режим расчета</div>
                  <div className="text-sm font-semibold text-[#7C2D12]">{aiStats.stats_mode}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-xs font-bold text-[#475569] uppercase mb-1">Всего задач (AI)</div>
                  <div className="text-2xl font-bold text-[#0A1628]">{aiStats.summary.total_tasks}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Рейтинг сотрудников" className="lg:col-span-2">
              <div className="h-[280px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={topEmployees} margin={{ left: 8, right: 24, top: 8, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="fullName" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={54} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`${value}`, 'Оценка']} />
                    <Bar dataKey="productivityScore" radius={[6, 6, 0, 0]}>
                      {topEmployees.map((emp) => (
                        <Cell key={emp.userId} fill={getScoreColor(emp.productivityScore)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Status Distribution */}
            <ChartCard title="Задачи по статусам">
              <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {byStatus.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Priority Distribution */}
            <ChartCard title="Распределение по приоритетам">
              <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={localizedPriorities} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="localizedName" type="category" width={80} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#F1F5F9' }} formatter={(value, _name, props) => [value, props.payload.localizedName]} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {localizedPriorities.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'critical' ? '#EF4444' : entry.name === 'high' ? '#F97316' : entry.name === 'medium' ? '#F59E0B' : '#10B981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Сроки">
              <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={byDeadline} margin={{ left: 0, right: 24, top: 8, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Employee Performance */}
            <ChartCard title="Оценка сотрудников: кто как работает" className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Сотрудник</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Назначено</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Выполнено</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Активно</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Просрочено</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Создал</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Логи</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Оценка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.userId} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EBF4FE] text-[11px] font-bold text-[#1E88E5]">
                              {emp.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-[#0A1628]">{emp.fullName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#0A1628]">{emp.assignedTasks}</td>
                        <td className="py-3 px-4 text-sm text-[#10B981] font-bold">{emp.completedTasks} <span className="text-[11px] text-[#64748B]">({emp.completionPercent}%)</span></td>
                        <td className="py-3 px-4 text-sm text-[#0A1628]">{emp.activeTasks}</td>
                        <td className="py-3 px-4 text-sm text-[#EF4444]">{emp.overdueTasks} <span className="text-[11px] text-[#64748B]">({emp.overduePercent}%)</span></td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{emp.createdTasks}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{emp.worklogLabel}</td>
                        <td className="py-3 px-4">
                          <div className="flex min-w-[180px] items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                              <div
                                className="h-full"
                                style={{ width: `${Math.min(100, emp.productivityScore)}%`, backgroundColor: getScoreColor(emp.productivityScore) }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[#1E88E5]">{emp.productivityScore}</span>
                            <span
                              className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold ${emp.productivityClassName}`}
                            >
                              {emp.productivityLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-[#8A9BB5]">
                            оценка {emp.totalEstimateLabel} · факт {emp.totalSpentLabel}
                          </div>
                          {aiStats && aiStats.users.find(u => u.user_id === emp.userId)?.ai_summary && (
                            <div className="mt-2 p-2 rounded-lg bg-[#F0F7FF] border border-[#D0E5FF] text-[10px] text-[#1E88E5] italic leading-relaxed">
                              <div className="flex items-center gap-1 mb-1">
                                <MaterialSymbol name="auto_awesome" size={12} />
                                <span className="font-bold uppercase">AI Резюме</span>
                              </div>
                              {aiStats.users.find(u => u.user_id === emp.userId)?.ai_summary}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8497B4]">
                          Нет данных по сотрудникам
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            <ChartCard title="Worklog по дням" className="lg:col-span-2">
              <div className="h-[240px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={worklogs} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(_, __, item) => [item.payload.totalLabel, 'Время']} />
                    <Bar dataKey="totalSeconds" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Activity Summary */}
            <ChartCard title="Активность (события)" className="lg:col-span-2">
              <div className="h-[240px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={localizedActivity} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="localizedName" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value, _name, props) => [value, `Событие: ${props.payload.localizedName}`]} />
                    <Bar dataKey="count" fill="#1E88E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  )
}


