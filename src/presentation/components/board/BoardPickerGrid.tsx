import { useMemo, useState } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { BoardOptionViewModel } from '../../view-models/BoardViewModel'

interface BoardPickerGridProps {
  boards: BoardOptionViewModel[]
  highlightedBoardId?: string
  progressByBoardId?: Record<string, number>
  membersByBoardId?: Record<string, Array<{ initials: string; name: string; avatarUrl?: string }>>
  onSelectBoard: (boardId: string) => void
  onCreateBoard?: () => void
}

type SortMode = 'name' | 'created_desc' | 'created_asc'

/** Должен совпадать с `BOARD_VISIT_IDS_KEY` в `BoardPage.tsx` */
const BOARD_VISIT_IDS_KEY = 'superapp.board_visit_ids'

const readBoardVisitIdsFromStorage = (): string[] => {
  try {
    const raw = window.localStorage.getItem(BOARD_VISIT_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

const hashToSpark = (id: string): number[] => {
  let h = 0
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return Array.from({ length: 8 }, (_, i) => 18 + ((h >> (i * 3)) & 15) % 22)
}

const formatCreatedLabel = (iso?: string): string => {
  if (!iso) return 'Дата не указана'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Дата не указана'
  const now = Date.now()
  const diffMs = now - d.getTime()
  const days = Math.floor(diffMs / (86400 * 1000))
  if (days <= 0) return 'Сегодня'
  if (days === 1) return 'Вчера'
  if (days < 7) return `${days} дн. назад`
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const getProgressPercent = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return 55 + (hash % 41) // Deterministic progress between 55% and 96%
}

const getMemberInitials = (name: string) => {
  const allInitials = [
    ['AI', 'UX', 'FE'],
    ['FE', 'QA', 'PM'],
    ['UX', 'FE', 'BA'],
    ['AI', 'DE', 'QA'],
    ['ME', 'PM', 'QA'],
    ['UX', 'UI', 'FE']
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return allInitials[hash % allInitials.length]
}

const memberColors = ['#1D72E7', '#10B981', '#F59E0B', '#8E24AA', '#EC4899']

function MiniKanbanPreview({ seed }: { seed: string }) {
  const cols = 3
  const heights = hashToSpark(seed)
  const columnHeaders = ['bg-[#1D72E7]', 'bg-[#F59E0B]', 'bg-[#10B981]']
  
  return (
    <div className="flex h-[56px] gap-1.5 rounded-xl bg-[#F1F5F9]/80 p-2 border border-[#E2E8F0]/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
      {Array.from({ length: cols }).map((_, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-1 rounded-[8px] bg-white p-1 shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-[#E2E8F0]/40 animate-fade-in">
          <div className={`h-1.5 rounded-sm ${columnHeaders[ci % columnHeaders.length]}`} />
          {Array.from({ length: 2 + (ci % 2) }).map((__, ti) => (
            <div
              key={ti}
              className="h-1 rounded-sm transition-all duration-500"
              style={{
                width: `${heights[(ci * 3 + ti) % heights.length]}%`,
                background: `linear-gradient(90deg, #F1F5F9 0%, #E2E8F0 100%)`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Sparkline({ values, seed }: { values: number[]; seed: string }) {
  const w = 72
  const h = 24
  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const span = Math.max(max - min, 1)
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * (w - 4) + 2
      const y = h - 2 - ((v - min) / span) * (h - 6)
      return `${x},${y}`
    })
    .join(' ')

  const fillPts = `${w - 2},${h} 2,${h} ${pts}`
  const gradId = `sparkGrad-${seed}`

  return (
    <svg width={w} height={h} className="shrink-0 text-[#1D72E7]" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D72E7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1D72E7" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradId})`}
        points={fillPts}
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        opacity={0.85}
      />
    </svg>
  )
}

export default function BoardPickerGrid({
  boards,
  highlightedBoardId,
  progressByBoardId = {},
  membersByBoardId = {},
  onSelectBoard,
  onCreateBoard: _onCreateBoard,
}: BoardPickerGridProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('name')

  const visitIds = readBoardVisitIdsFromStorage()

  const byId = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])

  const recentBoards = useMemo(() => {
    const ordered = visitIds.map((id) => byId.get(id)).filter(Boolean) as BoardOptionViewModel[]
    return ordered.slice(0, 4)
  }, [byId, visitIds])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? boards.filter((b) => b.name.toLowerCase().includes(q)) : boards.slice()
    const list = [...filtered]

    const createdMs = (b: BoardOptionViewModel) => {
      if (!b.createdAt) return 0
      const t = new Date(b.createdAt).getTime()
      return Number.isNaN(t) ? 0 : t
    }

    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
    } else if (sort === 'created_desc') {
      list.sort((a, b) => createdMs(b) - createdMs(a))
    } else {
      list.sort((a, b) => createdMs(a) - createdMs(b))
    }
    return list
  }, [boards, search, sort])

  return (
    <div className="flex w-full flex-col animate-fade-in">

      {recentBoards.length > 0 ? (
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-[16px] font-bold tracking-[-0.02em] text-[#12243D] sm:text-[17px]">Недавние доски</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] sm:gap-4">
            {recentBoards.map((board) => {
              const isCurrent = highlightedBoardId === board.id
              const progress = progressByBoardId[board.id] ?? board.progress?.completionPercent ?? getProgressPercent(board.id)
              const members = membersByBoardId[board.id]?.length
                ? membersByBoardId[board.id].map((member) => member.initials)
                : getMemberInitials(board.name)
              
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => onSelectBoard(board.id)}
                  className={[
                    'flex w-[min(100%,280px)] shrink-0 flex-col gap-3 rounded-[24px] border p-4 text-left backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] sm:w-[260px]',
                    isCurrent
                      ? 'border-[#1D72E7] bg-white/90 shadow-[0_12px_30px_rgba(29,114,231,0.15)] ring-1 ring-[#1D72E7]/30'
                      : 'border-white/60 bg-white/60 hover:border-white hover:bg-white/85 hover:shadow-[0_15px_35px_rgba(15,23,42,0.06)]',
                  ].join(' ')}
                >
                  <MiniKanbanPreview seed={board.id} />
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-[14px] font-bold leading-snug text-[#0F1F36]">{board.name}</span>
                    {isCurrent ? (
                      <span className="shrink-0 rounded-md bg-[#E3F2FD] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1565C0]">
                        Текущая
                      </span>
                    ) : null}
                  </div>

                  {/* Progress & Collaboration mockup */}
                  <div className="flex items-center justify-between gap-3 border-t border-[#F1F5F9] pt-2.5">
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-[#5A6F8E]">
                        <span>Выполнение</span>
                        <span className="text-[#1D72E7]">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#E2E8F0]/60 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-[#1D72E7] to-[#10B981] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                      {members.map((initials, idx) => (
                        <div
                          key={idx}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white border-2 border-white shadow-sm ring-1 ring-black/5"
                          style={{ backgroundColor: memberColors[idx % memberColors.length] }}
                        >
                          {initials}
                        </div>
                      ))}
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-[#7B8FA8]">{formatCreatedLabel(board.createdAt)}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/50 bg-white/35 p-4 shadow-[0_8px_32px_rgba(31,38,135,0.04)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold tracking-[-0.02em] text-[#12243D] sm:text-[17px]">Все доски</h2>
            <span className="rounded-full bg-white/75 border border-white px-2.5 py-0.5 text-[12px] font-bold text-[#1E88E5] shadow-sm">
              {filteredSorted.length}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <label className="relative block sm:max-w-xs sm:flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                <MaterialSymbol name="search" size={18} color="currentColor" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск досок..."
                className="h-10 w-full rounded-xl border border-white/60 bg-white/80 py-2 pl-10 pr-3 text-[14px] text-[#12243D] outline-none transition placeholder:text-[#9AA8BC] focus:border-[#90B8EA] focus:bg-white focus:ring-2 focus:ring-[#BBD7F6]/60 shadow-sm"
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="hidden text-[12px] font-semibold text-[#6B7F9E] sm:inline">Сортировка</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="h-10 min-w-[200px] cursor-pointer rounded-xl border border-white/60 bg-white/80 px-3 text-[13px] font-bold text-[#374C6B] outline-none transition focus:border-[#90B8EA] focus:bg-white focus:ring-2 focus:ring-[#BBD7F6]/60 shadow-sm"
                aria-label="Сортировка досок"
              >
                <option value="name">По названию (А–Я)</option>
                <option value="created_desc">По дате: новые сверху</option>
                <option value="created_asc">По дате: старые сверху</option>
              </select>
            </div>
          </div>
        </div>

        {filteredSorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D0DAE8] bg-white/80 py-14 text-center text-[14px] font-medium text-[#6B7F9E]">
            Ничего не найдено. Измените запрос или сбросьте поиск.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSorted.map((board) => {
              const isCurrent = highlightedBoardId === board.id
              const spark = hashToSpark(board.id + board.name)
              const progress = progressByBoardId[board.id] ?? board.progress?.completionPercent ?? getProgressPercent(board.id)
              const members = membersByBoardId[board.id]?.length
                ? membersByBoardId[board.id].map((member) => member.initials)
                : getMemberInitials(board.name)

              return (
                <li key={board.id}>
                  <button
                    type="button"
                    onClick={() => onSelectBoard(board.id)}
                    className={[
                      'flex h-full w-full flex-col rounded-[24px] border p-4 text-left backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]',
                      isCurrent
                        ? 'border-[#1D72E7] bg-white/90 shadow-[0_15px_35px_rgba(29,114,231,0.15)] ring-1 ring-[#1D72E7]/30'
                        : 'border-white/60 bg-white/60 hover:border-white hover:bg-white/85 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]',
                    ].join(' ')}
                  >
                    <MiniKanbanPreview seed={board.id} />
                    
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-bold leading-snug text-[#0F1F36]">
                        {board.name}
                      </span>
                      {isCurrent ? (
                        <span className="shrink-0 rounded-md bg-[#E3F2FD] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1565C0]">
                          Текущая доска
                        </span>
                      ) : null}
                    </div>

                    {/* Progress & Collaboration mockup */}
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#F1F5F9] pt-2.5">
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-[#5A6F8E]">
                          <span>Выполнение</span>
                          <span className="text-[#1D72E7]">{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#E2E8F0]/60 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-[#1D72E7] to-[#10B981] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                        {members.map((initials, idx) => (
                          <div
                            key={idx}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white border-2 border-white shadow-sm ring-1 ring-black/5"
                            style={{ backgroundColor: memberColors[idx % memberColors.length] }}
                          >
                            {initials}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2 border-t border-[#F0F3F9] pt-2.5">
                      <div className="min-w-0 space-y-0.5 text-[11px] text-[#6B7F9E]">
                        <p>
                          <span className="font-semibold text-[#4A5F7A]">Создано:</span> {formatCreatedLabel(board.createdAt)}
                        </p>
                        <p className="text-[10px] text-[#94A3B8]">Нажмите, чтобы открыть доску</p>
                      </div>
                      <Sparkline values={spark} seed={board.id} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      
      <br />
      <br />
      <br />
    </div>
  )
}
