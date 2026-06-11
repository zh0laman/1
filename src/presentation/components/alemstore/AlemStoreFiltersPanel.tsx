import AppSelect, { type AppSelectOption } from '../../../shared/ui/AppSelect'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { getAppTagTone } from '../../../shared/utils/appTagTone'

export interface AlemStoreTagFilterOption {
  tag: string
  count: number
}

interface AlemStoreFiltersPanelProps {
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

const buildSelectedTagsSummary = (options: AppSelectOption[]): string => {
  if (options.length === 0) {
    return 'Фильтр по тегам'
  }
  if (options.length === 1) {
    return `Теги: ${options[0]?.value ?? ''}`
  }
  if (options.length === 2) {
    return `Теги: ${options[0]?.value ?? ''}, ${options[1]?.value ?? ''}`
  }

  return `Теги: ${options[0]?.value ?? ''}, ${options[1]?.value ?? ''} +${options.length - 2}`
}

export default function AlemStoreFiltersPanel({
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
}: AlemStoreFiltersPanelProps) {
  const tagSelectOptions: AppSelectOption[] = tagOptions.map(({ tag, count }) => ({
    value: tag,
    label: `${tag} (${count})`,
  }))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A8EAA]">
          <MaterialSymbol name="category" size={14} color="#8AA2C4" />
          Категория
        </p>
        <div className="inline-flex w-full flex-wrap items-center rounded-xl border border-[#D8E2F0] bg-[#F8FAFF] p-0.5">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              category === '' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Все
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange('ИИ')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              category === 'ИИ' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            ИИ
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange('Документация')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              category === 'Документация' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Документы
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange('Разработка')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              category === 'Разработка' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Разработка
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange('Прочие')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              category === 'Прочие' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Прочие
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A8EAA]">
          <MaterialSymbol name="tune" size={14} color="#8AA2C4" />
          Сортировка
        </p>
        <div className="inline-flex w-full max-w-full flex-wrap items-center rounded-xl border border-[#D8E2F0] bg-[#F8FAFF] p-0.5">
          <button
            type="button"
            onClick={() => onSortChange('position')}
            className={[
              'min-h-10 flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-4',
              sort === 'position' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            По умолчанию
          </button>
          <button
            type="button"
            onClick={() => onSortChange('rating')}
            className={[
              'min-h-10 flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-4',
              sort === 'rating' ? 'bg-white text-[#A15A00] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            По рейтингу
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A8EAA]">
          <MaterialSymbol name="task_alt" size={14} color="#8AA2C4" />
          Статус
        </p>
        <div className="inline-flex w-full flex-wrap items-center rounded-xl border border-[#D8E2F0] bg-[#F8FAFF] p-0.5">
          <button
            type="button"
            onClick={() => onDownloadedChange('all')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              downloaded === 'all' ? 'bg-white text-[#1C56C4] shadow-sm' : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Все
          </button>
          <button
            type="button"
            onClick={() => onDownloadedChange('downloaded')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              downloaded === 'downloaded'
                ? 'bg-white text-[#1C56C4] shadow-sm'
                : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Установленные
          </button>
          <button
            type="button"
            onClick={() => onDownloadedChange('not_downloaded')}
            className={[
              'min-h-10 flex-1 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-3',
              downloaded === 'not_downloaded'
                ? 'bg-white text-[#1C56C4] shadow-sm'
                : 'text-[#607493] hover:text-[#12243D]',
            ].join(' ')}
          >
            Неустановленные
          </button>
        </div>
      </div>

      {tagOptions.length > 0 ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A8EAA]">
              <MaterialSymbol name="label" size={14} color="#8AA2C4" />
              Теги
            </p>
            <span className="text-[12px] font-semibold text-[#6B7F9A]">{tagOptions.length} тегов</span>
          </div>
          <div className="flex flex-col gap-2">
            <AppSelect
              value=""
              options={tagSelectOptions}
              onChange={() => undefined}
              multiple
              selectedValues={selectedTags}
              onSelectedValuesChange={onSelectedTagsChange}
              closeOnSelect={false}
              searchable={tagSelectOptions.length > 6}
              searchPlaceholder="Найти тег..."
              placeholder="Фильтр по тегам"
              selectedSummaryText={buildSelectedTagsSummary}
              className="relative z-30 w-full"
              buttonClassName="h-11 w-full rounded-xl border-[#D8E2F0] bg-white px-3 text-[14px] font-semibold text-[#294869]"
              menuClassName="top-[calc(100%+8px)] z-[560] max-h-72 rounded-2xl border-[#D8E2F0] p-2"
              ariaLabel="Фильтр по тегам"
            />
            {selectedTags.length > 0 ? (
              <button
                type="button"
                onClick={onClearTags}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#D9E4F4] bg-[#F8FBFF] px-3 text-[13px] font-semibold text-[#4A648B] transition hover:bg-[#EEF4FF]"
              >
                <MaterialSymbol name="refresh" size={16} color="currentColor" />
                Сбросить теги
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[#E7EDF7] pt-4">
          {selectedTags.map((tag) => {
            const tone = getAppTagTone(tag)

            return (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectedTagsChange(selectedTags.filter((value) => value !== tag))}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition hover:brightness-[0.98]"
                style={tone.chipStyle}
              >
                <span>{tag}</span>
                <MaterialSymbol name="close" size={14} color="currentColor" />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
