import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import AppToast from '../../../shared/ui/AppToast'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import WorkspaceAppCard from '../../components/workspace/WorkspaceAppCard'
import WorkdayHub from '../../components/workspace/WorkdayHub'
import WorkspaceSkeletons from '../../components/workspace/WorkspaceSkeletons'
import { createHomeDashboardController } from '../../dashboard/createHomeDashboardController'
import { createWorkspaceFavoritesController } from '../../workspace/createWorkspaceFavoritesController'
import type { WorkspaceFavoriteAppViewModel } from '../../view-models/WorkspaceFavoritesViewModel'
import { getDefaultHomeDashboardViewModel, type HomeDashboardViewModel } from '../../view-models/HomeDashboardViewModel'

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) {
    return 'Доброе утро! Желаем отличного и продуктивного дня.'
  }
  if (hour >= 12 && hour < 18) {
    return 'Добрый день! Желаем отличного и продуктивного дня.'
  }
  if (hour >= 18 && hour < 24) {
    return 'Добрый вечер! Желаем отличного и продуктивного дня.'
  }
  return 'Доброй ночи! Желаем отличного и продуктивного дня.'
}

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items
  }

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

const normalizePositions = (apps: WorkspaceFavoriteAppViewModel[]): WorkspaceFavoriteAppViewModel[] =>
  apps.map((app, index) => ({ ...app, position: index + 1 }))

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [apps, setApps] = useState<WorkspaceFavoriteAppViewModel[]>([])
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [draggedAppId, setDraggedAppId] = useState<number | null>(null)
  const [dragOverAppId, setDragOverAppId] = useState<number | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [pendingRatingId, setPendingRatingId] = useState<number | null>(null)
  const [hubData, setHubData] = useState<HomeDashboardViewModel>(getDefaultHomeDashboardViewModel())
  const [removedIds, setRemovedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('workspace_removed_ids')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('workspace_removed_ids', JSON.stringify(removedIds))
  }, [removedIds])

  const { workspaceFavoritesController } = useMemo(() => createWorkspaceFavoritesController(), [])
  const { homeDashboardController } = useMemo(() => createHomeDashboardController(), [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const loadFavorites = useCallback(
    async (options?: { force?: boolean }) => {
      setIsLoading(true)
      setError('')
      try {
        const [workspaceViewModel, homeViewModel] = await Promise.all([
          workspaceFavoritesController.load(options),
          homeDashboardController.load(options),
        ])

        // Filter out apps that were explicitly removed by user but might still be returned by server (e.g. global apps)
        const visibleApps = workspaceViewModel.apps.filter((app) => !removedIds.includes(app.id))

        setApps(visibleApps)
        setHubData(homeViewModel)
      } catch (error) {
        setError(getErrorMessage(error, 'Не удалось загрузить список приложений. Попробуйте еще раз.'))
      } finally {
        setIsLoading(false)
      }
    },
    [workspaceFavoritesController, homeDashboardController, removedIds],
  )

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>()
    apps.forEach((app) => {
      app.tags.forEach((tag) => {
        if (tag.trim()) {
          tagsSet.add(tag.trim())
        }
      })
    })
    return Array.from(tagsSet)
  }, [apps])

  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return apps.filter((app) => {
      const matchesQuery = !normalizedQuery || app.appName.toLowerCase().includes(normalizedQuery)
      const matchesTag = !selectedTag || app.tags.some((tag) => tag.trim() === selectedTag)
      return matchesQuery && matchesTag
    })
  }, [apps, query, selectedTag])
  const reorderAllowed = query.trim().length === 0

  const handleDrop = async (targetAppId: number) => {
    if (!reorderAllowed || isReordering || draggedAppId === null || draggedAppId === targetAppId) {
      return
    }

    const fromIndex = apps.findIndex((app) => app.id === draggedAppId)
    const toIndex = apps.findIndex((app) => app.id === targetAppId)
    if (fromIndex === -1 || toIndex === -1) {
      return
    }

    const previous = apps
    const reordered = normalizePositions(moveItem(apps, fromIndex, toIndex))
    setApps(reordered)
    setIsReordering(true)
    setDraggedAppId(null)
    setDragOverAppId(null)

    try {
      await workspaceFavoritesController.reorder(draggedAppId, toIndex + 1)
      setToast('Порядок приложений обновлен')
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Не удалось сохранить новый порядок. Изменения отменены.'))
    } finally {
      setIsReordering(false)
    }
  }

  const handleRemove = async (appId: number) => {
    if (removingId !== null || isReordering) {
      return
    }

    const previous = apps
    const next = normalizePositions(apps.filter((item) => item.id !== appId))
    setApps(next)
    setRemovingId(appId)
    setError('')

    try {
      await workspaceFavoritesController.remove(appId)
      setRemovedIds((prev) => [...new Set([...prev, appId])])
      await loadFavorites({ force: true })
      setToast('Приложение удалено из избранного')
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Не удалось удалить приложение. Возможно, оно является глобальным.'))
    } finally {
      setRemovingId(null)
    }
  }

  const handleOpen = (targetApp: WorkspaceFavoriteAppViewModel) => {
    if (targetApp.id === 36) {
      navigate('/calendar')
      return
    }

    if (targetApp.id === 42) {
      navigate('/alemai')
      return
    }

    if (targetApp.id === 38) {
      navigate('/board')
      return
    }

    if (!targetApp.link) {
      return
    }

    window.open(targetApp.link, '_blank', 'noopener,noreferrer')
  }

  const handleRate = async (targetApp: WorkspaceFavoriteAppViewModel, rating: number) => {
    if (pendingRatingId !== null) {
      return
    }

    const previous = apps
    const optimistic = apps.map((app) =>
      app.id === targetApp.id
        ? {
            ...app,
            myRating: rating,
          }
        : app,
    )

    setPendingRatingId(targetApp.id)
    setApps(optimistic)
    setError('')

    try {
      const updated = await workspaceFavoritesController.rate(targetApp.id, rating)
      setApps((current) => current.map((app) => (app.id === updated.id ? updated : app)))
      setToast('Оценка сохранена')
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Не удалось сохранить оценку. Попробуйте снова.'))
    } finally {
      setPendingRatingId(null)
    }
  }

  const handleClearRating = async (targetApp: WorkspaceFavoriteAppViewModel) => {
    if (pendingRatingId !== null) {
      return
    }

    const previous = apps
    setPendingRatingId(targetApp.id)
    setApps((current) => current.map((app) => (app.id === targetApp.id ? { ...app, myRating: null } : app)))
    setError('')

    try {
      const updated = await workspaceFavoritesController.clearRating(targetApp.id)
      setApps((current) => current.map((app) => (app.id === updated.id ? updated : app)))
      setToast('Оценка удалена')
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Не удалось удалить оценку. Попробуйте снова.'))
    } finally {
      setPendingRatingId(null)
    }
  }

  return (
    <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#F8F9FA]">
      {error ? <AppToast variant="error" message={error} onClose={() => setError('')} /> : null}
      {toast ? <AppToast variant="success" message={toast} onClose={() => setToast('')} /> : null}

      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <header className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#111827] sm:text-[32px]">
                  Workspace
                </h1>
              </div>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#6B7280]">
                {getGreeting()}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label className="relative w-full sm:w-[220px]">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Поиск инструментов..."
                  className="h-10 w-full rounded-full border border-[#E5E7EB] bg-white pl-10 pr-3 text-[13px] font-normal text-[#374151] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
                />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8CA0BE]">
                  <MaterialSymbol name="search" size={17} color="currentColor" />
                </span>
              </label>

              {allTags.length > 0 ? (
                <div ref={dropdownRef} className="relative w-full sm:w-[150px]">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className={[
                      'flex h-10 w-full items-center justify-between rounded-full border bg-white pl-10 pr-4 text-[13px] font-semibold outline-none transition-all duration-200 select-none text-left',
                      isDropdownOpen
                        ? 'border-[#93C5FD] ring-2 ring-[#DBEAFE] text-[#1E88E5]'
                        : 'border-[#E5E7EB] text-[#4B5563] hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]',
                    ].join(' ')}
                  >
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                      <MaterialSymbol name="filter_list" size={16} color="currentColor" />
                    </span>
                    <span className="truncate pr-1">{selectedTag || 'Все теги'}</span>
                    <MaterialSymbol
                      name="keyboard_arrow_down"
                      size={16}
                      color="currentColor"
                      style={{
                        transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 200ms ease',
                      }}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1.5 w-full min-w-[160px] overflow-hidden rounded-2xl border border-[#E2EAF5] bg-white py-1.5 shadow-[0_12px_34px_rgba(15,31,58,0.14)] animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTag(null)
                          setIsDropdownOpen(false)
                        }}
                        className={[
                          'flex w-full items-center px-4 py-2 text-left text-[13px] transition-colors',
                          !selectedTag
                            ? 'bg-[#EFF6FF] font-bold text-[#2563EB]'
                            : 'font-medium text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]',
                        ].join(' ')}
                      >
                        Все теги
                      </button>
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedTag(tag)
                            setIsDropdownOpen(false)
                          }}
                          className={[
                            'flex w-full items-center px-4 py-2 text-left text-[13px] transition-colors',
                            selectedTag === tag
                              ? 'bg-[#EFF6FF] font-bold text-[#2563EB]'
                              : 'font-medium text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]',
                          ].join(' ')}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => navigate('/alemstore')}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#2563EB] px-4 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)] transition hover:bg-[#1D4ED8]"
              >
                <MaterialSymbol name="add" size={18} color="#fff" />
                AlemStore
              </button>
            </div>
          </div>
        </header>

        {isLoading ? <div className="mt-8"><WorkspaceSkeletons /></div> : null}

        {!isLoading && apps.length === 0 ? (
          <CardShell className="mt-6 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF4FE]">
              <MaterialSymbol name="apps" size={24} color="#1E88E5" />
            </div>
            <h2 className="text-lg font-bold text-[#0A1628]">У вас пока нет избранных приложений</h2>
            <p className="mt-2 text-sm text-[#8497B4]">После добавления в избранное приложения появятся здесь.</p>
          </CardShell>
        ) : null}

        {!isLoading && apps.length > 0 ? (
          <section className="mt-6 space-y-8">
            <WorkdayHub hubData={hubData} />

            <section className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111827]">
                  Закрепленные приложения
                </h2>
                {!reorderAllowed ? (
                  <p className="text-[13px] font-medium text-[#6B7F9A]">Перетаскивание доступно без поиска</p>
                ) : null}
              </div>

              {filteredApps.length === 0 ? (
                <CardShell className="p-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6]">
                    <MaterialSymbol name="search" size={24} color="#6B7280" />
                  </div>
                  <h2 className="text-base font-semibold text-[#111827]">Ничего не найдено</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">Измените параметры поиска или выбранные теги.</p>
                </CardShell>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredApps.map((app) => (
                    <div key={app.id} className={dragOverAppId === app.id ? 'rounded-2xl ring-2 ring-[#2563EB]/30 ring-offset-2 ring-offset-white' : ''}>
                      <WorkspaceAppCard
                        app={app}
                        variant="compact"
                        draggable={reorderAllowed && !isReordering && removingId === null}
                        isRemoving={removingId === app.id}
                        isRatingPending={pendingRatingId === app.id}
                        onOpen={handleOpen}
                        onRate={(target, rating) => {
                          void handleRate(target, rating)
                        }}
                        onClearRating={(target) => {
                          void handleClearRating(target)
                        }}
                        onDragStart={setDraggedAppId}
                        onDragOver={setDragOverAppId}
                        onDrop={(targetId) => {
                          void handleDrop(targetId)
                        }}
                        onDragEnd={() => {
                          setDraggedAppId(null)
                          setDragOverAppId(null)
                        }}
                        onRemove={(appId) => {
                          void handleRemove(appId)
                        }}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => navigate('/alemstore')}
                    className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-6 text-center transition hover:border-[#93C5FD] hover:bg-[#F9FAFB]"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                      <MaterialSymbol name="add" size={20} color="currentColor" />
                    </span>
                    <p className="text-[14px] font-medium text-[#374151]">Добавить приложение</p>
                  </button>
                </div>
              )}
            </section>
          </section>
        ) : null}
      </div>
    </main>
  )
}
