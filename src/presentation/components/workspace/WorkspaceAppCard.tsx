import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import cardBg from '../../../assets/cardbg.png'
import { getAppTagTone } from '../../../shared/utils/appTagTone'
import type { WorkspaceFavoriteAppViewModel } from '../../view-models/WorkspaceFavoritesViewModel'

type WorkspaceCardVariant = 'featured' | 'rail' | 'compact'

interface WorkspaceAppCardProps {
  app: WorkspaceFavoriteAppViewModel
  variant?: WorkspaceCardVariant
  draggable: boolean
  isRemoving: boolean
  isRatingPending: boolean
  onOpen: (app: WorkspaceFavoriteAppViewModel) => void
  onRate: (app: WorkspaceFavoriteAppViewModel, rating: number) => void
  onClearRating: (app: WorkspaceFavoriteAppViewModel) => void
  onDragStart: (appId: number) => void
  onDragOver: (appId: number) => void
  onDrop: (appId: number) => void
  onDragEnd: () => void
  onRemove: (appId: number) => void
}

const getDescription = (isGlobal: boolean): string =>
  isGlobal
    ? 'Модуль доступен для всей рабочей среды.'
    : 'Модуль доступен внутри вашего рабочего пространства.'

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const buildMonthGrid = (date: Date): Array<number | null> => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7

  const grid: Array<number | null> = []
  for (let i = 0; i < startOffset; i += 1) {
    grid.push(null)
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(day)
  }
  while (grid.length < 35) {
    grid.push(null)
  }
  return grid
}

