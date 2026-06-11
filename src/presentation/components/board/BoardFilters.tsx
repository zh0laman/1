import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardOptionViewModel, BoardSprintViewModel, BoardUserViewModel } from '../../view-models/BoardViewModel'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import AppSelect from '../../../shared/ui/AppSelect'

interface BoardFiltersProps {
  boards: BoardOptionViewModel[]
  users?: BoardUserViewModel[]
  selectedBoardId: string
  sprintOptions: BoardSprintViewModel[]
  selectedSprintId: string
  search: string
  filterUserId: string
  filterStatus: string
  filterDate: string
  filterLabelId?: string
  labels?: Array<{ id: string, name: string }>
  onBoardChange: (value: string) => void
  onSprintChange: (value: string) => void
  onSearchChange: (value: string) => void
  onFilterUserChange: (value: string) => void
  onFilterStatusChange: (value: string) => void
  onFilterDateChange: (value: string) => void
  onFilterLabelChange?: (value: string) => void
  onApplyFilters: () => void
  onResetFilters: () => void
  // injected from BoardPage for toolbar integration
  boardName?: string
  totalTasks?: number
  isRefreshing?: boolean
  onRefresh?: () => void
  appearance?: 'classic' | 'modern'
}

type FilterChipProps = {
  label: string
  active: boolean
  children: React.ReactNode
}

