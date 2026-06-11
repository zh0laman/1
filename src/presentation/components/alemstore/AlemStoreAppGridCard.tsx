import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { AlemStoreAppViewModel } from '../../view-models/AlemStoreViewModel'

interface AlemStoreAppGridCardProps {
  app: AlemStoreAppViewModel
  isPendingFavorite: boolean
  isPendingRating: boolean
  onToggleFavorite: (app: AlemStoreAppViewModel) => void
  onOpen: (app: AlemStoreAppViewModel) => void
  onRate: (app: AlemStoreAppViewModel, rating: number) => void
  onClearRating: (app: AlemStoreAppViewModel) => void
}

export default function AlemStoreAppGridCard({
  app,
  isPendingFavorite,
  isPendingRating,
  onToggleFavorite,
  onOpen,
  onRate,
  onClearRating,
}: AlemStoreAppGridCardProps) {
  const [ratingOpen, setRatingOpen] = useState(false)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hasPhoto = Boolean(app.appPhoto)
  const canOpen = Boolean(app.link) || app.id === 38
  const firstTag = app.tags.find((t) => t.trim())?.trim()

  const previewRating = hoverRating ?? app.myRating

  useEffect(() => {
    if (!ratingOpen) {
      return
    }

    const close = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setRatingOpen(false)
        setHoverRating(null)
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRatingOpen(false)
        setHoverRating(null)
      }
    }

    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [ratingOpen])

  const handleCardClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!canOpen) return
    const el = event.target as HTMLElement
    if (el.closest('button')) return
    if (el.closest('[data-rating-popover]')) return
    onOpen(app)
  }

  return (
    <article
      aria-label={canOpen ? `Открыть приложение: ${app.appName}` : undefined}
      onClick={handleCardClick}
      className={[
        'flex h-full flex-col rounded-2xl border border-[#E8EDF6] bg-white p-4 shadow-[0_1px_3px_rgba(15,31,58,0.04)] transition',
        canOpen
          ? 'cursor-pointer hover:border-[#C5D3E8] hover:shadow-[0_10px_28px_rgba(15,31,58,0.09)]'
          : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex gap-3.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8ECF4] bg-[#F6F9FF] p-2">
          {hasPhoto ? (
            <img src={app.appPhoto as string} alt="" className="h-full w-full object-contain" />
          ) : (
            <MaterialSymbol name="apps" size={28} color="#2A5DB0" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="min-w-0 flex-1 text-[15px] font-bold leading-snug tracking-[-0.02em] text-[#0F1F36]"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {app.appName}
            </h3>
            <button
              type="button"
              disabled={isPendingFavorite}
              onClick={() => onToggleFavorite(app)}
              aria-label={app.isFavorite ? 'Убрать из избранного' : 'В избранное'}
              className={[
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50',
                app.isFavorite
                  ? 'bg-[#F0FDF4] text-[#16A34A] ring-1 ring-[#BBF7D0]'
                  : 'bg-[#F1F5FA] text-[#8B9DB8] hover:bg-[#E8EEF6] hover:text-[#2A5DB0]',
              ].join(' ')}
            >
              <MaterialSymbol name={isPendingFavorite ? 'hourglass_top' : 'star'} size={20} color="currentColor" />
            </button>
          </div>

          {app.isFavorite ? (
            <p className="mt-1.5 text-[11px] font-semibold text-[#0E9F6E]">В избранном</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-relaxed text-[#647896]">
            {app.ratingCount > 0 ? (
              <span className="flex items-center gap-1">
                <MaterialSymbol name="star" size={14} color="#F59E0B" />
                <span className="font-medium text-[#12243D]">{app.averageRating.toFixed(1)}</span>
                <span className="text-[#8497B4]">({app.ratingCount})</span>
              </span>
            ) : (
              <span className="text-[#8497B4]">Без оценок</span>
            )}

            {app.favoriteCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-[#D1D9E6]" />
                <span className="flex items-center gap-1" title="Добавили в избранное">
                  <MaterialSymbol name="group" size={15} color="#8497B4" />
                  <span className="font-medium text-[#12243D]">{app.favoriteCount}</span>
                </span>
              </>
            )}

            {firstTag ? (
              <>
                <span className="h-1 w-1 rounded-full bg-[#D1D9E6]" />
                <span className="truncate text-[#8497B4]" title={firstTag}>
                  {firstTag}
                </span>
              </>
            ) : null}

            {app.category && (
              <>
                <span className="h-1 w-1 rounded-full bg-[#D1D9E6]" />
                <span className="rounded-full bg-[#EBF4FE] px-2 py-px text-[10px] font-bold text-[#1E88E5]">
                  {app.category}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div ref={rootRef} className="relative mt-4 flex items-center justify-between gap-2 border-t border-[#F0F3F9] pt-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setRatingOpen((open) => !open)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#3D5A86] transition hover:bg-[#F4F7FC] hover:text-[#12243D]"
            aria-expanded={ratingOpen}
          >
            {app.myRating !== null ? (
              <>
                <span>Ваша оценка: {app.myRating}/5</span>
                <MaterialSymbol name="expand_more" size={18} color="currentColor" />
              </>
            ) : (
              <>
                <span>Оценить</span>
                <MaterialSymbol name="expand_more" size={18} color="currentColor" />
              </>
            )}
          </button>

          {ratingOpen ? (
            <div
              data-rating-popover
              className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-[min(calc(100vw-3rem),240px)] rounded-xl border border-[#E2E9F4] bg-white p-3 shadow-[0_12px_40px_rgba(15,31,58,0.12)]"
              onMouseLeave={() => setHoverRating(null)}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB8]">
                Ваша оценка
              </p>
              <div className="flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1
                  const isActive = (previewRating ?? 0) >= value
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={isPendingRating}
                      onMouseEnter={() => setHoverRating(value)}
                      onFocus={() => setHoverRating(value)}
                      onBlur={() => setHoverRating(null)}
                      onClick={() => {
                        void onRate(app, value)
                        setRatingOpen(false)
                        setHoverRating(null)
                      }}
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-lg text-[20px] leading-none transition',
                        isPendingRating ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#F4F7FC] active:scale-95',
                        isActive ? 'text-[#F59E0B]' : 'text-[#D5DEEA]',
                      ].join(' ')}
                      aria-label={`Оценить на ${value}`}
                    >
                      ★
                    </button>
                  )
                })}
              </div>
              {app.myRating !== null ? (
                <button
                  type="button"
                  disabled={isPendingRating}
                  onClick={() => {
                    void onClearRating(app)
                    setRatingOpen(false)
                  }}
                  className="mt-2 w-full rounded-lg py-1.5 text-[12px] font-semibold text-[#5B6F8E] transition hover:bg-[#F6F8FC] hover:text-[#12243D] disabled:opacity-50"
                >
                  Убрать оценку
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {canOpen ? (
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
    </article>
  )
}
