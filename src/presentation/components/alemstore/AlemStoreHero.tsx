import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { AlemStoreAppViewModel } from '../../view-models/AlemStoreViewModel'

interface AlemStoreHeroProps {
  apps: AlemStoreAppViewModel[]
  pendingId: number | null
  pendingRatingId: number | null
  onOpen: (app: AlemStoreAppViewModel) => void
  onToggleFavorite: (app: AlemStoreAppViewModel) => void
  onRate: (app: AlemStoreAppViewModel, rating: number) => void
  onClearRating: (app: AlemStoreAppViewModel) => void
}

type CardRole = 'far-left' | 'left' | 'center' | 'right' | 'far-right'

function CardVisual({ app }: { app: AlemStoreAppViewModel }) {
  if (app.appPhoto) {
    return (
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(214,228,252,0.9),_rgba(245,248,255,0.88)_42%,_rgba(255,255,255,0.98)_100%)]">
        <img
          src={app.appPhoto}
          alt=""
          className="absolute inset-0 h-full w-full object-contain p-5 sm:p-6"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(88,126,214,0.28),_transparent_48%),linear-gradient(145deg,_#EDF4FF_0%,_#DCE9FB_46%,_#F9FBFF_100%)]">
      <MaterialSymbol name="apps" size={60} color="#2C61C7" />
    </div>
  )
}

