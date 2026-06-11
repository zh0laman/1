import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAlemStoreController } from '../../alemstore/createAlemStoreController'
import { groupAppsBySubcategory } from '../../alemstore/alemStoreSubcategories'
import AlemStoreAppGridCard from '../../components/alemstore/AlemStoreAppGridCard'
import AlemStoreHero from '../../components/alemstore/AlemStoreHero'
import AlemStoreCatalogSearch from '../../components/alemstore/AlemStoreCatalogSearch'
import AlemStoreSkeletons from '../../components/alemstore/AlemStoreSkeletons'
import type { AlemStoreAppViewModel } from '../../view-models/AlemStoreViewModel'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import CardShell from '../../../shared/ui/CardShell'
import AppToast from '../../../shared/ui/AppToast'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'

const sessionStore = new LocalStorageAuthSessionStore()

type SortKind = 'position' | 'rating'
type DownloadedKind = 'all' | 'downloaded' | 'not_downloaded'

export default function AlemStorePage() {
  const navigate = useNavigate()
  const [apps, setApps] = useState<AlemStoreAppViewModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKind>('position')
  const [downloaded, setDownloaded] = useState<DownloadedKind>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [pendingRatingId, setPendingRatingId] = useState<number | null>(null)
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

  const { alemStoreController } = useMemo(() => createAlemStoreController(), [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const loadApps = useCallback(
    async (options?: { force?: boolean; name?: string; downloaded?: boolean; category?: string }) => {
      setIsLoading(true)
      setError('')

      try {
        const viewModel = await alemStoreController.load({
          ...options,
          sort,
          category: options?.category,
        })
        setApps(viewModel.apps)
      } catch (error) {
        setError(getErrorMessage(error, 'Не удалось загрузить список приложений. Попробуйте снова.'))
      } finally {
        setIsLoading(false)
      }
    },
    [alemStoreController, sort],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadApps({
        name: query.trim() || undefined,
        downloaded: downloaded === 'all' ? undefined : downloaded === 'downloaded',
        category: selectedCategory || undefined,
      })
    }, 280)

    return () => window.clearTimeout(timeout)
  }, [downloaded, loadApps, query, selectedCategory])

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>()

    apps.forEach((app) => {
      app.tags.forEach((tag) => {
        const normalizedTag = tag.trim()
        if (!normalizedTag) {
          return
        }
        counts.set(normalizedTag, (counts.get(normalizedTag) ?? 0) + 1)
      })
    })

    return Array.from(counts.entries())
      .sort((left, right) => {
        if (left[1] !== right[1]) {
          return right[1] - left[1]
        }
        return left[0].localeCompare(right[0], 'ru')
      })
      .map(([tag, count]) => ({ tag, count }))
  }, [apps])

  useEffect(() => {
    const availableTags = new Set(tagOptions.map(({ tag }) => tag))
    setSelectedTags((current) => current.filter((tag) => availableTags.has(tag)))
  }, [tagOptions])

  const filteredApps = useMemo(() => {
    if (selectedTags.length === 0) {
      return apps
    }

    return apps.filter((app) => app.tags.some((tag) => selectedTags.includes(tag)))
  }, [apps, selectedTags])

  const heroApps = useMemo(
    () =>
      [...filteredApps]
        .sort((left, right) => {
          if (left.averageRating !== right.averageRating) {
            return right.averageRating - left.averageRating
          }
          if (left.ratingCount !== right.ratingCount) {
            return right.ratingCount - left.ratingCount
          }
          if (left.position !== right.position) {
            return left.position - right.position
          }
          return left.appName.localeCompare(right.appName, 'ru')
        })
        .slice(0, 3),
    [filteredApps],
  )
  const heroIds = useMemo(() => new Set(heroApps.map((app) => app.id)), [heroApps])
  const showStoreHero = heroApps.length === 3
  const listApps = useMemo(() => filteredApps.filter((app) => !heroIds.has(app.id)), [filteredApps, heroIds])

  const catalogGroups = useMemo(() => groupAppsBySubcategory(listApps), [listApps])

  const clearTags = useCallback(() => {
    setSelectedTags([])
  }, [])

  const toggleFavorite = async (targetApp: AlemStoreAppViewModel) => {
    if (pendingId !== null) {
      return
    }

    const previous = apps
    const nextFavorite = !targetApp.isFavorite

    setPendingId(targetApp.id)
    setError('')
    setApps((current) =>
      current.map((app) =>
        app.id === targetApp.id
          ? {
              ...app,
              isFavorite: nextFavorite,
            }
          : app,
      ),
    )

    try {
      if (nextFavorite) {
        await alemStoreController.addToFavorites(targetApp.id)
        setRemovedIds((prev) => prev.filter((id) => id !== targetApp.id))
        setToast('Добавлено в избранное')
      } else {
        await alemStoreController.removeFromFavorites(targetApp.id)
        setToast('Удалено из избранного')
      }
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Операция не выполнена. Попробуйте еще раз.'))
    } finally {
      setPendingId(null)
    }
  }

  const rateApp = async (targetApp: AlemStoreAppViewModel, rating: number) => {
    if (pendingRatingId !== null) {
      return
    }

    const previous = apps
    const next = apps.map((app) =>
      app.id === targetApp.id
        ? {
            ...app,
            myRating: rating,
          }
        : app,
    )

    setPendingRatingId(targetApp.id)
    setApps(next)
    setError('')

    try {
      const updated = await alemStoreController.rateApp(targetApp.id, rating)
      setApps((current) => current.map((app) => (app.id === updated.id ? updated : app)))
      setToast('Оценка сохранена')
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Не удалось сохранить оценку. Попробуйте снова.'))
    } finally {
      setPendingRatingId(null)
    }
  }

  const clearRating = async (targetApp: AlemStoreAppViewModel) => {
    if (pendingRatingId !== null) {
      return
    }

    const previous = apps
    setPendingRatingId(targetApp.id)
    setApps((current) => current.map((app) => (app.id === targetApp.id ? { ...app, myRating: null } : app)))
    setError('')

    try {
      const updated = await alemStoreController.clearRating(targetApp.id)
      setApps((current) => current.map((app) => (app.id === updated.id ? updated : app)))
      setToast('Оценка удалена')
    } catch (error) {
      setApps(previous)
      setError(getErrorMessage(error, 'Не удалось удалить оценку. Попробуйте снова.'))
    } finally {
      setPendingRatingId(null)
    }
  }

  const handleOpen = (app: AlemStoreAppViewModel) => {
    if (app.id === 42) {
      navigate('/alemai')
      return
    }

    if (app.id === 38) {
      navigate('/board')
      return
    }

    if (!app.link) {
      return
    }

    let finalUrl = app.link
    if (app.id === 39 || app.appName.toLowerCase().includes('drive')) {
      try {
        const url = new URL(app.link)
        const token = sessionStore.getTokens()?.accessToken
        if (token) {
          url.searchParams.set('token', token)
        }
        finalUrl = url.toString()
      } catch {
        // use original
      }
    }

    window.open(finalUrl, '_blank', 'noopener,noreferrer')
  }

  const totalAppsLabel =
    selectedTags.length > 0 ? `${filteredApps.length} из ${apps.length} приложений` : `${apps.length} приложений`

  return (
    <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
      {error ? <AppToast variant="error" message={error} onClose={() => setError('')} /> : null}
      {toast ? <AppToast variant="success" message={toast} onClose={() => setToast('')} /> : null}

      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <header className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[32px] font-extrabold leading-none tracking-[-0.03em] text-[#0A1628] sm:text-[38px]">
                  AlemStore
                </h1>
                <span className="inline-flex items-center rounded-full border border-[#D4E1F5] bg-white px-3 py-1 text-[13px] font-bold text-[#2C61C7] shadow-sm">
                  {totalAppsLabel}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#5A6F8E]">
                Каталог приложений для единого рабочего пространства.
              </p>
            </div>
            <button
              type="button"
              disabled={isLoading || pendingId !== null}
              onClick={() =>
                void loadApps({
                  force: true,
                  name: query.trim() || undefined,
                  downloaded: downloaded === 'all' ? undefined : downloaded === 'downloaded',
                })
              }
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-[#D8E1EF] bg-white px-5 text-[14px] font-bold text-[#374C6B] shadow-sm transition hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9EC2F8] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              <MaterialSymbol name="refresh" size={18} color="#8497B4" />
              Обновить
            </button>
          </div>

          <AlemStoreCatalogSearch
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            downloaded={downloaded}
            onDownloadedChange={setDownloaded}
            tagOptions={tagOptions}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            onClearTags={clearTags}
            category={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </header>

        <section className="mt-8">
          {isLoading ? <AlemStoreSkeletons /> : null}

          {!isLoading && showStoreHero ? (
            <AlemStoreHero
              apps={heroApps}
              pendingId={pendingId}
              pendingRatingId={pendingRatingId}
              onOpen={handleOpen}
              onToggleFavorite={(target) => {
                void toggleFavorite(target)
              }}
              onRate={(target, rating) => {
                void rateApp(target, rating)
              }}
              onClearRating={(target) => {
                void clearRating(target)
              }}
            />
          ) : null}

          {!isLoading && filteredApps.length === 0 ? (
            <CardShell className="p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF4FE]">
                <MaterialSymbol name="storefront" size={24} color="#1E88E5" />
              </div>
              <h2 className="text-lg font-bold text-[#0A1628]">Ничего не найдено</h2>
              <p className="mt-2 text-sm text-[#8497B4]">
                Измените поиск, фильтр по установке или выбранные теги.
              </p>
            </CardShell>
          ) : null}

          {!isLoading && catalogGroups.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#12243D] sm:text-[22px]">
                {showStoreHero ? 'Остальные приложения' : 'Каталог'}
              </h2>
              <div className="flex flex-col gap-10">
                {catalogGroups.map((group) => (
                  <div key={group.id}>
                    <h3 className="mb-3 flex items-center gap-0.5 text-[16px] font-bold tracking-[-0.02em] text-[#12243D] sm:text-[17px]">
                      <span>{group.title}</span>
                      <MaterialSymbol name="chevron_right" size={22} color="#B4C0D4" />
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {group.apps.map((app) => (
                        <AlemStoreAppGridCard
                          key={app.id}
                          app={app}
                          isPendingFavorite={pendingId === app.id}
                          isPendingRating={pendingRatingId === app.id}
                          onOpen={handleOpen}
                          onToggleFavorite={(target) => {
                            void toggleFavorite(target)
                          }}
                          onRate={(target, rating) => {
                            void rateApp(target, rating)
                          }}
                          onClearRating={(target) => {
                            void clearRating(target)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  )
}
