import { useState, useEffect, useCallback } from 'react'
import type { BoardOptionViewModel, BoardUserViewModel } from '../../view-models/BoardViewModel'
import type { KanbanBoardStatsResponse } from '../../../domain/entities/AiTools'
import type { HttpAlemAiRepository } from '../../../infrastructure/repositories/HttpAlemAiRepository'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import GradientAvatar from '../../../shared/ui/GradientAvatar'
import { formatHours } from './stats/StatUtils'
import AppSelect from '../../../shared/ui/AppSelect'

interface SingleBoardAiStatsSectionProps {
  boards: BoardOptionViewModel[]
  users: BoardUserViewModel[]
  alemAiRepository: HttpAlemAiRepository
}

export default function SingleBoardAiStatsSection({ boards, users, alemAiRepository }: SingleBoardAiStatsSectionProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [stats, setStats] = useState<KanbanBoardStatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  const resolveUser = useCallback((userId: number, fallbackName: string) => {
    const matched = users.find((u) => u.id === userId)
    if (matched) {
      return {
        fullName: matched.fullName,
        initials: matched.initials,
        avatarUrl: matched.avatarUrl
      }
    }
    
    const parts = fallbackName.trim().split(/\s+/).filter(Boolean)
    let initials = ''
    if (parts.length > 0) {
      initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
    } else {
      initials = String(userId).slice(-2)
    }

    return {
      fullName: fallbackName,
      initials: initials || '??',
      avatarUrl: ''
    }
  }, [users])

  // Initialize selectedBoardId to first board if available
  useEffect(() => {
    if (boards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(boards[0].id)
    }
  }, [boards, selectedBoardId])

  const loadStats = useCallback(async (boardId: string) => {
    if (!boardId) return
    setIsLoading(true)
    setError('')
    try {
      const data = await alemAiRepository.getBoardStats(boardId)
      setStats(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить аналитику доски'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [alemAiRepository])

  useEffect(() => {
    if (selectedBoardId) {
      void loadStats(selectedBoardId)
    }
  }, [selectedBoardId, loadStats])

  if (boards.length === 0) return null

  // Top 3 performers / Drivers
  const topDrivers = stats?.users 
    ? [...stats.users]
        .sort((a, b) => (b.share_percent ?? 0) - (a.share_percent ?? 0))
        .slice(0, 3)
    : []

  const maxClosedCount = stats?.timeline && stats.timeline.length > 0
    ? Math.max(...stats.timeline.map((t) => t.closed_tasks_count), 1)
    : 1

  return (
    <>
      <style>{`
        .activity-bar {
          transition: background-color 0.2s ease, transform 0.2s ease;
        }
        .activity-bar:hover {
          background-color: #1565C0 !important;
          transform: translateY(-2px);
        }
        .activity-bar:hover .activity-tooltip {
          opacity: 1 !important;
          transform: translate(-50%, -4px) !important;
        }
        .flat-button-shrink {
          transition: transform 0.12s ease, background-color 0.15s ease;
        }
        .flat-button-shrink:active {
          transform: scale(0.96);
        }
        .driver-card-hover {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .driver-card-hover:hover {
          box-shadow: 0 10px 25px rgba(15,23,42,0.06) !important;
          transform: translateY(-2px);
        }
        .stats-pulse-row:hover {
          background-color: #F8FAFF !important;
        }
        .focus-task-row {
          transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
        }
        .focus-task-row:hover {
          background-color: #EBF4FE !important;
          border-color: #1E88E560 !important;
          transform: translateX(2px);
        }
      `}</style>

      <section className="mt-8 w-full overflow-hidden rounded-[24px] border border-[#E1E8F2] bg-[#F8FAFF] shadow-sm transition-all duration-500 hover:shadow-md">
        {/* Header */}
        <header className="flex flex-col border-b border-[#E1E7F2] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF4FE] text-[#1E88E5]">
              <MaterialSymbol name="insights" size={24} color="currentColor" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0A1628]">Статистика продуктивности доски</h2>
              <p className="text-xs font-medium text-[#64748B]">
                Детальный анализ эффективности работы, динамики закрытия задач и вклада участников
              </p>
            </div>
          </div>

          {/* Dropdown and Collapse Button */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <AppSelect
              value={selectedBoardId}
              options={boards.map((b) => ({ value: b.id, label: b.name }))}
              onChange={setSelectedBoardId}
              ariaLabel="Выбор доски"
              searchable
              searchPlaceholder="Поиск доски"
              buttonClassName="!h-10 !rounded-xl !border !border-[#DDE3EE] !bg-white !pl-4 !pr-3 !text-[13px] !font-bold !text-[#455A64] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:!border-[#1E88E5] min-w-[180px] max-w-[280px]"
            />

            <button
              type="button"
              onClick={() => selectedBoardId && void loadStats(selectedBoardId)}
              disabled={isLoading || !selectedBoardId}
              className="flat-button-shrink inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDE3EE] bg-white text-[#4A5F7A] transition hover:bg-[#F3F7FE] disabled:opacity-50"
              title="Обновить данные"
            >
              <MaterialSymbol name="refresh" size={20} color="currentColor" className={isLoading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flat-button-shrink inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDE3EE] bg-white text-[#4A5F7A] transition hover:bg-[#F3F7FE]"
              title={isCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              <MaterialSymbol name={isCollapsed ? 'expand_more' : 'expand_less'} size={22} color="currentColor" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        {!isCollapsed && (
          <div className="p-6">
            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
                <MaterialSymbol name="error" size={20} color="currentColor" />
                <div className="font-semibold">{error}</div>
              </div>
            )}

            {isLoading ? (
              /* Premium Shimmer Loading State */
              <div className="space-y-6 animate-pulse">
                <div className="h-28 rounded-3xl bg-slate-200" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-3xl bg-slate-200" />
                  ))}
                </div>
                <div className="h-56 rounded-3xl bg-slate-200" />
              </div>
            ) : stats ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* 1. AI Summary Card (Calculation Note) */}
                {stats.calculation_note && (
                  <div
                    style={{
                      borderRadius: 20,
                      border: '1px solid #E5E9F0',
                      borderLeft: '4px solid #7C3AED',
                      background: '#FFFFFF',
                      padding: 16,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      boxShadow: '0 2px 8px rgba(10,22,40,0.01)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#F5F3FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: '#7C3AED',
                      }}
                    >
                      <MaterialSymbol name="auto_awesome" size={20} color="currentColor" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>
                        Сводный анализ доски от Alem AI
                      </h4>
                      <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: '#455A64', fontWeight: 500 }}>
                        {stats.calculation_note}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Row 1: Summary Statistics Cards */}
                {stats.summary && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Card 1: Total Tasks */}
                    <div className="bg-white rounded-3xl p-5 border border-[#E5E9F0] shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[#64748B]">
                        <span className="text-[12px] font-bold uppercase tracking-wider">Всего задач</span>
                        <MaterialSymbol name="task" size={20} color="currentColor" />
                      </div>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-[#0A1628]">{stats.summary.total_tasks}</span>
                        <span className="text-xs font-semibold text-[#64748B]">задач</span>
                      </div>
                      <div className="mt-3 h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div className="h-full bg-[#1E88E5]" style={{ width: '100%' }} />
                      </div>
                    </div>

                    {/* Card 2: Completed Tasks */}
                    <div className="bg-white rounded-3xl p-5 border border-[#E5E9F0] shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[#10B981]">
                        <span className="text-[12px] font-bold uppercase tracking-wider">Выполнено</span>
                        <MaterialSymbol name="check_circle" size={20} color="currentColor" />
                      </div>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-[#10B981]">{stats.summary.done_tasks}</span>
                        <span className="text-xs font-semibold text-[#64748B]">
                          ({Math.round((stats.summary.done_tasks / (stats.summary.total_tasks || 1)) * 100)}%)
                        </span>
                      </div>
                      <div className="mt-3 h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div className="h-full bg-[#10B981]" style={{ width: `${(stats.summary.done_tasks / (stats.summary.total_tasks || 1)) * 100}%` }} />
                      </div>
                    </div>

                    {/* Card 3: In Progress Tasks */}
                    <div className="bg-white rounded-3xl p-5 border border-[#E5E9F0] shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[#F59E0B]">
                        <span className="text-[12px] font-bold uppercase tracking-wider">В работе</span>
                        <MaterialSymbol name="hourglass_empty" size={20} color="currentColor" />
                      </div>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-[#F59E0B]">{stats.summary.in_progress_tasks}</span>
                        <span className="text-xs font-semibold text-[#64748B]">
                          ({Math.round((stats.summary.in_progress_tasks / (stats.summary.total_tasks || 1)) * 100)}%)
                        </span>
                      </div>
                      <div className="mt-3 h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div className="h-full bg-[#F59E0B]" style={{ width: `${(stats.summary.in_progress_tasks / (stats.summary.total_tasks || 1)) * 100}%` }} />
                      </div>
                    </div>

                    {/* Card 4: Overdue Tasks */}
                    <div className="bg-white rounded-3xl p-5 border border-[#E5E9F0] shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[#EF4444]">
                        <span className="text-[12px] font-bold uppercase tracking-wider">Просрочено</span>
                        <MaterialSymbol name="warning" size={20} color="currentColor" />
                      </div>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-[#EF4444]">{stats.summary.overdue_tasks}</span>
                        <span className="text-xs font-semibold text-[#EF4444]">просрочено</span>
                      </div>
                      <div className="mt-3 h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div className="h-full bg-[#EF4444]" style={{ width: `${(stats.summary.overdue_tasks / (stats.summary.total_tasks || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Row 2: CSS Timeline Activity Chart */}
                {stats.timeline && stats.timeline.length > 0 && (
                  <div className="space-y-4">
                    <div className="border-b border-[#E5E9F0] pb-2">
                      <h3 className="text-sm font-black text-[#0A1628] uppercase tracking-wider flex items-center gap-2">
                        <MaterialSymbol name="analytics" size={18} className="text-[#1E88E5]" />
                        Хронология выполнения задач
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">Динамика закрытия задач за отчетный период по дням</p>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-[#E5E9F0] shadow-sm">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          gap: 12,
                          height: 140,
                          paddingTop: 12,
                          overflowX: 'auto',
                        }}
                      >
                        {stats.timeline.map((item) => (
                          <div
                            key={item.date}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: 24,
                            }}
                          >
                            <div
                              className="activity-bar"
                              style={{
                                width: '100%',
                                height: `${(item.closed_tasks_count / maxClosedCount) * 100}%`,
                                minHeight: item.closed_tasks_count > 0 ? 6 : 2,
                                background: item.closed_tasks_count > 0 ? '#1E88E5' : '#ECEFF1',
                                borderRadius: '4px 4px 0 0',
                                position: 'relative',
                                cursor: 'pointer',
                              }}
                            >
                              {/* Simple tooltip wrapper */}
                              <div
                                className="activity-tooltip"
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translate(-50%, 0)',
                                  marginBottom: 6,
                                  background: '#0A1628',
                                  color: '#FFFFFF',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 4px 12px rgba(10,22,40,0.15)',
                                  opacity: 0,
                                  pointerEvents: 'none',
                                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                                  zIndex: 10,
                                }}
                              >
                                {item.closed_tasks_count} задач
                              </div>
                            </div>
                            <span style={{ fontSize: 9, color: '#64748B', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {new Date(item.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Row 3: "Люди, которые двигают доску" (Board Drivers) */}
                <div className="space-y-4">
                  <div className="border-b border-[#E1E7F2] pb-2">
                    <h3 className="text-sm font-black text-[#0A1628] uppercase tracking-wider flex items-center gap-2">
                      <MaterialSymbol name="rocket_launch" size={18} className="text-[#F59E0B]" />
                      Люди, которые двигают доску
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Топ участников по доле закрытых задач и эффективности</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {topDrivers.map((user, idx) => {
                      const progressVal = Math.min(100, Math.round(user.share_percent ?? 0))
                      const resolved = resolveUser(user.user_id, user.full_name)
                      
                      return (
                        <div
                          key={user.user_id}
                          className="driver-card-hover bg-white rounded-3xl p-5 border border-[#E5E9F0] shadow-sm flex flex-col justify-between relative"
                          style={{ minHeight: 460 }}
                        >
                          {/* Performer Rank Pill */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 20,
                              right: 20,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              background: idx === 0 ? '#FFFBEB' : idx === 1 ? '#F1F5F9' : '#FFF7ED',
                              color: idx === 0 ? '#B45309' : idx === 1 ? '#475569' : '#C2410C',
                              border: `1px solid ${idx === 0 ? '#F59E0B15' : idx === 1 ? '#94A3B815' : '#F9731615'}`,
                              textTransform: 'uppercase',
                            }}
                          >
                            <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                            <span style={{ fontSize: 9, fontWeight: 800 }}>ТОП-{idx + 1}</span>
                          </div>

                          <div className="space-y-4">
                            {/* Driver Identity */}
                            <div className="flex items-center gap-3">
                              <div className="shrink-0 flex items-center justify-center">
                                <GradientAvatar
                                  initials={resolved.initials}
                                  src={resolved.avatarUrl}
                                  size={40}
                                  seed={user.user_id}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', paddingRight: 75 }} className="truncate" title={resolved.fullName}>
                                  {resolved.fullName}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  Исполнитель
                                </p>
                              </div>
                            </div>

                            {/* Task share progress bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-[#64748B]">Доля в закрытых задачах</span>
                                <span className="text-[#1E88E5]">{progressVal}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                                <div
                                  className="h-full bg-[#1E88E5] rounded-full"
                                  style={{ width: `${progressVal}%` }}
                                />
                              </div>
                            </div>

                            {/* Quick Stats Grid with vertical borders */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-around',
                                background: '#F8FAFF',
                                borderRadius: 12,
                                padding: '10px 4px',
                                border: '1px solid #ECEFF1',
                              }}
                            >
                              <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: 9, color: '#8497B4', fontWeight: 700 }}>Вып</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981', marginTop: 1 }}>{user.closed_tasks_count}</div>
                              </div>
                              <div style={{ width: 1, background: '#ECEFF1' }} />
                              <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: 9, color: '#8497B4', fontWeight: 700 }}>Раб</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B', marginTop: 1 }}>{user.in_progress_tasks_count}</div>
                              </div>
                              <div style={{ width: 1, background: '#ECEFF1' }} />
                              <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: 9, color: '#8497B4', fontWeight: 700 }}>Прос</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#EF4444', marginTop: 1 }}>{user.overdue_tasks_count}</div>
                              </div>
                              <div style={{ width: 1, background: '#ECEFF1' }} />
                              <div style={{ textAlign: 'center', flex: 1, minWidth: 0, padding: '0 2px' }}>
                                <div style={{ fontSize: 9, color: '#8497B4', fontWeight: 700 }}>Время</div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#4A5F7A', marginTop: 3, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={formatHours(user.total_time_spent_sec)}>
                                  {formatHours(user.total_time_spent_sec)}
                                </div>
                              </div>
                            </div>

                            {/* AI Summary Comment bubble */}
                            {user.ai_summary && (
                              <div
                                style={{
                                  padding: 12,
                                  borderRadius: 12,
                                  background: '#F5F3FF', // Light purple AI accent
                                  border: '1px solid #7C3AED10',
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                  color: '#374151',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>
                                  <MaterialSymbol name="auto_awesome" size={14} color="#7C3AED" />
                                  <span>Анализ активности</span>
                                </div>
                                <p style={{ fontWeight: 500, margin: 0 }} className="leading-normal">
                                  {user.ai_summary}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Focus tasks list (Safe parsing) */}
                          {user.tasks && user.tasks.length > 0 && (
                            <div style={{ borderTop: '1px solid #ECEFF1', paddingTop: 12, marginTop: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#8497B4', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
                                Фокус-задачи
                              </div>
                              <div style={{ display: 'grid', gap: 6 }}>
                                {user.tasks.slice(0, 3).map((task: any, tIdx: number) => {
                                  const title = task?.task_title || task?.title || task?.name || (typeof task === 'string' ? task : 'Задача без названия')
                                  return (
                                    <div
                                      key={tIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 8,
                                        fontSize: 12,
                                        color: '#4A5568',
                                      }}
                                    >
                                      <MaterialSymbol name="check_circle" size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                                      <span
                                        style={{
                                          fontWeight: 500,
                                          color: '#334155',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={title}
                                      >
                                        {title}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {topDrivers.length === 0 && (
                      <div className="col-span-3 text-center py-6 text-sm text-slate-400 font-semibold bg-white border border-[#E1E8F2] rounded-3xl">
                        Нет данных о топ-исполнителях
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Row 5: "Пульс команды" (Team Pulse - Detailed comments list) */}
                <div className="space-y-4">
                  <div className="border-b border-[#E1E7F2] pb-2">
                    <h3 className="text-sm font-black text-[#0A1628] uppercase tracking-wider flex items-center gap-2">
                      <MaterialSymbol name="analytics" size={18} className="text-[#1E88E5]" />
                      Пульс команды
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Индивидуальные показатели продуктивности и метрики по каждому участнику</p>
                  </div>

                  <div className="bg-white rounded-3xl border border-[#E5E9F0] shadow-sm overflow-hidden divide-y divide-[#E5E9F0]">
                    {stats.users && stats.users.length > 0 ? (
                      stats.users.map((user) => {
                        const resolved = resolveUser(user.user_id, user.full_name)
                        return (
                          <div key={user.user_id} className="stats-pulse-row p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all duration-200">
                            {/* Member Identity & stats */}
                            <div className="flex items-center gap-3 min-w-0 w-full md:w-[240px] shrink-0">
                              <div className="shrink-0 flex items-center justify-center">
                                <GradientAvatar
                                  initials={resolved.initials}
                                  src={resolved.avatarUrl}
                                  size={40}
                                  seed={user.user_id}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }} className="truncate" title={resolved.fullName}>
                                  {resolved.fullName}
                                </h4>
                                
                                {/* Inline task indicators */}
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span style={{ background: '#E6F4EA', color: '#137333', borderRadius: 6, fontSize: 9, fontWeight: 800, padding: '2px 6px' }} title="Выполнено">
                                    {user.closed_tasks_count} вып
                                  </span>
                                  <span style={{ background: '#FEF7E0', color: '#B06000', borderRadius: 6, fontSize: 9, fontWeight: 800, padding: '2px 6px' }} title="В работе">
                                    {user.in_progress_tasks_count} раб
                                  </span>
                                  <span style={{ background: '#FCE8E6', color: '#C5221F', borderRadius: 6, fontSize: 9, fontWeight: 800, padding: '2px 6px' }} title="Просрочено">
                                    {user.overdue_tasks_count} проср
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* AI Commentary Column */}
                            <div className="flex-1 min-w-0 w-full">
                              {user.commentary ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 8,
                                    background: '#F8FAFF',
                                    border: '1px solid #E5E9F0',
                                    borderRadius: 12,
                                    padding: '12px 14px',
                                  }}
                                >
                                  <MaterialSymbol name="auto_awesome" size={16} color="#1E88E5" style={{ flexShrink: 0, marginTop: 1 }} />
                                  <p style={{ fontSize: 12, lineHeight: 1.6, color: '#374151', fontWeight: 500, margin: 0 }}>
                                    {user.commentary}
                                  </p>
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: '#8497B4', fontStyle: 'italic', paddingLeft: 12 }}>Комментарий отсутствует</div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                        Участники не найдены
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty Data State */
              <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-[#E1E8F2] bg-white/50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2F6] text-[#64748B]">
                  <MaterialSymbol name="data_exploration" size={32} color="currentColor" />
                </div>
                <p className="text-xs font-semibold text-[#64748B]">
                  Выберите доску для загрузки аналитики
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}
