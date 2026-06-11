import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useOutletContext } from 'react-router-dom'
import { HttpProfileRepository } from '../../../infrastructure/repositories/HttpProfileRepository'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import type { AlemContact, AlemContactDirectoryMeta, HrFilterField } from '../../../domain/entities/AlemContact'
import CustomSelect from '../../../shared/ui/CustomSelect'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { canAccessAlemContact } from '../../../shared/config/alemContactAccess'

const PAGE_SIZE = 20

type WorkspaceOutletContext = {
  userEmail?: string
  workspaceBootstrapReady?: boolean
}

const C = {
  ink: '#0A1628',
  muted: '#8497B4',
  border: '#E8EDF5',
  panel: '#FFFFFF',
  accent: '#1E88E5',
}

function formatIsoDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

function EmployeeInitialsBadge({ initials }: { initials: string }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#6B7F99] ring-1 ring-[#E8EDF5]"
      style={{ background: '#F2F5FA' }}
      aria-hidden
    >
      {initials}
    </div>
  )
}

/** Фото загружается только в модалке — в таблице нет запросов к /files/download. */
function ModalEmployeeAvatar({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null | undefined
  initials: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const normalizedUrl = avatarUrl?.trim() ?? ''

  useEffect(() => {
    setImageFailed(false)
  }, [normalizedUrl])

  if (normalizedUrl && !imageFailed) {
    return (
      <img
        src={normalizedUrl}
        alt=""
        decoding="async"
        fetchPriority="high"
        onError={() => setImageFailed(true)}
        className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-[#E8EDF5]"
      />
    )
  }

  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-[#6B7F99] ring-2 ring-[#E8EDF5]"
      style={{ background: '#F2F5FA' }}
    >
      {initials}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  const s = typeof value === 'number' ? String(value) : String(value).trim()
  if (typeof value === 'string' && !s) return null
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#F0F4FA] py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-[#8497B4]">{label}</span>
      <span className="min-w-0 break-words text-[13px] leading-snug text-[#0A1628] sm:max-w-[65%] sm:text-right">{s}</span>
    </div>
  )
}

export default function AlemContactPage() {
  const { userEmail, workspaceBootstrapReady } = useOutletContext<WorkspaceOutletContext>() ?? {}

  const sessionStore = useMemo(() => new LocalStorageAuthSessionStore(), [])
  const profileRepository = useMemo(() => new HttpProfileRepository(sessionStore), [sessionStore])

  const [contacts, setContacts] = useState<AlemContact[]>([])
  const [listMeta, setListMeta] = useState<AlemContactDirectoryMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AlemContact | null>(null)
  const skipPageResetOnLayout = useRef(true)

  const [filterJobName, setFilterJobName] = useState('')
  const [filterSubName, setFilterSubName] = useState('')
  const [filterNameGo, setFilterNameGo] = useState('')

  const [filterOptions, setFilterOptions] = useState<Record<HrFilterField, string[]>>({
    job_name: [],
    sub_name: [],
    name_go: [],
    person_status: [],
  })
  const [filtersLoading, setFiltersLoading] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(id)
  }, [query])

  useLayoutEffect(() => {
    if (skipPageResetOnLayout.current) {
      skipPageResetOnLayout.current = false
      return
    }
    setPage(0)
  }, [debouncedQuery])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const dir = await profileRepository.listHrUsers({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        q: debouncedQuery,
        job_name: filterJobName || undefined,
        sub_name: filterSubName || undefined,
        name_go: filterNameGo || undefined,
      })
      setContacts(dir.contacts)
      setListMeta(dir.meta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить справочник')
      setContacts([])
      setListMeta(null)
    } finally {
      setLoading(false)
    }
  }, [
    profileRepository,
    page,
    debouncedQuery,
    filterJobName,
    filterSubName,
    filterNameGo,
  ])

  useEffect(() => {
    if (!workspaceBootstrapReady || !canAccessAlemContact(userEmail)) return
    let cancelled = false
    const run = async () => {
      setFiltersLoading(true)
      try {
        const [job_name, sub_name, name_go] = await Promise.all([
          profileRepository.listHrFilterValues('job_name'),
          profileRepository.listHrFilterValues('sub_name'),
          profileRepository.listHrFilterValues('name_go'),
        ])
        if (!cancelled) {
          setFilterOptions({ job_name, sub_name, name_go, person_status: [] })
        }
      } catch {
        if (!cancelled) {
          setFilterOptions({ job_name: [], sub_name: [], name_go: [], person_status: [] })
        }
      } finally {
        if (!cancelled) setFiltersLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [workspaceBootstrapReady, userEmail, profileRepository])

  const clearHrFilters = useCallback(() => {
    setFilterJobName('')
    setFilterSubName('')
    setFilterNameGo('')
    setPage(0)
  }, [])

  const hasActiveHrFilters =
    Boolean(filterJobName) || Boolean(filterSubName) || Boolean(filterNameGo)

  useEffect(() => {
    if (!workspaceBootstrapReady || !canAccessAlemContact(userEmail)) return
    void load()
  }, [load, workspaceBootstrapReady, userEmail])

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const rangeLabel = useMemo(() => {
    const total = listMeta?.total
    if (total === undefined) return null
    const n = contacts.length
    if (total === 0 || n === 0) return `0 из ${total}`
    const offset = listMeta?.offset ?? page * PAGE_SIZE
    const start = offset + 1
    const end = offset + n
    // Скобки: фактическое число строк в таблице = n (должно совпадать с визуальным количеством)
    return `${start}–${end} из ${total} · ${n} в списке`
  }, [listMeta?.total, listMeta?.offset, page, contacts.length])

  /** API иногда отдаёт меньше записей, чем limit; на не последней странице это подозрительно */
  const partialPageHint = useMemo(() => {
    if (loading || !listMeta?.total) return false
    const n = contacts.length
    const requested = listMeta.page_size ?? listMeta.limit ?? PAGE_SIZE
    const off = listMeta.offset ?? page * PAGE_SIZE
    const seenAll = off + n >= listMeta.total
    return n > 0 && n < requested && !seenAll
  }, [loading, listMeta, page, contacts.length])

  const { canPrevPage, canNextPage } = useMemo(() => {
    if (loading || !listMeta) return { canPrevPage: false, canNextPage: false }
    const total = listMeta.total ?? 0
    if (total === 0) return { canPrevPage: false, canNextPage: false }
    const canPrev = page > 0
    let canNext = false
    if (listMeta.pages != null && listMeta.pages > 0) {
      canNext = page + 1 < listMeta.pages
    } else {
      canNext = (listMeta.offset ?? 0) + contacts.length < total
    }
    return { canPrevPage: canPrev, canNextPage: canNext }
  }, [loading, listMeta, page, contacts.length])

  const displayFullName = (c: AlemContact) => {
    const fromParts = [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ').trim()
    return fromParts || c.full_name?.trim() || c.username
  }

  const initialsFor = (c: AlemContact) =>
    (displayFullName(c) || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'

  if (!workspaceBootstrapReady) {
    return (
      <div className="flex min-h-[min(360px,70vh)] flex-col items-center justify-center px-4 py-12 text-[14px] text-[#8497B4]">
        Загрузка…
      </div>
    )
  }

  if (!canAccessAlemContact(userEmail)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl" style={{ color: C.ink }}>
            AlemContact
          </h1>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            Справочник сотрудников
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/alem-contact/org-map"
            className="inline-flex items-center gap-2 rounded-xl border border-[#BBDEFB] bg-[#E3F2FD] px-3 py-2 text-[13px] font-semibold text-[#1565C0] shadow-sm transition hover:bg-[#BBDEFB]/40"
          >
            <MaterialSymbol name="account_tree" size={18} color="#1565C0" />
            Оргструктура
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8EDF5] bg-white px-3 py-2 text-[13px] font-semibold text-[#374C6B] shadow-sm transition hover:bg-[#F7FAFC] disabled:opacity-60"
          >
            <MaterialSymbol name="refresh" size={18} color="#6B7F99" />
            Обновить
          </button>
        </div>
      </div>

      <div
        className="flex flex-col gap-3 rounded-2xl border p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:p-4"
        style={{ borderColor: C.border, background: C.panel }}
      >
        <div className="relative min-w-0 flex-1 basis-full sm:basis-[min(100%,28rem)]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <MaterialSymbol name="search" size={20} color="#9CAEC5" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: ФИО, должность, подразделение…"
            className="w-full rounded-xl border border-[#E8EDF5] bg-[#FAFBFD] py-2.5 pl-10 pr-3 text-[14px] outline-none ring-[#1E88E5]/25 focus:border-[#B9D4F5] focus:ring-2"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
          <div className="whitespace-nowrap text-[13px] font-medium tabular-nums text-[#6B7F99]">
            {loading ? 'Загрузка…' : rangeLabel ?? `${contacts.length} на странице`}
          </div>
          {!loading && listMeta && (listMeta.total ?? 0) > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!canPrevPage}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E8EDF5] bg-white px-2.5 text-[13px] font-semibold text-[#374C6B] shadow-sm transition hover:bg-[#F7FAFC] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                aria-label="Предыдущая страница"
              >
                <MaterialSymbol name="chevron_left" size={18} color="#6B7F99" />
                <span className="hidden sm:inline">Назад</span>
              </button>
              <span className="min-w-[5.5rem] text-center text-[13px] tabular-nums text-[#6B7F99]">
                Стр.&nbsp;{page + 1}
                {listMeta.pages != null && listMeta.pages > 0 ? `/${listMeta.pages}` : ''}
              </span>
              <button
                type="button"
                disabled={!canNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E8EDF5] bg-white px-2.5 text-[13px] font-semibold text-[#374C6B] shadow-sm transition hover:bg-[#F7FAFC] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                aria-label="Следующая страница"
              >
                <span className="hidden sm:inline">Вперёд</span>
                <MaterialSymbol name="chevron_right" size={18} color="#6B7F99" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="rounded-2xl border p-4 shadow-sm"
        style={{ borderColor: C.border, background: C.panel }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-[#374C6B]">Фильтры</div>
          <button
            type="button"
            onClick={clearHrFilters}
            disabled={!hasActiveHrFilters || filtersLoading}
            className="shrink-0 rounded-xl border border-[#E8EDF5] bg-white px-3 py-2 text-[13px] font-semibold text-[#374C6B] shadow-sm transition hover:bg-[#F7FAFC] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Сбросить фильтры
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CustomSelect
            label="Должность"
            value={filterJobName}
            options={filterOptions.job_name}
            disabled={filtersLoading}
            onChange={(v) => {
              setFilterJobName(v)
              setPage(0)
            }}
          />
          <CustomSelect
            label="Подразделение"
            value={filterSubName}
            options={filterOptions.sub_name}
            disabled={filtersLoading}
            onChange={(v) => {
              setFilterSubName(v)
              setPage(0)
            }}
          />
          <CustomSelect
            label="Организация"
            value={filterNameGo}
            options={filterOptions.name_go}
            disabled={filtersLoading}
            onChange={(v) => {
              setFilterNameGo(v)
              setPage(0)
            }}
          />
        </div>
        {filtersLoading ? (
          <p className="mt-3 text-[12px] text-[#8497B4]">Загрузка справочников для списков…</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>
      ) : null}

      {partialPageHint ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950">
          Сервер вернул только {contacts.length} записей из запрошенных {listMeta?.page_size ?? listMeta?.limit ?? PAGE_SIZE}
          {listMeta?.total != null ? ` (всего в справочнике ${listMeta.total})` : ''}. Номера в подписи выше — по факту пришедших
          данных.
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{ borderColor: C.border, background: C.panel }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-[1] bg-[#F7FAFC] shadow-[0_1px_0_#E8EDF5]">
              <tr className="border-b bg-[#F7FAFC]" style={{ borderColor: C.border }}>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-[#374C6B]">Сотрудник</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-[#374C6B]">Должность</th>
                <th className="min-w-[180px] px-4 py-3 font-semibold text-[#374C6B]">Подразделение</th>
                <th className="min-w-[200px] px-4 py-3 font-semibold text-[#374C6B]">Организация</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#8497B4]">
                    Загрузка справочника…
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#8497B4]">
                    Нет записей
                  </td>
                </tr>
              ) : (
                contacts.map((row, index) => (
                  <tr
                    key={`ac-row-${page}-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(row)
                      }
                    }}
                    className="cursor-pointer border-b border-[#F0F4FA] transition hover:bg-[#EFF6FF]"
                  >
                    <td className="align-top px-4 py-3">
                      <div className="flex items-start gap-3">
                        <EmployeeInitialsBadge initials={initialsFor(row)} />
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0A1628]">{displayFullName(row)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="align-top px-4 py-3 text-[#374C6B]">{row.position ?? row.job_name ?? '—'}</td>
                    <td className="align-top px-4 py-3 text-[#374C6B]">{row.department_unit ?? '—'}</td>
                    <td className="align-top px-4 py-3 text-[#374C6B]">{row.organization ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ниже таблицы — запас места, чтобы последняя строка не прилипала к краю при прокрутке страницы */}
      <div className="h-4 shrink-0" aria-hidden />

      {selected ? (
        <div
          className="fixed inset-0 z-[600] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alem-contact-card-title"
            className="max-h-[min(92vh,920px)] w-full max-w-lg overflow-hidden rounded-t-2xl border border-[#E8EDF5] bg-white shadow-[0_-8px_40px_rgba(10,22,40,0.12)] sm:rounded-2xl sm:shadow-[0_20px_60px_rgba(10,22,40,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#EEF3F9] px-4 py-3 sm:px-5">
              <h2 id="alem-contact-card-title" className="text-[15px] font-bold text-[#0A1628]">
                Карточка сотрудника
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-[#6B7F99] transition hover:bg-[#F2F5FA]"
                aria-label="Закрыть"
              >
                <MaterialSymbol name="close" size={22} color="currentColor" />
              </button>
            </div>

            <div className="max-h-[calc(min(92vh,920px)-52px)] overflow-y-auto px-4 pb-6 pt-4 sm:px-5">
              <div className="flex flex-col items-center gap-3 border-b border-[#F0F4FA] pb-5 text-center sm:flex-row sm:items-start sm:text-left">
                <ModalEmployeeAvatar avatarUrl={selected.avatar_url} initials={initialsFor(selected)} />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold leading-tight text-[#0A1628]">{displayFullName(selected)}</div>
                </div>
              </div>

              <div className="mt-4 space-y-0">
                <DetailRow label="Должность" value={selected.position ?? selected.job_name ?? undefined} />
                <DetailRow label="Подразделение" value={selected.department_unit ?? undefined} />
                <DetailRow label="Организация" value={selected.organization ?? undefined} />
                <DetailRow label="Бейдж" value={selected.badge_code ?? undefined} />
                <DetailRow label="Приказ / документ" value={selected.doc_type ?? undefined} />
                <DetailRow label="Номер приказа" value={selected.last_order_number ?? undefined} />
                <DetailRow label="Дата приказа" value={formatIsoDate(selected.last_order_date) ?? undefined} />
                <DetailRow label="Дата начала (последняя)" value={formatIsoDate(selected.last_begin_date) ?? undefined} />
                <DetailRow label="Дата первого начала" value={formatIsoDate(selected.first_begin_date) ?? undefined} />
                <DetailRow label="Отсутствие" value={selected.absence_status ?? undefined} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
