import { useState, useEffect, useMemo, useCallback } from 'react'
import type { BoardOptionViewModel, BoardStatsViewModel } from '../../view-models/BoardViewModel'
import type { BoardController } from '../../controllers/BoardController'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { StatCard } from './stats/StatCard'
import { ChartCard } from './stats/ChartCard'
import { formatHours, getScoreColor } from './stats/StatUtils'

interface MultiBoardStatsSectionProps {
  boards: BoardOptionViewModel[]
  boardController: BoardController
}

const COLORS = ['#1E88E5', '#10B981', '#F59E0B', '#EF4444', '#7C3AED', '#64748B']

export default function MultiBoardStatsSection({ boards, boardController }: MultiBoardStatsSectionProps) {
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([])
  const [stats, setStats] = useState<BoardStatsViewModel | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const loadStats = useCallback(async (ids: string[]) => {
    setIsLoading(true)
    setError('')
    try {
      const data = await boardController.loadMultiBoardStats(ids.length > 0 ? ids : undefined)
      setStats(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить статистику'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [boardController])

  useEffect(() => {
    void loadStats(selectedBoardIds)
  }, [selectedBoardIds, loadStats])

  const handleToggleBoard = (id: string) => {
    setSelectedBoardIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedBoardIds(boards.map((b) => b.id))
  }

  const handleClearSelection = () => {
    setSelectedBoardIds([])
  }

  const localizedPriorities = useMemo(() => {
    if (!stats) return []
    return stats.byPriority.map((p) => {
      const name = String(p.name || '').toLowerCase().trim()
      let localized = p.name || 'Без приоритета'
      if (name === 'critical') localized = 'КРИТИЧЕСКИЙ'
      if (name === 'high') localized = 'ВЫСОКИЙ'
      if (name === 'medium') localized = 'СРЕДНИЙ'
      if (name === 'low') localized = 'НИЗКИЙ'
      return { ...p, localizedName: localized }
    })
  }, [stats])

  const localizedActivity = useMemo(() => {
    if (!stats) return []
    return stats.activity.map((a) => {
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
  }, [stats])

  const totalWorklogSeconds = useMemo(() => {
    if (!stats) return 0
    return stats.worklogs.reduce((sum, item) => sum + item.totalSeconds, 0)
  }, [stats])

  if (!stats && isLoading) {
    return (
      <div className="mt-10 flex h-64 items-center justify-center rounded-2xl border border-[#E4EBF6] bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E88E5] border-t-transparent" />
          <p className="text-sm font-medium text-[#64748B]">Загрузка полной статистики...</p>
        </div>
      </div>
    )
  }

  return (
    <section className="mt-12 w-full overflow-hidden rounded-[24px] border border-[#E1E8F2] bg-[#F8FAFF] shadow-sm transition-all duration-500 hover:shadow-md">
      <header className="flex flex-col border-b border-[#E1E7F2] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
            <MaterialSymbol name="analytics" size={24} color="currentColor" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0A1628]">Общая статистика</h2>
            <p className="text-xs font-medium text-[#64748B]">
              {selectedBoardIds.length === 0 
                ? 'Агрегированные данные по всем доскам' 
                : `Статистика по ${selectedBoardIds.length} выбранным доскам`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-0">
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-bold transition ${
                isExpanded 
                  ? 'border-[#1E88E5] bg-[#EBF4FE] text-[#1E88E5]' 
                  : 'border-[#DDE3EE] bg-white text-[#4A5F7A] hover:border-[#1E88E5] hover:text-[#1E88E5]'
              }`}
            >
              <MaterialSymbol name="filter_list" size={18} color="currentColor" />
              Фильтр досок
              {selectedBoardIds.length > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1E88E5] text-[10px] text-white">
                  {selectedBoardIds.length}
                </span>
              )}
            </button>
            
            {isExpanded && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[#E1E7F2] bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-top-2">
                <div className="mb-3 flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                  <span className="text-xs font-bold text-[#0A1628]">Выберите доски</span>
                  <div className="flex gap-2">
                    <button onClick={handleSelectAll} className="text-[10px] font-bold text-[#1E88E5] hover:underline">Все</button>
                    <button onClick={handleClearSelection} className="text-[10px] font-bold text-[#EF4444] hover:underline">Сброс</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {boards.map((board) => (
                    <label key={board.id} className="flex cursor-pointer items-center gap-2 rounded-lg py-1.5 px-2 transition hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={selectedBoardIds.includes(board.id)}
                        onChange={() => handleToggleBoard(board.id)}
                        className="h-4 w-4 rounded border-[#DDE3EE] text-[#1E88E5] focus:ring-[#1E88E5]"
                      />
                      <span className="truncate text-sm font-medium text-[#4A5F7A]">{board.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={() => loadStats(selectedBoardIds)}
            disabled={isLoading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE3EE] bg-white text-[#4A5F7A] transition hover:bg-[#F3F7FE] active:scale-95 disabled:opacity-50"
          >
            <MaterialSymbol name="refresh" size={20} color="currentColor" className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="p-6">
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <MaterialSymbol name="error" size={20} color="currentColor" />
            {error}
          </div>
        )}

        {stats ? (
          <div className="space-y-8">
            {/* 1. Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Всего задач" value={stats.summary.totalTasks} icon="task" color="#1E88E5" />
              <StatCard label="Выполнено" value={stats.summary.completedTasks} subValue={`${stats.summary.completionPercent}%`} icon="check_circle" color="#10B981" />
              <StatCard label="В работе" value={stats.summary.activeTasks} icon="engineering" color="#F59E0B" />
              <StatCard label="Просрочено" value={stats.summary.overdueTasks} icon="event_busy" color="#EF4444" />
              <StatCard label="Затрачено" value={stats.summary.totalSpentLabel} icon="timer" color="#7C3AED" />
              <StatCard label="Worklog" value={formatHours(totalWorklogSeconds)} icon="schedule" color="#64748B" />
            </div>

            {/* 2. Rating Chart (Full Width) */}
            <ChartCard title="Рейтинг сотрудников">
              <div className="h-[320px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={stats.employees.slice(0, 15)} margin={{ left: 8, right: 24, top: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="fullName" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#F1F5F9', radius: 4 }} />
                    <Bar dataKey="productivityScore" radius={[6, 6, 0, 0]} barSize={40}>
                      {stats.employees.map((emp, index) => (
                        <Cell key={index} fill={getScoreColor(emp.productivityScore)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 3. Grid for Statuses, Priority and Deadlines */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartCard title="Задачи по статусам">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={stats.byStatus} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="count">
                        {stats.byStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Распределение по приоритетам">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={localizedPriorities} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="localizedName" type="category" width={100} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#F1F5F9' }} formatter={(value, _name, props) => [value, props.payload.localizedName]} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                        {localizedPriorities.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'critical' ? '#EF4444' : entry.name === 'high' ? '#F97316' : entry.name === 'medium' ? '#F59E0B' : '#10B981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Сроки">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.byDeadline} margin={{ left: 0, right: 24, top: 8, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#F1F5F9' }} />
                      <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Worklog по дням">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.worklogs} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(_, __, item) => [item.payload.totalLabel, 'Время']} />
                      <Bar dataKey="totalSeconds" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* 4. Employee Table (Full Width) */}
            <ChartCard title="Оценка сотрудников: кто как работает">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase whitespace-nowrap">Сотрудник</th>
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
                    {stats.employees.map((emp) => (
                      <tr key={emp.userId} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EBF4FE] text-[11px] font-bold text-[#1E88E5]">
                              {emp.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-[#0A1628] whitespace-nowrap">{emp.fullName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#0A1628]">{emp.assignedTasks}</td>
                        <td className="py-3 px-4 text-sm text-[#10B981] font-bold">
                          {emp.completedTasks} <span className="text-[11px] text-[#64748B]">({emp.completionPercent}%)</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#0A1628]">{emp.activeTasks}</td>
                        <td className="py-3 px-4 text-sm text-[#EF4444]">
                          {emp.overdueTasks} <span className="text-[11px] text-[#64748B]">({emp.overduePercent}%)</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{emp.createdTasks}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B] whitespace-nowrap">{emp.worklogLabel}</td>
                        <td className="py-3 px-4">
                          <div className="flex min-w-[180px] items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                              <div
                                className="h-full"
                                style={{ width: `${Math.min(100, emp.productivityScore)}%`, backgroundColor: getScoreColor(emp.productivityScore) }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[#1E88E5]">{emp.productivityScore}</span>
                            <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold ${emp.productivityClassName}`}>
                              {emp.productivityLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-[#8A9BB5]">
                            оценка {emp.totalEstimateLabel} · факт {emp.totalSpentLabel}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            {/* 5. Activity Summary (Full Width) */}
            <ChartCard title="Активность (события)">
              <div className="h-[260px] w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={localizedActivity} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="localizedName" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value, _name, props) => [value, `Событие: ${props.payload.localizedName}`]} />
                    <Bar dataKey="count" fill="#1E88E5" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[#E1E8F2] bg-white/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8]">
              <MaterialSymbol name="data_exploration" size={32} color="currentColor" />
            </div>
            <p className="text-sm font-medium text-[#64748B]">Нажмите "Обновить" или выберите фильтр для загрузки данных</p>
          </div>
        )}
      </div>
    </section>
  )
}
