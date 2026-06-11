import { useState } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { getAppTagTone } from '../../../shared/utils/appTagTone'
import type { AlemStoreAppViewModel } from '../../view-models/AlemStoreViewModel'

interface AlemStoreAppCardProps {
  app: AlemStoreAppViewModel
  isPendingFavorite: boolean
  isPendingRating: boolean
  onToggleFavorite: (app: AlemStoreAppViewModel) => void
  onOpen: (app: AlemStoreAppViewModel) => void
  onRate: (app: AlemStoreAppViewModel, rating: number) => void
  onClearRating: (app: AlemStoreAppViewModel) => void
}

export default function AlemStoreAppCard({
  app,
  isPendingFavorite,
  isPendingRating,
  onToggleFavorite,
  onOpen,
  onRate,
  onClearRating,
}: AlemStoreAppCardProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [isTagsExpanded, setIsTagsExpanded] = useState(false)
  const hasPhoto = Boolean(app.appPhoto)
  const canOpen = Boolean(app.link) || app.id === 38
  const ratingLabel = app.ratingCount > 0 ? `${app.averageRating.toFixed(1)} ★ (${app.ratingCount})` : 'Нет оценок'
  const previewRating = hoverRating ?? app.myRating
  const collapsedTags = app.tags.slice(0, 3)
  const visibleTags = isTagsExpanded ? app.tags : collapsedTags
  const hiddenTagsCount = Math.max(app.tags.length - collapsedTags.length, 0)

  return (
    <article className="group relative flex h-full min-h-80 flex-col overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-[0_2px_8px_rgba(15,31,58,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(15,31,58,0.08)]">
      <div className="mb-4 flex min-h-16 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#D7E0ED] bg-[#F7FAFF] p-2">
            {hasPhoto ? (
              <img src={app.appPhoto as string} alt={app.appName} className="h-full w-full object-contain" />
            ) : (
              <MaterialSymbol name="apps" size={22} color="#2A5DB0" />
            )}
          </div>

          <div className="min-w-0 pt-1">
            <h3
              className="text-[18px] font-bold leading-tight text-[#13233E] sm:text-[20px]"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {app.appName}
            </h3>
          </div>
        </div>

        <button
          type="button"
          disabled={isPendingFavorite}
          onClick={() => onToggleFavorite(app)}
          aria-label={app.isFavorite ? `Убрать ${app.appName} из избранного` : `Добавить ${app.appName} в избранное`}
          className={[
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50',
            app.isFavorite
              ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
              : 'border-[#E3EAF5] bg-[#F8FAFF] text-[#8CA0BE] hover:border-[#C9D7EB] hover:text-[#2A5DB0]',
          ].join(' ')}
        >
          <MaterialSymbol name={isPendingFavorite ? 'hourglass_top' : 'star'} size={18} color="currentColor" />
        </button>
      </div>

      <div className="mb-4 flex min-h-6 items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-[#334968]">{ratingLabel}</p>
        {app.isFavorite ? (
          <span className="inline-flex items-center rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[11px] font-bold text-[#0E9F6E]">
            В избранном
          </span>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#E5ECF7] bg-[#FAFCFF] px-3.5 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#7B8FAA]">Ваша оценка</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(null)}>
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
                  onClick={() => onRate(app, value)}
                  className={[
                    'h-6 w-6 text-[18px] leading-none transition-transform duration-150 active:scale-95',
                    isPendingRating ? 'cursor-not-allowed opacity-50' : 'hover:scale-110',
                    isActive ? 'text-[#F59E0B]' : 'text-[#C8D3E4]',
                  ].join(' ')}
                  aria-label={`Оценить ${app.appName} на ${value}`}
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
              onClick={() => onClearRating(app)}
              className="text-[12px] font-semibold text-[#5B6F8E] underline decoration-dotted underline-offset-2 transition hover:text-[#2D4E80] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 min-h-18.5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#7B8FAA]">
          <MaterialSymbol name="label" size={12} color="#8AA2C4" />
          Теги
        </div>
        <div className="flex min-h-9 items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap content-start gap-2">
            {visibleTags.length > 0 ? (
              <>
                {visibleTags.map((tag) => {
                  const tone = getAppTagTone(tag)

                  return (
                    <span
                      key={`${app.id}-${tag}`}
                      className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold"
                      style={tone.chipStyle}
                    >
                      {tag}
                    </span>
                  )
                })}
              </>
            ) : (
              <span className="inline-flex items-center rounded-full border border-dashed border-[#DCE6F3] bg-[#FAFCFF] px-3 py-1 text-[11px] font-medium text-[#8A9BB4]">
                Без тегов
              </span>
            )}
          </div>
          {hiddenTagsCount > 0 || isTagsExpanded ? (
            <button
              type="button"
              onClick={() => setIsTagsExpanded((prev) => !prev)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#D8E4F6] bg-[#F8FBFF] px-2.5 py-1 text-[12px] font-semibold text-[#3B5C87] transition hover:bg-[#EEF4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9EC2F8]"
            >
              <MaterialSymbol
                name="keyboard_double_arrow_right"
                size={14}
                color="currentColor"
                style={{
                  transform: isTagsExpanded ? 'rotate(-90deg)' : 'rotate(90deg)',
                  transition: 'transform 180ms ease',
                }}
              />
              {isTagsExpanded ? 'Скрыть' : `Все (+${hiddenTagsCount})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-auto border-t border-[#EEF3FA] pt-4">
        <button
          type="button"
          disabled={!canOpen}
          aria-label={`Открыть ${app.appName}`}
          onClick={() => onOpen(app)}
          className={[
            'inline-flex h-11 w-full items-center justify-center rounded-xl border text-[16px] font-semibold transition',
            canOpen
              ? 'border-[#D8E2F0] bg-[#FBFDFF] text-[#2E3F5B] hover:bg-[#F3F7FD]'
              : 'cursor-not-allowed border-[#E2E8F2] bg-[#F8FAFD] text-[#A7B6C9]',
          ].join(' ')}
        >
          Открыть
        </button>
      </div>
    </article>
  )
}
