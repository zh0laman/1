import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useOutletContext } from 'react-router-dom'
import type { AlemContact } from '../../../domain/entities/AlemContact'
import { HttpProfileRepository } from '../../../infrastructure/repositories/HttpProfileRepository'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { canAccessAlemContact } from '../../../shared/config/alemContactAccess'
import {
  buildHrOrgTree,
  layoutOrgForest,
  type LayoutRect,
  type OrgTreeNode,
  type OrgNodeType,
} from './buildHrOrgTree'
import OrgNavigatorTree from './OrgNavigatorTree'
import { OrgNodeIconBadge } from './orgNodeVisuals'
import { fetchAllHrContacts } from './fetchAllHrContacts'

type WorkspaceOutletContext = {
  userEmail?: string
  workspaceBootstrapReady?: boolean
}

const MIN_SCALE = 0.2
const MAX_SCALE = 1.6

const NODE_STYLES: Record<OrgNodeType, { bg: string; border: string; title: string; subtitle: string }> = {
  organization: {
    bg: 'linear-gradient(135deg, #E3F2FD 0%, #FFFFFF 55%)',
    border: '#90CAF9',
    title: '#0D47A1',
    subtitle: '#546E7A',
  },
  department: {
    bg: 'linear-gradient(135deg, #E8F5E9 0%, #FFFFFF 60%)',
    border: '#A5D6A7',
    title: '#1B5E20',
    subtitle: '#546E7A',
  },
  employee: {
    bg: '#FFFFFF',
    border: '#CFD8DC',
    title: '#263238',
    subtitle: '#78909C',
  },
  employee_group: {
    bg: 'linear-gradient(135deg, #FFF8E1 0%, #FFFFFF 70%)',
    border: '#FFE082',
    title: '#E65100',
    subtitle: '#78909C',
  },
}