function RibbonCard({
  app,
  role,
  pendingId,
  onOpen,
  onActivate,
  onToggleFavorite,
}: {
  app: AlemStoreAppViewModel
  role: CardRole
  pendingId: number | null
  onOpen: (app: AlemStoreAppViewModel) => void
  onActivate?: () => void
  onToggleFavorite: (app: AlemStoreAppViewModel) => void
}) {
  const isCenter = role === 'center'
  const canOpen = Boolean(app.link) || app.id === 38
  const ratingLabel = app.ratingCount > 0 ? app.averageRating.toFixed(1) : 'Новая'
  const votesLabel = app.ratingCount > 0 ? `${app.ratingCount} оценок` : 'Пока без оценок'
  const tag = app.tags.find((item) => item.trim())?.trim()

  const roleClass =
    role === 'center'
      ? 'left-1/2 top-1/2 z-30 h-[350px] w-[292px] -translate-x-1/2 -translate-y-1/2 scale-100 opacity-100'
      : role === 'left'
        ? 'left-1/2 top-1/2 z-20 hidden h-[350px] w-[292px] -translate-x-[calc(50%+184px)] -translate-y-1/2 scale-[0.84] opacity-65 md:block'
        : role === 'right'
          ? 'left-1/2 top-1/2 z-20 hidden h-[350px] w-[292px] translate-x-[calc(-50%+184px)] -translate-y-1/2 scale-[0.84] opacity-65 md:block'
          : role === 'far-left'
            ? 'left-1/2 top-1/2 z-10 hidden h-[350px] w-[292px] -translate-x-[calc(50%+360px)] -translate-y-1/2 scale-[0.74] opacity-0 md:block'
            : 'left-1/2 top-1/2 z-10 hidden h-[350px] w-[292px] translate-x-[calc(-50%+360px)] -translate-y-1/2 scale-[0.74] opacity-0 md:block'

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isCenter && onActivate) {
      onActivate()
      return
    }
    if (!canOpen) return
    if ((event.target as HTMLElement).closest('button')) return
    onOpen(app)
  }

  return (
    <div
      role="presentation"
      onClick={handleClick}
      className={[
        'group absolute overflow-hidden rounded-[26px] border bg-white transform-gpu transition-[transform,opacity,box-shadow,filter] duration-[420ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform',
        roleClass,
        isCenter
          ? 'cursor-pointer border-[#D7E3F3] shadow-[0_18px_38px_rgba(44,97,199,0.10)]'
          : role === 'far-left' || role === 'far-right'
            ? 'pointer-events-none border-[#E2EAF5] shadow-none saturate-[0.88] brightness-[0.98]'
            : 'cursor-pointer border-[#E2EAF5] shadow-[0_10px_24px_rgba(15,31,58,0.05)] saturate-[0.9] brightness-[0.98]',
      ].join(' ')}
    >
      <div className="absolute inset-0">
        <CardVisual app={app} />
        <div
          className={[
            'absolute inset-0',
            isCenter
              ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_30%,rgba(248,251,255,0.18)_58%,rgba(232,239,250,0.9)_100%)]'
              : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.1)_34%,rgba(234,241,251,0.88)_100%)]',
          ].join(' ')}
        />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
        {tag ? (
          <span className="rounded-full border border-white/60 bg-white/82 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#355795] backdrop-blur-sm">
            {tag}
          </span>
        ) : (
          <span />
        )}
        <div className="rounded-full border border-white/60 bg-white/84 px-2.5 py-1 text-[13px] font-extrabold text-[#223B62] shadow-sm backdrop-blur-sm">
          {ratingLabel}
          <span className="ml-1 text-[#F4B740]">★</span>
        </div>
      </div>

      {isCenter ? (
        <button
          type="button"
          disabled={pendingId === app.id}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(app)
          }}
          aria-label={app.isFavorite ? 'Убрать из избранного' : 'В избранное'}
          className={[
            'absolute left-3.5 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/84 text-[#355795] shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-50',
            app.isFavorite ? 'text-[#F4B740]' : '',
          ].join(' ')}
        >
          <MaterialSymbol
            name={pendingId === app.id ? 'hourglass_top' : app.isFavorite ? 'star' : 'star_outline'}
            size={18}
            color="currentColor"
          />
        </button>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-3.5">
        <div
          className={[
            'rounded-[22px] border backdrop-blur-xl',
            isCenter
              ? 'border-white/70 bg-[rgba(255,255,255,0.92)] p-3.5 shadow-[0_16px_32px_rgba(145,170,210,0.18)]'
              : 'border-white/65 bg-[rgba(244,248,255,0.9)] p-3 shadow-[0_12px_26px_rgba(145,170,210,0.14)]',
          ].join(' ')}
        >
          <h3
            className={[
              'font-extrabold tracking-[-0.03em] text-[#1A2E4C] transition-[font-size] duration-[420ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
              isCenter ? 'text-[18px] leading-[1.02] sm:text-[20px]' : 'text-[13px] leading-[1.05]',
            ].join(' ')}
          >
            {app.appName}
          </h3>
          <p className="mt-1.5 text-[12px] font-medium text-[#6B7F9A]">{votesLabel}</p>

          {isCenter ? (
            <div className="mt-3.5 flex items-center justify-between gap-2.5">
              <span className="rounded-full border border-[#D8E3F2] bg-[#F6F9FF] px-3 py-1.5 text-[11px] font-semibold text-[#48617F]">
                {app.favoriteCount > 0 ? `${app.favoriteCount} в избранном` : 'Доступно в каталоге'}
              </span>
              {canOpen ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpen(app)
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4.5 text-[12px] font-bold text-[#12243D] transition hover:bg-[#EEF4FF]"
                >
                  Открыть
                  <MaterialSymbol name="north_east" size={16} color="currentColor" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AlemStoreHero({
  apps,
  pendingId,
  pendingRatingId: _pendingRatingId,
  onOpen,
  onToggleFavorite,
  onRate: _onRate,
  onClearRating: _onClearRating,
}: AlemStoreHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const featuredApps = useMemo(
    () =>
      [...apps]
        .sort((left, right) => {
          if (left.averageRating !== right.averageRating) {
            return right.averageRating - left.averageRating
          }
          if (left.ratingCount !== right.ratingCount) {
            return right.ratingCount - left.ratingCount
          }
          return left.position - right.position
        })
        .slice(0, 3),
    [apps],
  )

  useEffect(() => {
    if (featuredApps.length <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % featuredApps.length)
    }, 3800)

    return () => window.clearInterval(intervalId)
  }, [featuredApps.length])

  useEffect(() => {
    setActiveIndex(0)
  }, [featuredApps])

  if (featuredApps.length === 0) {
    return null
  }

  const safeIndex = activeIndex % featuredApps.length
  const canSlide = featuredApps.length > 1

  const goPrev = () => {
    setActiveIndex((current) => (current + featuredApps.length - 1) % featuredApps.length)
  }

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % featuredApps.length)
  }

  const cards = [
    { offset: -2, role: 'far-left' as const },
    { offset: -1, role: 'left' as const },
    { offset: 0, role: 'center' as const },
    { offset: 1, role: 'right' as const },
    { offset: 2, role: 'far-right' as const },
  ].map(({ offset, role }) => ({
    role,
    app: featuredApps[(safeIndex + offset + featuredApps.length * 10) % featuredApps.length],
  }))

  return (
    <section
      className="mb-8 overflow-hidden rounded-[26px] border border-[#DCE6F3] bg-white p-4 shadow-[0_16px_36px_rgba(15,31,58,0.05)] sm:p-4.5 lg:p-5"
      aria-label="Рекомендуемые приложения"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-[#12243D] sm:text-[22px]">Рекомендуем</h2>
          <p className="mt-1 text-[13px] font-medium text-[#6B7F9A]">Три сервиса с лучшими оценками пользователей</p>
        </div>
        {canSlide ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Предыдущий сервис"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D8E3F2] bg-white text-[#425A7B] shadow-sm transition hover:border-[#BED0EA] hover:text-[#12243D]"
            >
              <MaterialSymbol name="chevron_left" size={20} color="currentColor" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Следующий сервис"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D8E3F2] bg-white text-[#425A7B] shadow-sm transition hover:border-[#BED0EA] hover:text-[#12243D]"
            >
              <MaterialSymbol name="chevron_right" size={20} color="currentColor" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative mt-5 overflow-hidden rounded-[22px] bg-[#FCFDFF] px-2 py-2 sm:px-2.5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-9 bg-[linear-gradient(90deg,#FCFDFF_0%,rgba(252,253,255,0.82)_46%,rgba(252,253,255,0)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-[linear-gradient(270deg,#FCFDFF_0%,rgba(252,253,255,0.82)_46%,rgba(252,253,255,0)_100%)]" />

        <div className="relative mx-auto min-h-[360px] max-w-[740px] overflow-visible">
          {cards.map(({ app, role }) => (
            <RibbonCard
              key={`${app.id}-${role}`}
              app={app}
              role={role}
              pendingId={pendingId}
              onOpen={onOpen}
              onActivate={role === 'left' ? goPrev : role === 'right' ? goNext : undefined}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>

        {canSlide ? (
          <div className="mt-3 flex items-center justify-center gap-2">
            {featuredApps.map((app, index) => {
              const isActive = index === safeIndex
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Показать ${app.appName}`}
                  aria-pressed={isActive}
                  className={[
                    'rounded-full transition',
                    isActive ? 'h-2.5 w-10 bg-[#2C61C7]' : 'h-2.5 w-2.5 bg-[#C9D5E8] hover:bg-[#AFC2E0]',
                  ].join(' ')}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