export default function WorkspaceAppCard({
  app,
  variant = 'compact',
  draggable,
  isRemoving,
  onOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
}: WorkspaceAppCardProps) {
  const [isTagsExpanded, setIsTagsExpanded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [tagsContentHeight, setTagsContentHeight] = useState(0)
  const [hasTagOverflow, setHasTagOverflow] = useState(false)
  const tagsContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showMenu) return
    const close = () => setShowMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showMenu])

  const hasPhoto = Boolean(app.appPhoto)
  const canOpen = app.id === 36 || app.id === 38 || app.id === 42 || Boolean(app.link)
  const summary = getDescription(app.isGlobal)
  const ratingLabel = app.ratingCount > 0 ? `${app.averageRating.toFixed(1)} (${app.ratingCount})` : null
  const collapsedCompactTags = app.tags.slice(0, 3)
  const visibleCompactTags = isTagsExpanded ? app.tags : collapsedCompactTags
  const hiddenCompactTagsCount = Math.max(app.tags.length - collapsedCompactTags.length, 0)
  const collapsedTagsHeight = 32
  const isFeatured = variant === 'featured'
  const isRail = variant === 'rail'
  const isCompact = variant === 'compact'
  const shellClass = isFeatured
    ? 'p-7 pb-24 min-h-[500px] shadow-[0_3px_12px_rgba(15,31,58,0.06)]'
    : isRail
      ? 'bg-white p-4 min-h-full shadow-[0_1px_3px_rgba(15,31,58,0.04)]'
      : 'p-4 min-h-[168px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

  const today = useMemo(() => new Date(), [])
  const currentDay = today.getDate()
  const monthGrid = useMemo(() => buildMonthGrid(today), [today])
  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
      }).format(today),
    [today],
  )

  const meetings = [
    { time: '09:30', title: 'Ежедневный статус' },
    { time: '12:00', title: 'Синк по интеграциям' },
    { time: '16:00', title: 'Обзор задач команды' },
  ]

  const tasks = [
    { title: 'Проверить заявки', state: 'В работе' },
    { title: 'Согласовать план недели', state: 'На сегодня' },
    { title: 'Обновить статус проекта', state: 'Важно' },
  ]

  useEffect(() => {
    const content = tagsContentRef.current
    if (!content) return

    const measure = () => {
      const fullHeight = content.scrollHeight
      setTagsContentHeight(fullHeight)
      setHasTagOverflow(fullHeight > collapsedTagsHeight + 2)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      measure()
    })
    observer.observe(content)

    return () => {
      observer.disconnect()
    }
  }, [app.tags])

  const handleArticleClick = (event: MouseEvent<HTMLElement>) => {
    if (isFeatured) return
    if ((event.target as HTMLElement).closest('button')) return
    if (!canOpen) return
    onOpen(app)
  }

  return (
    <article
      draggable={draggable}
      onDragStart={() => onDragStart(app.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(app.id)
      }}
      onDrop={() => onDrop(app.id)}
      onClick={handleArticleClick}
      aria-label={!isFeatured && canOpen ? `Открыть приложение: ${app.appName}` : undefined}
      className={[
        'group relative isolate flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white transition',
        isCompact ? 'h-full' : '',
        shellClass,
        !isFeatured && canOpen ? 'cursor-pointer hover:border-[#C8D6EA] hover:shadow-[0_8px_22px_rgba(15,31,58,0.07)]' : '',
        !isFeatured && !canOpen ? 'cursor-not-allowed' : '',
      ].join(' ')}
    >
      {isFeatured ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <div
            className="absolute -inset-3 scale-110 bg-cover bg-center"
            style={{ backgroundImage: `url(${cardBg})`, filter: 'blur(12px)' }}
          />
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cardBg})` }} />
          <div className="absolute inset-0 bg-linear-to-b from-[#14233B]/58 via-[#1A2B46]/45 to-[#12213A]/62" />
        </div>
      ) : null}

      {isFeatured ? (
        <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
          <h3 className="truncate whitespace-nowrap text-[34px] font-bold leading-tight text-white" title="Единое пространство: Alem Workspace">
            Единое пространство: Alem Workspace
          </h3>
          <div className="relative">
            <button
              type="button"
              aria-label="Действия хаба"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((prev) => !prev)
              }}
              className={[
                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/20',
                showMenu ? 'bg-white/20' : 'text-white/85',
              ].join(' ')}
            >
              <MaterialSymbol name="more_vert" size={18} color="currentColor" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-white/20 bg-[#1A2B46] text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(app.id)
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-bold text-red-400 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <MaterialSymbol name="delete" size={18} color="currentColor" />
                  {isRemoving ? 'Удаление...' : 'Открепить'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={['relative z-10 flex items-start justify-between gap-3', isRail ? 'mb-4' : 'mb-3'].join(' ')}>
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={[
                'flex shrink-0 items-center justify-center overflow-hidden border border-[#E8ECF4] bg-[#F6F9FF]',
                isRail ? 'h-16 w-16 rounded-2xl p-2' : 'h-12 w-12 rounded-xl p-1.5',
              ].join(' ')}
            >
              {hasPhoto ? (
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-white">
                  <img src={app.appPhoto as string} alt={app.appName} className="h-full w-full object-contain" />
                </div>
              ) : (
                <MaterialSymbol name="apps" size={20} color="#2A5DB0" />
              )}
            </div>

            <div className="min-w-0">
              <h3
                className={[
                  'font-bold text-[#13233E]',
                  isRail ? 'text-[19px] leading-tight' : 'truncate whitespace-nowrap text-[15px] font-semibold leading-tight',
                ].join(' ')}
                style={
                  isRail
                    ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }
                    : undefined
                }
                title={app.appName}
              >
                {app.appName}
              </h3>
            </div>
          </div>

          <div className="relative z-20 flex items-center gap-2">
            <button
              type="button"
              aria-label={`Действия для ${app.appName}`}
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((prev) => !prev)
              }}
              className={[
                'inline-flex h-8 w-8 items-center justify-center rounded-lg transition',
                showMenu
                  ? 'bg-[#EBF4FE] text-[#1E88E5]'
                  : 'text-[#8CA0BE] hover:bg-[#F2F6FD] hover:text-[#1E88E5]',
              ].join(' ')}
            >
              <MaterialSymbol name="more_vert" size={18} color="currentColor" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[#E2EAF5] bg-white shadow-[0_12px_34px_rgba(15,31,58,0.14)] animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(app.id)
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-bold text-[#E11D48] transition hover:bg-[#FFF1F3] disabled:opacity-50"
                >
                  <MaterialSymbol name="delete" size={18} color="currentColor" />
                  {isRemoving ? 'Удаление...' : 'Открепить'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isFeatured ? (
        <>
          <div className="relative z-10 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
            <section className="rounded-2xl border border-white/35 bg-white/14 p-4 backdrop-blur-sm lg:col-span-3">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-white/85">Календарь</h4>
              <p className="mt-1 text-[16px] font-bold text-white">{monthTitle}</p>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-white/75">
                {WEEK_DAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[12px]">
                {monthGrid.map((day, index) => (
                  <span
                    key={`${day ?? 'empty'}-${index}`}
                    className={[
                      'inline-flex h-7 items-center justify-center rounded-md',
                      day === null ? 'opacity-0' : 'text-white/85',
                      day === currentDay ? 'bg-white font-bold text-[#1B2E4B]' : '',
                    ].join(' ')}
                  >
                    {day ?? '•'}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/35 bg-white/14 p-4 backdrop-blur-sm lg:col-span-5">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-white/85">Сегодняшние встречи</h4>
              <div className="mt-3 space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.time} className="flex items-start gap-3 rounded-xl bg-white/10 px-3 py-2">
                    <span className="w-12 text-[13px] font-semibold text-white/85">{meeting.time}</span>
                    <span className="h-6 w-0.5 rounded bg-[#68D6B6]" />
                    <span className="text-[14px] font-semibold text-white">{meeting.title}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/35 bg-white/14 p-4 backdrop-blur-sm lg:col-span-4">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-white/85">Текущие задачи</h4>
              <div className="mt-3 space-y-2.5">
                {tasks.map((task) => (
                  <div key={task.title} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#7AE3C7]" />
                      <span className="truncate text-[14px] font-semibold text-white">{task.title}</span>
                    </div>
                    <span className="shrink-0 rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white/90">{task.state}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <button
            type="button"
            disabled={!canOpen}
            onClick={() => onOpen(app)}
            className={[
              'group/btn absolute bottom-7 right-7 z-20 inline-flex h-12 min-w-65 items-center justify-center gap-2 rounded-xl px-7 text-[16px] font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-95',
              canOpen ? 'bg-white text-[#1A2B46] hover:bg-[#F3F7FD]' : 'cursor-not-allowed bg-white/30 text-white/50',
            ].join(' ')}
          >
            Перейти в хаб и управлять всем
            <span className="transition-transform duration-300 group-hover/btn:translate-x-1">
              <MaterialSymbol name="arrow_forward" size={18} color="currentColor" />
            </span>
          </button>
        </>
      ) : (
        <>
          {isRail ? (
            <div className="rounded-2xl border border-[#E5ECF7] bg-[#F8FBFF] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <p className="text-[13px] leading-relaxed text-[#5F7291]">{summary}</p>
            </div>
          ) : !isCompact ? (
            <p className={isCompact ? 'min-h-10 text-[13px] leading-relaxed text-[#5F7291]' : 'text-[13px] leading-relaxed text-[#5F7291]'}>
              {summary}
            </p>
          ) : null}

          <div className={isRail ? 'mt-4 flex items-center justify-between gap-2' : isCompact ? 'mt-3 flex items-center gap-3' : 'mt-3 flex items-center justify-between gap-2'}>
            {ratingLabel ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B7280]">
                <MaterialSymbol name="star" size={14} color="#F59E0B" />
                {ratingLabel}
              </span>
            ) : (
              <span className="text-[12px] font-medium text-[#9CA3AF]">Нет оценок</span>
            )}
            {isCompact && app.favoriteCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B7280]">
                <MaterialSymbol name="group" size={14} color="#9CA3AF" />
                {app.favoriteCount}
              </span>
            ) : null}
          </div>

          {isCompact && app.tags.length > 0 ? (
            <div className="mt-3">
              <div className="flex min-h-6 items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap content-start gap-1.5">
                  {visibleCompactTags.map((tag) => {
                    const tone = getAppTagTone(tag)
                    return (
                      <span
                        key={`${app.id}-${tag}`}
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide transition duration-150 hover:opacity-85"
                        style={tone.chipStyle}
                      >
                        {tag}
                      </span>
                    )
                  })}
                </div>
                {hiddenCompactTagsCount > 0 || isTagsExpanded ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsTagsExpanded((prev) => !prev)
                    }}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-[#D8E4F6] bg-[#F8FBFF] px-1.5 py-0.5 text-[9px] font-bold text-[#3B5C87] transition hover:bg-[#EEF4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9EC2F8]"
                  >
                    <MaterialSymbol
                      name="keyboard_double_arrow_right"
                      size={10}
                      color="currentColor"
                      style={{
                        transform: isTagsExpanded ? 'rotate(-90deg)' : 'rotate(90deg)',
                        transition: 'transform 180ms ease',
                      }}
                    />
                    {isTagsExpanded ? 'Скрыть' : `+${hiddenCompactTagsCount}`}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!isCompact && app.tags.length > 0 ? (
            <div className={isRail ? 'mt-4' : 'mt-3'}>
              <div
                className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
                style={{
                  maxHeight: isTagsExpanded ? `${Math.max(tagsContentHeight, collapsedTagsHeight)}px` : `${collapsedTagsHeight}px`,
                }}
              >
                <div ref={tagsContentRef} className="flex flex-wrap gap-1.5">
                  {app.tags.map((tag) => {
                    const tone = getAppTagTone(tag)
                    return (
                      <span
                        key={`${app.id}-${tag}`}
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition duration-150 hover:opacity-85"
                        style={tone.chipStyle}
                      >
                        {tag}
                      </span>
                    )
                  })}
                </div>
                {!isTagsExpanded && hasTagOverflow ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t from-white to-transparent" />
                ) : null}
              </div>
              {hasTagOverflow ? (
                <div className="mt-2 flex">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsTagsExpanded((prev) => !prev)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D8E4F6] bg-[#F8FBFF] px-2 py-0.5 text-[11px] font-semibold text-[#3B5C87] transition hover:bg-[#EEF4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9EC2F8]"
                  >
                    <MaterialSymbol
                      name={isTagsExpanded ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'}
                      size={12}
                      color="currentColor"
                      style={{
                        transform: isTagsExpanded ? 'rotate(-90deg)' : 'rotate(90deg)',
                        transition: 'transform 180ms ease',
                      }}
                    />
                    {isTagsExpanded ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isFeatured && canOpen ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpen(app)
              }}
              className="sr-only"
            >
              Открыть {app.appName}
            </button>
          ) : null}
        </>
      )}

      <button
        type="button"
        disabled={isRemoving}
        onClick={() => onRemove(app.id)}
        aria-label={`Удалить ${app.appName} из избранного`}
        className="sr-only"
      >
        remove
      </button>
    </article>
  )
}