function contactsForNode(node: OrgTreeNode): AlemContact[] {
  if (node.contact) return [node.contact]
  if (node.contacts?.length) return node.contacts
  return node.children.flatMap((child) => contactsForNode(child))
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function OrgNodeCard({
  rect,
  selected,
  highlighted,
  onSelect,
}: {
  rect: LayoutRect
  selected: boolean
  highlighted: boolean
  onSelect: () => void
}) {
  const style = NODE_STYLES[rect.node.type]
  const isEmployee = rect.node.type === 'employee'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute flex flex-col justify-center rounded-2xl border px-3 py-2 text-left shadow-[0_8px_24px_rgba(15,35,62,0.08)] transition hover:shadow-[0_12px_28px_rgba(15,35,62,0.12)] ${
        selected || highlighted ? 'ring-2 ring-[#1E88E5] ring-offset-2' : ''
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        background: style.bg,
        borderColor: style.border,
      }}
    >
      <div className="flex min-w-0 items-start gap-2">
        {isEmployee ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECEFF1] text-[10px] font-bold text-[#546E7A]">
            {initialsFromName(rect.node.label)}
          </span>
        ) : (
          <OrgNodeIconBadge type={rect.node.type} size={32} iconSize={17} />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block leading-snug ${rect.node.type === 'organization' ? 'text-[13px] font-bold' : 'text-[12px] font-semibold'}`}
            style={{ color: style.title }}
          >
            <span className="line-clamp-2">{rect.node.label}</span>
          </span>
          {rect.node.subtitle ? (
            <span className="mt-0.5 block truncate text-[11px]" style={{ color: style.subtitle }}>
              {rect.node.subtitle}
            </span>
          ) : null}
        </span>
      </div>
    </button>
  )
}

export default function HrOrgCanvasPage() {
  const { userEmail, workspaceBootstrapReady } = useOutletContext<WorkspaceOutletContext>() ?? {}

  const sessionStore = useMemo(() => new LocalStorageAuthSessionStore(), [])
  const profileRepository = useMemo(() => new HttpProfileRepository(sessionStore), [sessionStore])

  const [contacts, setContacts] = useState<AlemContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedContact, setSelectedContact] = useState<AlemContact | null>(null)
  const [panelContacts, setPanelContacts] = useState<AlemContact[]>([])

  const [scale, setScale] = useState(0.7)
  const [offset, setOffset] = useState({ x: 80, y: 48 })
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllHrContacts(profileRepository)
      setContacts(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить оргструктуру')
    } finally {
      setLoading(false)
    }
  }, [profileRepository])

  useEffect(() => {
    if (!workspaceBootstrapReady || !canAccessAlemContact(userEmail)) return
    void load()
  }, [workspaceBootstrapReady, userEmail, load])

  const filteredContacts = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      const haystack = [
        c.full_name,
        c.position,
        c.job_name,
        c.organization,
        c.department_unit,
        c.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [contacts, filter])

  const forest = useMemo(() => buildHrOrgTree(filteredContacts), [filteredContacts])
  const layout = useMemo(() => layoutOrgForest(forest), [forest])
  const canvasPadding = 48
  const canvasWidth = Math.max(layout.width + canvasPadding * 2, 800)
  const canvasHeight = Math.max(layout.height + canvasPadding * 2, 600)

  const focusOnRect = useCallback((rect: LayoutRect, nextScale?: number) => {
    const el = viewportRef.current
    if (!el) return
    const targetScale = nextScale ?? Math.min(1, Math.max(0.45, scale))
    const cx = canvasPadding + rect.x + rect.width / 2
    const cy = canvasPadding + rect.y + rect.height / 2
    setScale(targetScale)
    setOffset({
      x: el.clientWidth / 2 - cx * targetScale,
      y: el.clientHeight / 2 - cy * targetScale,
    })
  }, [scale])

  const fitToView = useCallback(() => {
    const el = viewportRef.current
    if (!el || layout.width <= 0) return
    const pad = 32
    const contentW = layout.width + canvasPadding * 2
    const contentH = layout.height + canvasPadding * 2
    const sx = (el.clientWidth - pad * 2) / contentW
    const sy = (el.clientHeight - pad * 2) / contentH
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(sx, sy)))
    setScale(nextScale)
    setOffset({
      x: (el.clientWidth - contentW * nextScale) / 2,
      y: Math.max(24, (el.clientHeight - contentH * nextScale) / 2),
    })
  }, [layout.width, layout.height, canvasPadding])

  const selectNode = useCallback(
    (node: OrgTreeNode, focus = true) => {
      setSelectedNodeId(node.id)
      const list = contactsForNode(node)
      setPanelContacts(list)
      setSelectedContact(list.length === 1 ? list[0] : null)

      if (focus) {
        const rect = layout.rects.find((r) => r.node.id === node.id)
        if (rect) {
          focusOnRect(rect, node.type === 'organization' ? 0.55 : 0.75)
        }
      }
    },
    [layout.rects, focusOnRect],
  )

  useEffect(() => {
    if (!loading && layout.width > 0) {
      fitToView()
    }
  }, [loading, layout.width, layout.height, fitToView])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.06 : 0.06
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-org-node]')) return
    setIsPanning(true)
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return
    setOffset({
      x: panRef.current.ox + (event.clientX - panRef.current.x),
      y: panRef.current.oy + (event.clientY - panRef.current.y),
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(false)
    panRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (!workspaceBootstrapReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#8497B4]">Загрузка…</div>
    )
  }

  if (!canAccessAlemContact(userEmail)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] min-h-[520px] flex-col gap-3 px-4 py-4 md:px-6">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E88E5]">AlemContact</p>
          <h1 className="text-xl font-bold tracking-tight text-[#0A1628] md:text-2xl">Оргструктура</h1>
          <p className="mt-1 text-sm text-[#8497B4]">
            Организации и подразделения на полотне; сотрудники — в списке справа. Слева — быстрый переход.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/alem-contact"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8EDF5] bg-white px-3 text-[13px] font-semibold text-[#374C6B] shadow-sm hover:bg-[#F7FAFC]"
          >
            <MaterialSymbol name="list" size={18} color="#6B7F99" />
            Список
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8EDF5] bg-white px-3 text-[13px] font-semibold text-[#374C6B] shadow-sm hover:bg-[#F7FAFC] disabled:opacity-60"
          >
            <MaterialSymbol name="refresh" size={18} color="#6B7F99" />
            Обновить
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8EDF5] bg-white px-3 text-[13px] font-semibold text-[#374C6B] shadow-sm hover:bg-[#F7FAFC]"
          >
            <MaterialSymbol name="fit_screen" size={18} color="#6B7F99" />
            Вписать
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8EDF5] bg-white shadow-sm hover:bg-[#F7FAFC]"
            aria-label="Увеличить"
          >
            <MaterialSymbol name="add" size={20} />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8EDF5] bg-white shadow-sm hover:bg-[#F7FAFC]"
            aria-label="Уменьшить"
          >
            <MaterialSymbol name="remove" size={20} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <MaterialSymbol
            name="search"
            size={18}
            color="#9CAEC5"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Фильтр на карте: ФИО, должность, подразделение…"
            className="w-full rounded-xl border border-[#E8EDF5] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
          />
        </div>
        <p className="shrink-0 text-xs text-[#8497B4]">
          {filteredContacts.length} сотр. · {forest.length} орг. · {Math.round(scale * 100)}%
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-[min(100%,300px)] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#E8EDF5] bg-white shadow-sm md:flex md:w-[300px]">
          <div className="border-b border-[#F0F4FA] px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8497B4]">Навигатор</p>
          </div>
          <OrgNavigatorTree
            forest={forest}
            selectedNodeId={selectedNodeId}
            filterQuery={filter}
            onSelect={selectNode}
          />
        </aside>

        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#E8EDF5] bg-[#F4F7FB] shadow-inner"
          style={{
            backgroundImage: 'radial-gradient(circle, #C5D3E8 1px, transparent 1px)',
            backgroundSize: `${24 * scale}px ${24 * scale}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`,
            cursor: isPanning ? 'grabbing' : 'grab',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8497B4]">
              Загрузка оргструктуры…
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-semibold text-[#C53030]">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg bg-[#1E88E5] px-4 py-2 text-sm font-semibold text-white"
              >
                Повторить
              </button>
            </div>
          ) : forest.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8497B4]">
              Нет данных для отображения
            </div>
          ) : (
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                width: canvasWidth,
                height: canvasHeight,
              }}
            >
              <svg
                className="pointer-events-none absolute left-0 top-0"
                width={canvasWidth}
                height={canvasHeight}
                style={{ overflow: 'visible' }}
              >
                <g transform={`translate(${canvasPadding}, ${canvasPadding})`}>
                  {layout.edges.map((edge) => (
                    <path
                      key={`${edge.fromId}-${edge.toId}`}
                      d={`M ${edge.x1} ${edge.y1} C ${edge.x1} ${edge.y1 + 28}, ${edge.x2} ${edge.y2 - 28}, ${edge.x2} ${edge.y2}`}
                      fill="none"
                      stroke="#9CB4D0"
                      strokeWidth={2}
                      strokeOpacity={0.65}
                    />
                  ))}
                </g>
              </svg>

              <div
                className="relative"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: `translate(${canvasPadding}px, ${canvasPadding}px)`,
                }}
              >
                {layout.rects.map((rect) => (
                  <div key={rect.node.id} data-org-node>
                    <OrgNodeCard
                      rect={rect}
                      selected={selectedNodeId === rect.node.id}
                      highlighted={selectedContact?.id === rect.node.contact?.id}
                      onSelect={() => selectNode(rect.node, false)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[#E8EDF5] bg-white shadow-sm sm:w-[300px]">
          <div className="flex items-center justify-between gap-2 border-b border-[#F0F4FA] px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8497B4]">
              {panelContacts.length > 1 ? `Сотрудники (${panelContacts.length})` : 'Детали'}
            </p>
            {selectedNodeId || selectedContact ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeId(null)
                  setSelectedContact(null)
                  setPanelContacts([])
                }}
                className="text-[#90A4AE] hover:text-[#455A64]"
                aria-label="Закрыть"
              >
                <MaterialSymbol name="close" size={16} />
              </button>
            ) : null}
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {panelContacts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#B0BEC5]">
                Выберите подразделение или группу на карте или в навигаторе слева
              </p>
            ) : panelContacts.length === 1 && selectedContact ? (
              <div className="px-4 py-3 text-[13px] text-[#374C6B]">
                <p className="mb-1 text-sm font-bold text-[#0A1628]">{selectedContact.full_name}</p>
                <p className="mb-3 text-xs text-[#8497B4]">{selectedContact.position || selectedContact.job_name}</p>
                <p className="mb-2">
                  <span className="font-semibold text-[#8497B4]">Организация: </span>
                  {selectedContact.organization || '—'}
                </p>
                <p className="mb-2">
                  <span className="font-semibold text-[#8497B4]">Подразделение: </span>
                  {selectedContact.department_unit || '—'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F0F4FA]">
                {panelContacts.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedContact(person)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition hover:bg-[#F8FAFC] ${
                        selectedContact?.id === person.id ? 'bg-[#E3F2FD]' : ''
                      }`}
                    >
                      <span className="text-[13px] font-semibold text-[#0A1628]">{person.full_name}</span>
                      <span className="text-[11px] text-[#8497B4]">
                        {person.position || person.job_name || '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