function FilterSection({ label, active, children }: FilterChipProps) {
  return (
    <div
      className={`relative flex items-center rounded-lg border px-0.5 transition-all ${
        active
          ? 'border-[#1E88E5] bg-[#EBF4FE]'
          : 'border-[#DDE3EE] bg-white hover:border-[#B8C8DD]'
      }`}
      aria-label={label}
    >
      {children}
      {active && (
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-2 w-2 rounded-full bg-[#1E88E5]" />
      )}
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'TODO', label: 'К выполнению' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'TEST', label: 'На проверке' },
  { value: 'DONE', label: 'Готово' },
]

export default function BoardFilters({
  boards,
  users = [],
  selectedBoardId,
  sprintOptions,
  selectedSprintId,
  search,
  filterUserId,
  filterStatus,
  filterDate,
  filterLabelId = '',
  labels = [],
  onBoardChange,
  onSprintChange,
  onSearchChange,
  onFilterUserChange,
  onFilterStatusChange,
  onFilterDateChange,
  onFilterLabelChange,
  onApplyFilters,
  onResetFilters,
  boardName = 'Доска',
  totalTasks = 0,
  isRefreshing = false,
  onRefresh,
  appearance = 'classic',
}: BoardFiltersProps) {
  const isModern = appearance === 'modern'
  const pillBtn =
    'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-normal text-[#4B5563] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#D1D5DB]'
  const pillBtnActive =
    'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3.5 text-[13px] font-medium text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false)
  const desktopFilterRef = useRef<HTMLDivElement | null>(null)

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedSprintId) count++
    if (filterUserId) count++
    if (filterStatus) count++
    if (filterDate) count++
    if (filterLabelId) count++
    if (search.trim()) count++
    return count
  }, [selectedSprintId, filterUserId, filterStatus, filterDate, search, filterLabelId])

  const compactFiltersCount = useMemo(() => {
    let count = 0
    if (filterUserId) count++
    if (filterStatus) count++
    if (filterDate) count++
    if (filterLabelId) count++
    return count
  }, [filterDate, filterStatus, filterUserId, filterLabelId])

  const sprintLabel = useMemo(() => {
    if (!selectedSprintId) return 'Спринт'
    return sprintOptions.find((s) => s.id === selectedSprintId)?.name ?? 'Спринт'
  }, [selectedSprintId, sprintOptions])

  const assigneeLabel = useMemo(() => {
    if (!filterUserId) return 'Исполнитель'
    return users.find((u) => String(u.id) === filterUserId)?.fullName ?? 'Исполнитель'
  }, [filterUserId, users])

  const allSprints = useMemo(() => [
    { id: '', name: 'Все спринты' },
    ...sprintOptions
  ], [sprintOptions])

  const currentIndex = useMemo(() => {
    return allSprints.findIndex((s) => s.id === selectedSprintId)
  }, [selectedSprintId, allSprints])

  const handlePrevSprint = () => {
    if (allSprints.length <= 1) return
    const nextIndex = (currentIndex - 1 + allSprints.length) % allSprints.length
    onSprintChange(allSprints[nextIndex].id)
  }

  const handleNextSprint = () => {
    if (allSprints.length <= 1) return
    const nextIndex = (currentIndex + 1) % allSprints.length
    onSprintChange(allSprints[nextIndex].id)
  }

  const statusLabel = useMemo(() => {
    if (!filterStatus) return 'Статус'
    return STATUS_OPTIONS.find((s) => s.value === filterStatus)?.label ?? 'Статус'
  }, [filterStatus])

  useEffect(() => {
    if (!desktopFilterOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!desktopFilterRef.current) return
      if (!desktopFilterRef.current.contains(event.target as Node)) {
        setDesktopFilterOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDesktopFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [desktopFilterOpen])

  return (
    <>
      {/* ── Desktop toolbar ─────────────────────────────────────────── */}
      <div className={`flex min-w-0 items-center ${isModern ? 'min-w-0 flex-1 gap-3' : 'flex-1 gap-2'}`}>

        {/* Board name breadcrumb */}
        <div className={`hidden shrink-0 items-center gap-2 sm:flex ${isModern ? '!hidden' : ''}`}>
          <div className="flex h-7 items-center gap-1.5 rounded-lg bg-[#F0F4FA] px-2.5">
            <MaterialSymbol name="view_kanban" size={14} color="#1E88E5" />
            <span className="max-w-[140px] truncate text-xs font-semibold text-[#0A1628]">{boardName}</span>
            <span className="text-[10px] text-[#8497B4]">· {totalTasks}</span>
          </div>
        </div>

        <div className={`hidden h-4 w-px bg-[#DDE3EE] sm:block ${isModern ? '!hidden' : ''}`} />

        {/* Board selector */}
        <div className={`hidden lg:block ${isModern ? '!hidden' : ''}`}>
          <FilterSection label="Выбор доски" active={false}>
            <AppSelect
              value={selectedBoardId}
              options={boards.map((b) => ({ value: b.id, label: b.name }))}
              onChange={onBoardChange}
              ariaLabel="Выбор доски"
              searchable
              searchPlaceholder="Поиск доски"
              buttonClassName="!h-8 !rounded-lg !border-0 !bg-transparent !px-2 !text-xs !font-medium !text-[#374C6B] hover:!text-[#1E88E5] min-w-[170px] max-w-[260px]"
              menuClassName="!w-[320px] max-w-[80vw]"
            />
          </FilterSection>
        </div>

        {/* Sprint chip */}
        <div className={`${isModern ? 'order-3 hidden md:block' : 'hidden lg:block'}`}>
          {isModern ? (
            <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#D1D5DB]">
              {/* Left Arrow */}
              <button
                type="button"
                onClick={handlePrevSprint}
                disabled={allSprints.length <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Предыдущий спринт"
              >
                <MaterialSymbol name="chevron_left" size={20} color="currentColor" />
              </button>

              {/* Select Sprint Dropdown */}
              <div className="relative">
                <AppSelect
                  value={selectedSprintId}
                  options={[{ value: '', label: 'Все спринты' }, ...sprintOptions.map((s) => ({ value: s.id, label: s.name }))]}
                  onChange={onSprintChange}
                  ariaLabel="Спринт"
                  buttonClassName="!h-8 !min-w-0 !rounded-md !border-0 !bg-transparent !px-2.5 !text-[13px] !font-medium !text-[#374151] hover:!bg-[#F3F4F6] hover:!text-[#111827]"
                  menuClassName="!w-[240px] min-w-[240px] max-w-[320px]"
                />
              </div>

              {/* Right Arrow */}
              <button
                type="button"
                onClick={handleNextSprint}
                disabled={allSprints.length <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Следующий спринт"
              >
                <MaterialSymbol name="chevron_right" size={20} color="currentColor" />
              </button>
            </div>
          ) : false ? (
            <div className={selectedSprintId ? pillBtnActive : pillBtn}>
              <span className="font-normal text-[#9CA3AF]">Сортировка:</span>
              <AppSelect
                value={selectedSprintId}
                options={[{ value: '', label: 'Спринт' }, ...sprintOptions.map((s) => ({ value: s.id, label: s.name }))]}
                onChange={onSprintChange}
                ariaLabel="Спринт"
                className="min-w-[120px]"
                buttonClassName="!h-8 !min-w-0 !rounded-full !border-0 !bg-transparent !px-1 !text-[13px] !font-normal !text-[#374151] hover:!text-[#111827]"
                menuClassName="!w-[240px] min-w-[240px] max-w-[320px]"
              />
            </div>
          ) : (
            <FilterSection label="Выбор спринта" active={Boolean(selectedSprintId)}>
              <AppSelect
                value={selectedSprintId}
                options={[{ value: '', label: 'Все спринты' }, ...sprintOptions.map((s) => ({ value: s.id, label: s.name }))]}
                onChange={onSprintChange}
                ariaLabel="Спринт"
                buttonClassName="!h-8 !rounded-lg !border-0 !bg-transparent !px-2 !text-xs !font-medium !text-[#374C6B] hover:!text-[#1E88E5] min-w-[90px]"
              />
            </FilterSection>
          )}
        </div>

        {/* Jira-like filter dropdown */}
        <div className={`relative ${isModern ? 'order-2 hidden sm:block' : 'hidden lg:block'}`} ref={desktopFilterRef}>
          <button
            type="button"
            onClick={() => setDesktopFilterOpen((prev) => !prev)}
            className={
              isModern
                ? compactFiltersCount > 0
                  ? pillBtnActive
                  : pillBtn
                : `relative inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition ${
                    compactFiltersCount > 0
                      ? 'border-[#1E88E5] bg-[#EBF4FE] text-[#1E88E5]'
                      : 'border-[#DDE3EE] bg-white text-[#374C6B] hover:border-[#1E88E5] hover:text-[#1E88E5]'
                  }`
            }
          >
            <MaterialSymbol name="filter_list" size={14} color="currentColor" />
            Фильтр
            {compactFiltersCount > 0 ? (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#1E88E5] px-1 text-[10px] font-bold text-white">
                {compactFiltersCount}
              </span>
            ) : null}
          </button>

          {desktopFilterOpen ? (
            <div className="absolute left-0 top-[calc(100%+8px)] z-[420] w-[360px] rounded-xl border border-[#DDE3EE] bg-white p-3 shadow-[0_18px_40px_rgba(10,22,40,0.18)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0A1628]">Фильтр</p>
                {compactFiltersCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      onResetFilters()
                      setDesktopFilterOpen(false)
                    }}
                    className="text-xs font-semibold text-[#1E88E5] hover:text-[#1878CA]"
                  >
                    Очистить
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Исполнитель</span>
                  <AppSelect
                    value={filterUserId}
                    options={[{ value: '', label: 'Все' }, ...users.map((u) => ({ value: String(u.id), label: u.fullName }))]}
                    onChange={onFilterUserChange}
                    ariaLabel="Исполнитель"
                    searchable
                    searchPlaceholder="Поиск исполнителя"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Метка</span>
                  <AppSelect
                    value={filterLabelId}
                    options={[{ value: '', label: 'Все метки' }, ...labels.map((l) => ({ value: l.id, label: l.name }))]}
                    onChange={(v) => onFilterLabelChange?.(v)}
                    ariaLabel="Метка"
                    searchable
                    searchPlaceholder="Поиск метки"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Статус</span>
                  <AppSelect
                    value={filterStatus}
                    options={STATUS_OPTIONS}
                    onChange={onFilterStatusChange}
                    ariaLabel="Статус"
                    showButtonAvatar={false}
                    showOptionAvatar={false}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Дата</span>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => onFilterDateChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onApplyFilters()
                    setDesktopFilterOpen(false)
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E88E5] px-3 text-xs font-semibold text-white transition hover:bg-[#1878CA]"
                >
                  <MaterialSymbol name="filter_alt" size={13} color="#fff" />
                  Применить
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopFilterOpen(false)}
                  className="inline-flex h-8 items-center rounded-lg border border-[#DDE3EE] bg-white px-2.5 text-xs font-semibold text-[#374C6B] transition hover:bg-[#F5F7FA]"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Search — always visible */}
        <div
          className={
            isModern
              ? 'order-1 flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-within:border-[#D1D5DB]'
              : 'flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[#DDE3EE] bg-white px-2.5 transition focus-within:border-[#1E88E5] focus-within:shadow-[0_0_0_2px_rgba(30,136,229,0.12)]'
          }
        >
          <MaterialSymbol name="search" size={isModern ? 18 : 14} color="#90A4AE" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isModern ? 'Поиск задач' : 'Поиск задач...'}
            className={`h-full w-full min-w-0 border-none bg-transparent font-normal text-[#374151] outline-none placeholder:font-normal placeholder:text-[#9CA3AF] ${isModern ? 'text-[13px]' : 'text-xs'}`}
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="shrink-0 rounded p-0.5 text-[#A2AEC2] transition hover:text-[#374C6B]"
              aria-label="Очистить поиск"
            >
              <MaterialSymbol name="close" size={12} color="currentColor" />
            </button>
          ) : null}
        </div>

        {/* Apply & clear */}
        <div className={`hidden shrink-0 items-center gap-1.5 lg:flex ${isModern ? '!hidden' : ''}`}>
          <button
            type="button"
            onClick={onApplyFilters}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#1E88E5] px-3 text-xs font-semibold text-white transition hover:bg-[#1878CA] active:scale-95"
          >
            <MaterialSymbol name="filter_alt" size={13} color="#fff" />
            Применить
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="relative z-[1] inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#DDE3EE] bg-white px-2.5 text-xs font-semibold text-[#374C6B] transition hover:bg-[#F5F7FA]"
              title="Сбросить фильтры"
            >
              <MaterialSymbol name="filter_alt_off" size={13} color="#E53935" />
              <span>Сброс</span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E53935] text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            </button>
          )}
        </div>

        <div className="hidden h-4 w-px bg-[#DDE3EE] sm:block" />

        {/* Refresh */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title={isRefreshing ? 'Обновление...' : 'Обновить'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3EE] bg-white text-[#374C6B] transition hover:border-[#1E88E5] hover:text-[#1E88E5] disabled:opacity-50"
          >
            <MaterialSymbol
              name="refresh"
              size={15}
              color="currentColor"
              style={{ animation: isRefreshing ? 'spin 1s linear infinite' : undefined }}
            />
          </button>
        )}

        {/* Mobile: filters button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative inline-flex h-8 items-center gap-1 rounded-lg border border-[#DDE3EE] bg-white px-2.5 text-xs font-medium text-[#374C6B] transition hover:border-[#1E88E5] hover:text-[#1E88E5] lg:hidden"
        >
          <MaterialSymbol name="tune" size={14} color="currentColor" />
          Фильтры
          {activeFiltersCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1E88E5] text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile Filters Drawer ────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-500 lg:hidden">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* sheet */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-2xl bg-white px-4 pb-8 pt-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-[#0A1628]">Фильтры</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1 text-[#8497B4] hover:text-[#374C6B]"
              >
                <MaterialSymbol name="close" size={18} color="currentColor" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Доска</span>
                <AppSelect
                  value={selectedBoardId}
                  options={boards.map((b) => ({ value: b.id, label: b.name }))}
                  onChange={onBoardChange}
                  ariaLabel="Доска"
                  searchable
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Спринт</span>
                <AppSelect
                  value={selectedSprintId}
                  options={[{ value: '', label: 'Все спринты' }, ...sprintOptions.map((s) => ({ value: s.id, label: s.name }))]}
                  onChange={onSprintChange}
                  ariaLabel="Спринт"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Исполнитель</span>
                <AppSelect
                  value={filterUserId}
                  options={[{ value: '', label: 'Все' }, ...users.map((u) => ({ value: String(u.id), label: u.fullName }))]}
                  onChange={onFilterUserChange}
                  ariaLabel="Исполнитель"
                  searchable
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Статус</span>
                <AppSelect
                  value={filterStatus}
                  options={STATUS_OPTIONS}
                  onChange={onFilterStatusChange}
                  ariaLabel="Статус"
                  showButtonAvatar={false}
                  showOptionAvatar={false}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8497B4]">Дата</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => onFilterDateChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => { onApplyFilters(); setDrawerOpen(false) }}
                className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-[#1E88E5] text-sm font-semibold text-white transition hover:bg-[#1878CA]"
              >
                <MaterialSymbol name="filter_alt" size={16} color="#fff" />
                Применить
              </button>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => { onResetFilters(); setDrawerOpen(false) }}
                  className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-[#DDE3EE] bg-white text-sm font-semibold text-[#374C6B] transition hover:bg-[#F5F7FA]"
                >
                  <MaterialSymbol name="filter_alt_off" size={16} color="#E53935" />
                  Сброс ({activeFiltersCount})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visually hidden labels for screen readers */}
      <span className="sr-only">{sprintLabel}</span>
      <span className="sr-only">{assigneeLabel}</span>
      <span className="sr-only">{statusLabel}</span>
    </>
  )
}
