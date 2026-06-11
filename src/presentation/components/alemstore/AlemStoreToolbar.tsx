import AppSelect, { type AppSelectOption } from '../../../shared/ui/AppSelect'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { getAppTagTone } from '../../../shared/utils/appTagTone'

export interface AlemStoreTagFilterOption {
  tag: string
  count: number
}

interface AlemStoreToolbarProps {
  sort: 'position' | 'rating'
  onSortChange: (value: 'position' | 'rating') => void
  downloaded: 'all' | 'downloaded' | 'not_downloaded'
  onDownloadedChange: (value: 'all' | 'downloaded' | 'not_downloaded') => void
  tagOptions: AlemStoreTagFilterOption[]
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  onClearTags: () => void
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

function ToolbarSection({
  icon,
  title,
  description,
  headerAside,
  children,
}: {
  icon: string
  title: string
  description: string
  headerAside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-[#DCE5F2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ECF3FF] text-[#2E60B8]">
            <MaterialSymbol name={icon} size={16} color="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A8EAA]">{title}</p>
            <p className="mt-0.5 text-[13px] font-medium text-[#5F7291]">{description}</p>
          </div>
        </div>
        {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
      </div>
      {children}
    </div>
  )
}

export default function AlemStoreToolbar({
  sort,
  onSortChange,
  downloaded,
  onDownloadedChange,
  tagOptions,
  selectedTags,
  onSelectedTagsChange,
  onClearTags,
}: AlemStoreToolbarProps) {
  const tagSelectOptions: AppSelectOption[] = tagOptions.map(({ tag, count }) => ({
    value: tag,
    label: `${tag} (${count})`,
  }))

  return (
    <div className="relative z-20 mb-6 rounded-[28px] border border-[#D9E3F1] bg-white/90 p-4 shadow-[0_10px_30px_rgba(15,31,58,0.06)] backdrop-blur-sm">
      <div className={`grid gap-3 ${tagOptions.length > 0 ? 'xl:grid-cols-3 xl:items-stretch' : 'lg:grid-cols-2'}`}>
        <ToolbarSection icon="tune" title="Сортировка" description="Как показывать приложения в каталоге.">
          <div className="inline-flex w-fit items-center rounded-xl border border-[#D8E2F0] bg-white p-1">
            <button
              type="button"
              onClick={() => onSortChange('position')}
              className={[
                'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                sort === 'position' ? 'bg-[#EAF1FF] text-[#1C56C4]' : 'text-[#607493] hover:bg-[#F5F8FE]',
              ].join(' ')}
            >
              По умолчанию
            </button>
            <button
              type="button"
              onClick={() => onSortChange('rating')}
              className={[
                'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                sort === 'rating' ? 'bg-[#FFF3E2] text-[#A15A00]' : 'text-[#607493] hover:bg-[#F5F8FE]',
              ].join(' ')}
            >
              По рейтингу
            </button>
          </div>
        </ToolbarSection>

        <ToolbarSection icon="task_alt" title="Статус" description="Быстро отделяйте установленные приложения.">
          <div className="inline-flex w-fit items-center rounded-xl border border-[#D8E2F0] bg-white p-1">
            <button
              type="button"
              onClick={() => onDownloadedChange('all')}
              className={[
                'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                downloaded === 'all' ? 'bg-[#EAF1FF] text-[#1C56C4]' : 'text-[#607493] hover:bg-[#F5F8FE]',
              ].join(' ')}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => onDownloadedChange('downloaded')}
              className={[
                'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                downloaded === 'downloaded' ? 'bg-[#EAF1FF] text-[#1C56C4]' : 'text-[#607493] hover:bg-[#F5F8FE]',
              ].join(' ')}
            >
              Установленные
            </button>
            <button
              type="button"
              onClick={() => onDownloadedChange('not_downloaded')}
              className={[
                'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                downloaded === 'not_downloaded' ? 'bg-[#EAF1FF] text-[#1C56C4]' : 'text-[#607493] hover:bg-[#F5F8FE]',
              ].join(' ')}
            >
              Неустановленные
            </button>
          </div>
        </ToolbarSection>

        {tagOptions.length > 0 ? (
          <ToolbarSection
            icon="label"
            title="Фильтр по тегам"
            description="Можно выбрать несколько тегов сразу."
            headerAside={
              <span className="inline-flex items-center rounded-full border border-[#D7E4F6] bg-white px-2.5 py-1 text-[11px] font-bold text-[#45658F]">
                {selectedTags.length > 0 ? `${selectedTags.length} выбрано` : `${tagOptions.length} тегов`}
              </span>
            }
          >
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
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
                buttonClassName="h-11 rounded-xl border-[#D8E2F0] bg-white px-3 text-[14px] font-semibold text-[#294869]"
                menuClassName="top-[calc(100%+8px)] z-[520] max-h-72 rounded-2xl border-[#D8E2F0] p-2"
                ariaLabel="Фильтр по тегам"
              />

              {selectedTags.length > 0 ? (
                <button
                  type="button"
                  onClick={onClearTags}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D9E4F4] bg-[#F8FBFF] px-3.5 text-[13px] font-semibold text-[#4A648B] transition hover:bg-[#EEF4FF]"
                >
                  <MaterialSymbol name="refresh" size={16} color="currentColor" />
                  Сбросить
                </button>
              ) : null}
            </div>
          </ToolbarSection>
        ) : null}
      </div>

      {selectedTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E7EDF7] pt-4">
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
