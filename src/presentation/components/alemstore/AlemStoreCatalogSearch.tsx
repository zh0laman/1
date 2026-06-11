import { useEffect, useMemo, useRef, useState } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import AlemStoreFiltersPanel, { type AlemStoreTagFilterOption } from './AlemStoreFiltersPanel'

interface AlemStoreCatalogSearchProps {
  query: string
  onQueryChange: (value: string) => void
  sort: 'position' | 'rating'
  onSortChange: (value: 'position' | 'rating') => void
  downloaded: 'all' | 'downloaded' | 'not_downloaded'
  onDownloadedChange: (value: 'all' | 'downloaded' | 'not_downloaded') => void
  tagOptions: AlemStoreTagFilterOption[]
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  onClearTags: () => void
  category: string
  onCategoryChange: (value: string) => void
}

export default function AlemStoreCatalogSearch({
  query,
  onQueryChange,
  sort,
  onSortChange,
  downloaded,
  onDownloadedChange,
  tagOptions,
  selectedTags,
  onSelectedTagsChange,
  onClearTags,
  category,
  onCategoryChange,
}: AlemStoreCatalogSearchProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = useMemo(() => {
    let n = selectedTags.length
    if (sort !== 'position') {
      n += 1
    }
    if (downloaded !== 'all') {
      n += 1
    }
    if (category) {
      n += 1
    }
    return n
  }, [category, downloaded, selectedTags.length, sort])

  useEffect(() => {
    if (!filtersOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [filtersOpen])

  return (
    <div
      ref={rootRef}
      className={[
        'relative mx-auto mt-6 w-full max-w-2xl transition-[z-index]',
        filtersOpen ? 'z-40' : 'z-30',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-[52px] items-stretch overflow-hidden rounded-full border bg-white shadow-[0_4px_24px_rgba(15,31,58,0.06)] transition',
          filtersOpen
            ? 'border-[#9BB4E8] ring-4 ring-[#D9E6FA]/80'
            : 'border-[#D0DBED] focus-within:border-[#9BB4E8] focus-within:ring-4 focus-within:ring-[#D9E6FA]/80',
        ].join(' ')}
      >
        <label className="relative flex min-w-0 flex-1 cursor-text items-center">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8CA0BE]">
            <MaterialSymbol name="search" size={22} color="currentColor" />
          </span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Поиск приложений..."
            className="h-full w-full min-w-0 border-0 bg-transparent py-3 pl-12 pr-3 text-[16px] text-[#12243D] outline-none placeholder:text-[#94A3B8]"
          />
        </label>

        <div className="my-2.5 w-px shrink-0 bg-[#E2E8F2]" aria-hidden />

        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-haspopup="dialog"
          aria-controls="alemstore-filters-panel"
          id="alemstore-filters-trigger"
          aria-label="Фильтры и сортировка каталога"
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex shrink-0 items-center justify-center gap-2 px-3 text-[#3D5270] transition hover:bg-[#F4F7FC] hover:text-[#12243D] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9EC2F8] sm:px-4"
        >
          <MaterialSymbol name="tune" size={22} color="currentColor" />
          <span className="hidden text-[13px] font-bold sm:inline">Фильтры</span>
          {activeFilterCount > 0 ? (
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#1C56C4] px-1.5 text-[11px] font-bold text-white">
              {activeFilterCount > 9 ? '9+' : activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div
          id="alemstore-filters-panel"
          role="dialog"
          aria-label="Панель фильтров"
          className="absolute left-1/2 top-[calc(100%+10px)] z-50 w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 rounded-2xl border border-[#D9E3F1] bg-white p-4 shadow-[0_16px_48px_rgba(15,31,58,0.14)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#EEF2F8] pb-3">
            <p className="text-[15px] font-extrabold text-[#12243D]">Фильтры каталога</p>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#6B7F9A] transition hover:bg-[#F0F4FA] hover:text-[#12243D]"
              aria-label="Закрыть"
            >
              <MaterialSymbol name="close" size={20} color="currentColor" />
            </button>
          </div>
          <AlemStoreFiltersPanel
            sort={sort}
            onSortChange={onSortChange}
            downloaded={downloaded}
            onDownloadedChange={onDownloadedChange}
            tagOptions={tagOptions}
            selectedTags={selectedTags}
            onSelectedTagsChange={onSelectedTagsChange}
            onClearTags={onClearTags}
            category={category}
            onCategoryChange={onCategoryChange}
          />
        </div>
      ) : null}
    </div>
  )
}
