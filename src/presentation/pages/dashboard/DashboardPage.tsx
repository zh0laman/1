// ─────────────────────────────────────────────────────────────────────────────
//  DashboardPage · Radical redesign — "Public Service Command"
//  Concept: a genuine government operations dashboard.
//  Charts powered by recharts. Zero decorative noise. Full a11y.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, Cell,
  PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import AppConfirmDialog from '../../../shared/ui/AppConfirmDialog'
import taskcardbg from '../../../assets/taskcardbg.png'
import meetsbg from '../../../assets/meetsbg.png'
import docscardbg from '../../../assets/docscardbg.png'
import scorebg from '../../../assets/scorebg.png'
import { createAuthController } from '../../auth/createAuthController'
import { createBoardController } from '../../board/createBoardController'
import { createHomeDashboardController } from '../../dashboard/createHomeDashboardController'
import { createNotificationController } from '../../notifications/createNotificationController'
import { DashboardSkeleton } from '../../components/dashboard/Skeletons'
import type { HomeDashboardViewModel } from '../../view-models/HomeDashboardViewModel'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { getDefaultHomeDashboardViewModel } from '../../view-models/HomeDashboardViewModel'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import { useTypewriter } from '../../hooks/useTypewriter'

const sessionStore = new LocalStorageAuthSessionStore()

function TypewriterCursor({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="ml-[3px] inline-block h-[0.72em] w-[2px] shrink-0 animate-pulse rounded-[1px] align-[-0.1em]"
      style={{ backgroundColor: color, animationDuration: '1s' }}
    />
  )
}
// ─── Design token system ──────────────────────────────────────────────────────
const T = {
  // Brand — one primary, used sparingly
  brand:    '#2E6BFF',
  brandMid: '#1954E8',
  brandLt:  '#EAF1FF',
  brandBd:  '#C9D8FF',
  // Neutral scale — cool-grey, 10 steps
  accent:   '#1E88E5',
  accentLt: '#EAF6FF',
  mint:     '#1E88E5',
  mintLt:   '#EAF6FF',
  n950: '#15182F',
  n900: '#1F2340',
  n800: '#30365F',
  n700: '#4C537B',
  n600: '#6A7196',
  n500: '#8C92B4',
  n400: '#A8ADC8',
  n300: '#CDD1E2',
  n200: '#E5E8F2',
  n150: '#EEF1F7',
  n100: '#F5F7FB',
  n50:  '#FAFBFF',
  white:'#FFFFFF',
  // Semantic — dark variants for text, light for backgrounds
  success:    '#1E88E5', successMid: '#2B9BF0', successLt: '#EAF6FF', successBd: '#C7E6FF',
  warning:    '#C8782A', warningMid: '#E28C2D', warningLt: '#FFF4E8', warningBd: '#FFD8AF',
  error:      '#C74C69', errorMid:   '#D95B79', errorLt:   '#FFF0F4', errorBd:   '#F2B8C7',
  // Shadows — 3 tiers only
  shadowSm: '0 8px 24px rgba(85,96,164,0.08)',
  shadowMd: '0 14px 36px rgba(85,96,164,0.12)',
  shadowLg: '0 20px 56px rgba(85,96,164,0.16)',
  shadowXl: '0 28px 80px rgba(67,78,140,0.2)',
  // Radii — 4 values only
  rSm: 10, rMd: 16, rLg: 24, rXl: 32,
  /** Акцент прогресса в духе нативных delivery-UI: сплошное кольцо, без «пончика» из чартов */
  progressRing: '#1E88E5',
  gridBg: 'radial-gradient(circle, #D1DBE8 1px, transparent 1px)',
} as const

// ─── Business-logic helpers (logic unchanged) ─────────────────────────────────
const normalizeStatus = (s: string): 'К выполнению' | 'В работе' | 'Проверка' | 'Готово' => {
  const v = s.trim().toLowerCase()
  if (v === 'в работе' || v === 'in progress' || v === 'in_progress' || v === 'doing' || v === 'в работе') return 'В работе'
  if (v === 'на проверке' || v === 'review' || v === 'в процессе проверки' || v === 'тест' || v === 'test') return 'Проверка'
  if (v === 'готово' || v === 'done' || v === 'completed' || v === 'завершено') return 'Готово'
  return 'К выполнению'
}

type StatusCfg = { bg: string; text: string; bd: string; icon: string; dot: string; label: string }
const statusCfg = (s: ReturnType<typeof normalizeStatus>): StatusCfg => ({
  'В работе': { bg: T.warningLt, text: T.warning,  bd: T.warningBd,  icon: 'refresh',           dot: '#F59E0B', label: 'В работе' },
  'Проверка': { bg: T.brandLt,   text: T.brand,    bd: T.brandBd,    icon: 'search',        dot: T.brand,   label: 'Проверка' },
  'Готово':   { bg: T.successLt, text: T.success,  bd: T.successBd,  icon: 'check_circle_outline', dot: T.success, label: 'Готово'   },
  'К выполнению': { bg: T.n100,      text: T.n500,     bd: T.n200,       icon: 'radio_button_unchecked',dot: T.n400,   label: 'К выполнению'  },
}[s])

const buildSeries = (base: number, v: number) => {
  const n = Math.max(8, base + 8)
  return [
    Math.max(6, Math.round(n * 0.50) + v),
    Math.max(8, Math.round(n * 0.78) - v),
    Math.max(7, Math.round(n * 0.62) + v),
    Math.max(10, Math.round(n * 0.98)),
    Math.max(8, Math.round(n * 0.84) - v),
    Math.max(5, Math.round(n * 0.42)),
    Math.max(5, Math.round(n * 0.34) + v),
  ]
}

type DashboardTask = HomeDashboardViewModel['tasks'][number]
const CHART_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

// ─── SVG micro-components ─────────────────────────────────────────────────────

// ─── UI primitives ────────────────────────────────────────────────────────────
const SL = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 11, fontWeight: 700, color: T.n400, letterSpacing: '0.09em', textTransform: 'uppercase', lineHeight: 1 }}>
    {children}
  </p>
)
const Div = () => <div style={{ height: 1, background: T.n150, flexShrink: 0 }} />
const surfaceStyle = {
  border: `1px solid ${T.n200}`,
  background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${T.white} 100%)`,
  boxShadow: T.shadowSm,
} as const

/** Тонкое кольцо прогресса (линия + скруглённые концы), как в delivery-приложениях */
function WoltStyleProgressRing({
  pct,
  size = 136,
  stroke = 5.5,
}: {
  pct: number
  size?: number
  stroke?: number
}) {
  const target = Math.min(100, Math.max(0, pct))
  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(target))
    return () => cancelAnimationFrame(id)
  }, [target])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (drawn / 100) * c
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90 shrink-0"
      aria-hidden
      style={{ display: 'block' }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.n150} strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={T.progressRing}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        style={{ transition: 'stroke-dasharray 0.88s cubic-bezier(0.33, 1, 0.68, 1)' }}
      />
    </svg>
  )
}

// ─── Recharts custom tooltips ─────────────────────────────────────────────────
const AreaTip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: T.n900, borderRadius: T.rMd, padding: '8px 12px', border: `1px solid ${T.n800}`, minWidth: 120 }}>
      <p style={{ color: T.n300, fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: T.n300 }}>{p.name}:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const BarTip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { label: string; color: string } }> }) => {
  if (!active || !payload?.length) return null
  const { label, color } = payload[0].payload
  return (
    <div style={{ background: T.n900, borderRadius: T.rMd, padding: '8px 12px', border: `1px solid ${T.n800}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: T.n300 }}>{label}:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{payload[0].value}</span>
      </div>
    </div>
  )
}

// ─── Акценты для избранных приложений (id из каталога public-apps) ───────────
const PRIMARY_META: Record<number, { desc: string; accent: string; bg: string }> = {
  36: { desc: 'Планирование и события', accent: T.accent,     bg: T.accentLt  },
  38: { desc: 'Управление задачами',    accent: T.brand,      bg: T.brandLt   },
  42: { desc: 'ИИ-ассистент',          accent: T.warningMid, bg: T.warningLt },
}

type ServiceMarqueeEntry = {
  svc: HomeDashboardViewModel['services'][number]
  accent: string
  bg: string
}

function DashboardServiceCube({
  entry,
  onOpen,
}: {
  entry: ServiceMarqueeEntry
  onOpen: (svc: HomeDashboardViewModel['services'][number]) => void
}) {
  const { svc, accent } = entry
  return (
    <button
      type="button"
      onClick={() => onOpen(svc)}
      aria-label={svc.label}
      style={{
        width: 164,
        height: 180,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '20px 14px',
        background: T.white,
        border: `1px solid ${T.n200}`,
        borderRadius: 24,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(85,96,164,0.03)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = T.shadowMd
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(85,96,164,0.03)'
        e.currentTarget.style.borderColor = T.n200
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Soft Inner Glow */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 0%, ${accent}08, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 22,
          background: T.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: `1px solid ${T.n150}`,
          flexShrink: 0,
          boxShadow: '0 8px 20px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.8)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {svc.appPhoto ? (
          <img
            src={svc.appPhoto}
            alt=""
            style={{
              width: '72%',
              height: '72%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialSymbol name={svc.icon} size={28} color={accent} />
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: T.n900,
          textAlign: 'center',
          lineHeight: 1.3,
          width: '100%',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: '0 4px',
          zIndex: 2,
        }}
      >
        {svc.label}
      </span>
    </button>
  )
}

const SERVICE_MARQUEE_CSS = `
@keyframes alem-dashboard-services-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(var(--alem-dashboard-services-marquee-shift, -50%)); }
}
.alem-dashboard-services-marquee-track {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 20px;
  width: max-content;
  animation: alem-dashboard-services-marquee linear infinite;
}
.alem-dashboard-services-marquee-track:hover {
  animation-play-state: paused;
}
`

// ─── Main component ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()

  // ── State (unchanged logic) ────────────────────────────────────────────────
  const [dashboardData, setDashboardData] = useState<HomeDashboardViewModel>(getDefaultHomeDashboardViewModel())
  const [isLoading, setIsLoading]         = useState(true)
  const [error, setError]                 = useState('')
  const [userName, setUserName]           = useState('Пользователь')
  const [selectedNotif, setSelectedNotif] = useState<HomeDashboardViewModel['notifications'][number] | null>(null)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [activeMenu, setActiveMenu]       = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<DashboardTask | null>(null)
  const [actionTargetId, setActionTargetId] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [availableBoards, setAvailableBoards] = useState<{ id: string; name: string }[]>([])

  // Date formatting
  const dateShort = new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', year:'numeric' }).format(new Date())
  const formattedShort = dateShort.charAt(0).toUpperCase() + dateShort.slice(1).replace('.','')

  // ── Controllers (unchanged) ────────────────────────────────────────────────
  const { homeDashboardController } = useMemo(() => createHomeDashboardController(), [])
  const { authController }          = useMemo(() => createAuthController(), [])
  const { boardController }         = useMemo(() => createBoardController(), [])
  const { notificationController }  = useMemo(() => createNotificationController(), [])

  // ── Derived chart data ─────────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    if (dashboardData._extra?.dynamics) {
      const d = dashboardData._extra.dynamics
      if (d.labels && d.datasets) {
        return d.labels.map((day, i) => {
          const row: Record<string, string | number> = { day }
          d.datasets.forEach(ds => {
            row[ds.name] = ds.data[i]
          })
          return row
        })
      }
    }
    // Fallback Mock
    const c = buildSeries(dashboardData.tasks.length, 1)
    const t = buildSeries(dashboardData.tasks.length - 2, -1)
    return CHART_DAYS.map((day, i) => ({ day, 'Текущая': c[i], 'Ориентир': t[i] }))
  }, [dashboardData])

  const taskStatusData = useMemo(() => {
    if (dashboardData._extra?.structure?.stats) {
      return dashboardData._extra.structure.stats.map(s => ({
        label: s.label,
        count: s.count,
        color: (s.label === 'К выполнению' || s.label === 'Ожидает') ? T.n400 : 
               s.label === 'В работе' ? T.warningMid : 
               s.label === 'Проверка' ? T.brand : T.success
      }))
    }
    const cnt: Record<string, number> = { 'К выполнению': 0, 'В работе': 0, 'Проверка': 0, 'Готово': 0 }
    dashboardData.tasks.forEach(t => { cnt[normalizeStatus(t.status)]++ })
    return [
      { label: 'К выполнению',  count: cnt['К выполнению'],  color: T.n400          },
      { label: 'В работе', count: cnt['В работе'],  color: T.warningMid    },
      { label: 'Проверка', count: cnt['Проверка'],  color: T.brand         },
      { label: 'Готово',   count: cnt['Готово'],    color: T.success       },
    ]
  }, [dashboardData])

  const completionPct = useMemo(() => {
    if (dashboardData._extra?.progress) {
      return dashboardData._extra.progress.percentage
    }
    const total = dashboardData.tasks.length
    if (!total) return 0
    const done = dashboardData.tasks.filter(t => normalizeStatus(t.status) === 'Готово').length
    return Math.round((done / total) * 100)
  }, [dashboardData])

  const totalTasks = useMemo(() => {
    if (dashboardData._extra?.structure) return dashboardData._extra.structure.total_count
    return dashboardData.tasks.length
  }, [dashboardData])

  const completedTasks = useMemo(() => {
    if (dashboardData._extra?.structure) {
      return dashboardData._extra.structure.stats.find(s => s.label === 'Готово')?.count ?? 0
    }
    return dashboardData.tasks.filter(t => normalizeStatus(t.status) === 'Готово').length
  }, [dashboardData])

  const inProgressTasks = useMemo(() => {
    if (dashboardData._extra?.structure) {
      return dashboardData._extra.structure.stats.find(s => s.label === 'В работе')?.count ?? 0
    }
    return dashboardData.tasks.filter(t => normalizeStatus(t.status) === 'В работе').length
  }, [dashboardData])

  const reviewTasks = useMemo(() => {
    if (dashboardData._extra?.structure) {
      return dashboardData._extra.structure.stats.find(s => s.label === 'Проверка')?.count ?? 0
    }
    return dashboardData.tasks.filter(t => normalizeStatus(t.status) === 'Проверка').length
  }, [dashboardData])

  
  /** Порядок как в ответе /api/v1/public-apps/favorites (через LoadHomeDashboard → favorites → view model). */
  const services = dashboardData.services

  const serviceMarqueeItems = useMemo((): ServiceMarqueeEntry[] => {
    const colors = [T.brand, T.success, T.warningMid, T.error, T.n600]
    const bgs = [T.brandLt, T.accentLt, T.n100, T.errorLt, T.brandLt]
    let colorIdx = 0
    return services.map((svc) => {
      const meta = PRIMARY_META[svc.id]
      if (meta) {
        return { svc, accent: meta.accent, bg: meta.bg }
      }
      const j = colorIdx % colors.length
      colorIdx += 1
      return { svc, accent: colors[j], bg: bgs[j] }
    })
  }, [services])

  const serviceMarqueeLoopCount = useMemo(() => {
    if (serviceMarqueeItems.length <= 2) return 6
    if (serviceMarqueeItems.length <= 4) return 4
    return 3
  }, [serviceMarqueeItems.length])

  const serviceMarqueeSegments = useMemo(
    () => Array.from({ length: serviceMarqueeLoopCount }, (_, index) => index),
    [serviceMarqueeLoopCount],
  )

  const recentEvents  = dashboardData.events.slice(0, 3)

  const dynamics_data = dashboardData._extra?.dynamics
  const slaData = dashboardData._extra?.sla
  const cycleTime = dashboardData._extra?.cycleTime
  const workload = dashboardData._extra?.workload
  const efficiencyTrend = dashboardData._extra?.efficiencyTrend
  const capacity = dashboardData._extra?.capacity
  const overdueTasks = dashboardData._extra?.overdueTasks || []
  const staleTasks = dashboardData._extra?.staleTasks || []

  /** Схлопываем одинаковые заголовки уведомлений в одну строку (меньше «каши» в ленте). */
  const recentNotifsGrouped = useMemo(() => {
    const raw = (dashboardData.notifications || []).filter(n => !n.read)
    const order: string[] = []
    const map = new Map<string, { item: HomeDashboardViewModel['notifications'][number]; count: number }>()
    
    for (const item of raw) {
      const key = item.title
      const cur = map.get(key)
      if (!cur) {
        if (order.length >= 5) continue
        order.push(key)
        map.set(key, { item: { ...item }, count: 1 })
      } else {
        cur.count += 1
      }
    }
    
    return order.map((k) => map.get(k)!)
  }, [dashboardData.notifications])
  const avgLoad    = dynamics_data ? Math.round(dynamics_data.average_load) : 0
  const unreadCount = (dashboardData.notifications || []).filter(n => !n.read).length

  const greetingText = useMemo(() => `Добрый день, ${userName}!`, [userName])
  const taglineText = useMemo(
    () =>
      'Одно окно для повестки дня: планируйте, ведите встречи по календарю и закрывайте задачи.',
    [],
  )
  const { displayed: greetingTyped, done: greetingTypedDone } = useTypewriter(greetingText, {
    enabled: !isLoading,
    msPerChar: 26,
    startDelayMs: 160,
  })
  const { displayed: taglineTyped, done: taglineTypedDone } = useTypewriter(taglineText, {
    enabled: !isLoading && greetingTypedDone,
    msPerChar: 9,
    startDelayMs: 80,
  })

  // ── prefers-reduced-motion: без бесконечной прокрутки ───────────────────────


  // ── Load Available Boards ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const loadBoards = async () => {
      try {
        const result = await boardController.bootstrap()
        if (!cancelled) setAvailableBoards(result.boards.map(b => ({ id: b.id, name: b.name })))
      } catch (e) {
        console.error('Failed to load boards for filters', e)
      }
    }
    void loadBoards()
    return () => { cancelled = true }
  }, [boardController])

  // ── Effects (unchanged logic) ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true); setError('')
      try {
        const [dm, am] = await Promise.all([
          homeDashboardController.load({ force: true, period: selectedPeriod, boardId: selectedBoardId }),
          authController.bootstrap()
        ])
        if (cancelled || !dm) return
        const statsWithBgs = (dm.stats || []).map(s => ({
          ...s,
          backgroundImage:
            s.id === 'tasks'    ? taskcardbg :
            s.id === 'meetings' ? meetsbg    :
            s.id === 'docs'     ? docscardbg :
            s.id === 'score'    ? scorebg    : undefined,
        }))
        setDashboardData({ ...dm, stats: statsWithBgs })
        setUserName(am.name || 'Пользователь')
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, 'Не удалось загрузить данные. Обновите страницу.'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authController, homeDashboardController, selectedPeriod, selectedBoardId])

  useEffect(() => {
    if (!activeMenu) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest('[data-task-menu]')) setActiveMenu(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveMenu(null) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [activeMenu])

  // ── Handlers (unchanged logic) ─────────────────────────────────────────────
  const handleOpenService = (s: HomeDashboardViewModel['services'][number]) => {
    if (s.id === 36) { navigate('/calendar'); return }
    if (s.id === 38) { navigate('/board');    return }
    if (s.id === 42) { navigate('/alemai');   return }

    if (s.link) {
      let finalUrl = s.link
      if (s.id === 39 || s.label?.toLowerCase().includes('drive')) {
        try {
          const url = new URL(s.link)
          const token = sessionStore.getTokens()?.accessToken
          if (token) {
            url.searchParams.set('token', token)
          }
          finalUrl = url.toString()
        } catch {
          // fallback to original link if invalid URL
        }
      }
      window.open(finalUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleToggleMenu = useCallback((id: string) =>
    setActiveMenu(p => p === id ? null : id), [])

  const handleOpenInBoard = useCallback(async (taskId: string) => {
    setActiveMenu(null); setActionTargetId(taskId); setError('')
    try {
      const t = await boardController.loadTask(taskId)
      const params = new URLSearchParams({ boardId: t.boardId, taskId: t.id })
      navigate(`/board?${params.toString()}`)
    } catch (e) {
      setError(getErrorMessage(e, 'Не удалось открыть задачу на доске.'))
    } finally { setActionTargetId('') }
  }, [boardController, navigate])

  const handleRequestDelete = useCallback((task: DashboardTask) => {
    setActiveMenu(null); setDeleteTarget(task)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    void (async () => {
      setDeleteLoading(true); setError('')
      try {
        const t = await boardController.loadTask(deleteTarget.id)
        await boardController.deleteTask(t.boardId, deleteTarget.id)
        try { setDashboardData(await homeDashboardController.load({ force: true })) }
        catch { setDashboardData(p => ({ ...p, tasks: p.tasks.filter(i => i.id !== deleteTarget.id) })) }
        setDeleteTarget(null)
      } catch (e) {
        setError(getErrorMessage(e, 'Не удалось удалить задачу.'))
      } finally { setDeleteLoading(false) }
    })()
  }, [boardController, homeDashboardController, deleteTarget])

  const handleSelectNotification = useCallback((notif: HomeDashboardViewModel['notifications'][number]) => {
    setSelectedNotif(notif)
    if (!notif.read) {
      void notificationController.markAsRead(notif.id)
      // Update local state for immediate feedback
      setDashboardData(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => 
          n.id === notif.id ? { ...n, read: true } : n
        )
      }))
    }
  }, [notificationController])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: T.n50, position: 'relative' }}>
      {/* ══ MAIN SCROLL AREA ════════════════════════════════════════════════ */}
      <main
        id="dashboard-main"
        className="flex-1 overflow-y-auto"
        style={{
          background: `
            linear-gradient(135deg, #F4F9FF 0%, #EEF6FF 38%, #F7FBFF 68%, #EAF4FF 100%)
          `,
        }}
      >
        <div
          className="mx-auto w-full max-w-360"
          style={{
            padding: '24px 24px 40px',
          }}
        >

          {/* Error banner */}
          {error && (
            <div
              className="mb-5 flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: T.errorLt, border: `1px solid ${T.errorBd}` }}
              role="alert"
              aria-live="assertive"
            >
              <MaterialSymbol name="error" size={17} color={T.error} />
              <p style={{ fontSize: 13, fontWeight: 500, color: T.error }}>{error}</p>
            </div>
          )}

          {isLoading ? <DashboardSkeleton /> : (
            <div className="flex flex-col" style={{ gap: 24 }}>

              {/* ── Briefing: приветствие + сводка (единая панель, без «карточного» шаблона) ── */}
              <section aria-label="Рабочее пространство и ключевые показатели">
                <div
                  style={{
                    borderRadius: T.rLg,
                    ...surfaceStyle,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
                    style={{
                      padding: '24px 24px 22px',
                      position: 'relative',
                    }}
                  >
                    <div className="min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.n600, marginBottom: 10 }}>
                        Рабочее пространство
                      </p>
                      <h1
                        aria-label={greetingText}
                        style={{
                          fontSize: 'clamp(22px, 2.2vw, 32px)',
                          fontWeight: 600,
                          color: T.n800,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          minHeight: '1.35em',
                        }}
                      >
                        <span aria-hidden>{greetingTyped}</span>
                        {!greetingTypedDone ? <TypewriterCursor color={T.brand} /> : null}
                      </h1>
                      <p
                        aria-label={taglineText}
                        style={{
                          fontSize: 16,
                          color: T.n600,
                          marginTop: 8,
                          lineHeight: 1.45,
                          minHeight: '2.9em',
                          maxWidth: 720,
                        }}
                      >
                        <span aria-hidden>{greetingTypedDone ? taglineTyped : '\u00a0'}</span>
                        {greetingTypedDone && !taglineTypedDone ? <TypewriterCursor color={T.n400} /> : null}
                      </p>
                      
                    </div>
                    <div
                      className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end"
                    >
                      <time
                        dateTime={new Date().toISOString().slice(0, 10)}
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.n700,
                          padding: '10px 14px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.78)',
                          border: `1px solid ${T.n200}`,
                          boxShadow: T.shadowSm,
                        }}
                      >
                        {formattedShort}
                      </time>
                    </div>
                  </div>

                  <Div />

                  <div
                    className="grid grid-cols-2 gap-px xl:grid-cols-4"
                    style={{ background: T.n150 }}
                    aria-label="Ключевые показатели"
                  >
                    {dashboardData.stats.slice(0, 4).map((stat, i) => {
                      const up = stat.delta >= 0
                      const deltaAbs = Math.abs(stat.delta)
                      const deltaMuted = deltaAbs < 0.0001
                      const CONF = [
                        { icon: 'badge' as const },
                        { icon: 'videocam' as const },
                        { icon: 'folder_open' as const },
                        { icon: 'emoji_events' as const },
                      ]
                      const row = CONF[i % CONF.length]

                      return (
                        <div
                          key={stat.id}
                          className="min-w-0"
                          style={{
                            background: T.white,
                            padding: '16px 18px 18px',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span style={{ width: 30, height: 30, borderRadius: 12, background: i % 2 === 0 ? T.brandLt : T.accentLt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialSymbol name={row.icon} size={16} color={i % 2 === 0 ? T.brand : T.accent} />
                            </span>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: T.n600,
                                lineHeight: 1.3,
                              }}
                            >
                              {stat.label}
                            </p>
                          </div>
                          <p
                            style={{
                              fontSize: 26,
                              fontWeight: 600,
                              color: T.n900,
                              lineHeight: 1.1,
                              marginTop: 10,
                              fontVariantNumeric: 'tabular-nums',
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {stat.value}
                            {stat.unit ? (
                              <span style={{ fontSize: 14, fontWeight: 500, color: T.n400, marginLeft: 5 }}>{stat.unit}</span>
                            ) : null}
                          </p>
                          <p style={{ fontSize: 12, color: T.n400, marginTop: 8, lineHeight: 1.45 }}>
                            {stat.deltaLabel}
                            {!deltaMuted ? (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontWeight: 600,
                                  color: up ? T.success : T.error,
                                }}
                              >
                                {up ? '↑' : '↓'} {deltaAbs}%
                              </span>
                            ) : (
                              <span style={{ marginLeft: 6, color: T.n400 }}>· без изменений</span>
                            )}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* Сервисы рабочего пространства */}
              <section
                aria-label="Сервисы рабочего пространства"
                style={{
                  background: T.white,
                  border: `1px solid ${T.n200}`,
                  borderRadius: T.rXl,
                  boxShadow: T.shadowSm,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div 
                  style={{ 
                    padding: '24px 28px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: 16,
                    position: 'relative'
                  }}
                >
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.n400, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 8 }}>
                      Навигация
                    </p>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: T.n900, margin: 0, letterSpacing: '-0.02em' }}>
                      Сервисы рабочего пространства
                    </h2>
                  </div>
                  
                </div>

                <style dangerouslySetInnerHTML={{ __html: SERVICE_MARQUEE_CSS }} />
                <div 
                  style={{ 
                    padding: '10px 0 32px', 
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="alem-dashboard-services-marquee-track"
                    style={{
                      animationDuration: `${Math.max(40, serviceMarqueeItems.length * 6)}s`,
                      ['--alem-dashboard-services-marquee-shift' as string]: `${-100 / serviceMarqueeLoopCount}%`,
                    }}
                  >
                    {serviceMarqueeSegments.map((segmentIndex) => (
                      <div
                        key={`segment-${segmentIndex}`}
                        style={{ display: 'flex', alignItems: 'stretch', gap: 20, flex: '0 0 auto' }}
                        aria-hidden={segmentIndex > 0}
                      >
                        {serviceMarqueeItems.length === 0 ? (
                          <div style={{ width: 400, padding: '40px 0', textAlign: 'center', background: T.n50, borderRadius: T.rLg, border: `1px dashed ${T.n200}` }}>
                            <p style={{ fontSize: 14, color: T.n400 }}>Нет доступных сервисов</p>
                          </div>
                        ) : (
                          serviceMarqueeItems.map((entry) => (
                            <DashboardServiceCube
                              key={`m-${segmentIndex}-${entry.svc.id}`}
                              entry={entry}
                              onOpen={handleOpenService}
                            />
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Блок 2: задачи и боковая лента — отдельная карточка */}
              <section
                aria-label="Задачи, события и уведомления"
                style={{
                  borderRadius: T.rXl,
                  ...surfaceStyle,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.n150}` }}>
                  <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: 0, letterSpacing: '-0.02em' }}>Задачи и лента</h2>
                </div>

                <div
                  className="grid grid-cols-1 gap-5 xl:grid-cols-12"
                  style={{ background: 'linear-gradient(180deg, #F8FCFF 0%, #F2F8FF 100%)', padding: '18px' }}
                >
                {/* Tasks Registry */}
                <div
                  className="border-b border-solid xl:col-span-7 xl:border-b-0 xl:border-r"
                  style={{
                    border: `1px solid ${T.n150}`,
                    background: T.white,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    borderRadius: T.rLg,
                    overflow: 'hidden',
                    boxShadow: T.shadowSm,
                  }}
                >
                  <div style={{ padding: '14px 18px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, borderBottom: `1px solid ${T.n150}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.n500, margin: 0 }}>Доска</p>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, marginTop: 4, marginBottom: 0 }}>Мои задачи</h3>
                      </div>
                      {inProgressTasks > 0 && (
                        <span style={{
                          padding: '5px 10px', borderRadius: 999,
                          background: T.warningLt, border: `1px solid ${T.warningBd}`,
                          fontSize: 11, fontWeight: 700, color: T.warning,
                        }}>
                          {inProgressTasks} в работе
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/board')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '0',
                        background: 'transparent', border: 'none',
                        fontSize: 14, fontWeight: 700, color: T.brand,
                        cursor: 'pointer', textDecoration: 'none',
                        borderBottom: 'none',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderBottomColor = T.brandBd }}
                      onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
                    >
                      Открыть доску
                      <MaterialSymbol name="chevron_right" size={16} color={T.brand} />
                    </button>
                  </div>

                  {/* Table */}
                  {dashboardData.tasks.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: T.rMd, background: T.n100, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                        <MaterialSymbol name="check_circle" size={20} color={T.n400} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.n700, margin: 0 }}>Список пуст</p>
                      <p style={{ fontSize: 13, color: T.n500, marginTop: 6, textAlign: 'center', maxWidth: 280, lineHeight: 1.45 }}>
                        Задач на доске здесь нет — откройте доску и добавьте первую.
                      </p>
                    </div>
                  ) : (
                    <div style={{ flex: 1, overflowX: 'auto' }}>
                      <table style={{ minWidth: '100%', borderCollapse: 'collapse' }} aria-label="Реестр задач">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.n150}` }}>
                            {(['Задача', 'Статус', 'Срок', ''] as const).map((h, hi) => (
                              <th
                                key={h || 'actions'}
                                scope="col"
                                style={{
                                  padding: '11px 16px',
                                  textAlign: 'left',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.n500,
                                  whiteSpace: 'nowrap',
                                  width: hi === 0 ? '47%' : hi === 3 ? 44 : undefined,
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.tasks.slice(0, 6).map((task, idx) => {
                            const st  = normalizeStatus(task.status)
                            const cfg = statusCfg(st)
                            const isLast = idx === Math.min(dashboardData.tasks.length, 6) - 1
                            return (
                              <tr
                                key={task.id}
                                style={{ borderBottom: isLast ? 'none' : `1px solid ${T.n100}`, transition: 'background 0.1s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#FBFCFF' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              >
                                {/* Task */}
                                <td style={{ padding: '14px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.n400, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: T.n900, lineHeight: 1.35 }}>
                                      {task.title}
                                    </span>
                                  </div>
                                </td>
                                {/* Status */}
                                <td style={{ padding: '14px 16px' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '5px 10px',
                                    borderRadius: 99,
                                    background: cfg.bg, border: `1px solid ${cfg.bd}`,
                                    fontSize: 11, fontWeight: 700, color: cfg.text,
                                    whiteSpace: 'nowrap',
                                  }}>
                                    <MaterialSymbol name={cfg.icon} size={11} color={cfg.text} />
                                    {st}
                                  </span>
                                </td>
                                {/* Due */}
                                <td style={{ padding: '14px 16px' }}>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: task.due === '—' ? T.n300 : T.n600 }}>
                                    {task.due}
                                  </span>
                                </td>
                                {/* Actions */}
                                <td style={{ padding: '14px 16px' }}>
                                  <div style={{ position: 'relative' }} data-task-menu>
                                    <button
                                      type="button"
                                      aria-haspopup="menu"
                                      aria-expanded={activeMenu === task.id}
                                      aria-label="Действия"
                                      disabled={actionTargetId === task.id || deleteLoading}
                                      onClick={() => handleToggleMenu(task.id)}
                                      style={{
                                        width: 28, height: 28,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: T.rSm,
                                        background: activeMenu === task.id ? T.brandLt : 'transparent',
                                        border: `1px solid ${activeMenu === task.id ? T.brandBd : 'transparent'}`,
                                        cursor: 'pointer', color: activeMenu === task.id ? T.brand : T.n400,
                                        transition: 'all 0.1s',
                                      }}
                                      onMouseEnter={e => { if (activeMenu !== task.id) { e.currentTarget.style.background = T.n100 } }}
                                      onMouseLeave={e => { if (activeMenu !== task.id) { e.currentTarget.style.background = 'transparent' } }}
                                    >
                                      <MaterialSymbol name="more_horiz" size={16} color="currentColor" />
                                    </button>

                                    {activeMenu === task.id && (
                                      <div
                                        role="menu"
                                        style={{
                                          position: 'absolute',
                                          right: 0,
                                          [idx >= 4 ? 'bottom' : 'top']: '100%',
                                          marginTop: idx >= 4 ? 0 : 4,
                                          marginBottom: idx >= 4 ? 4 : 0,
                                          zIndex: 40,
                                          width: 196,
                                          background: T.white,
                                          border: `1px solid ${T.n200}`,
                                          borderRadius: T.rLg,
                                          boxShadow: T.shadowXl,
                                          padding: 6,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => void handleOpenInBoard(task.id)}
                                          style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 10px',
                                            borderRadius: T.rMd,
                                            fontSize: 13, fontWeight: 500, color: T.n700,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.background = T.n50 }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                          <MaterialSymbol name="open_in_new" size={15} color={T.n500} />
                                          Открыть на доске
                                        </button>
                                        <div style={{ height: 1, background: T.n100, margin: '3px 6px' }} />
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => handleRequestDelete(task)}
                                          style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 10px',
                                            borderRadius: T.rMd,
                                            fontSize: 13, fontWeight: 500, color: T.error,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.background = T.errorLt }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                          <MaterialSymbol name="delete_outline" size={15} color={T.error} />
                                          Удалить
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Календарь + уведомления — одна колонка, общий фон */}
                <div
                  className="flex min-h-0 min-w-0 flex-col xl:col-span-5"
                  style={{
                    border: `1px solid ${T.n150}`,
                    background: T.white,
                    borderRadius: T.rLg,
                    overflow: 'hidden',
                    boxShadow: T.shadowSm,
                  }}
                >
                  <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: `1px solid ${T.n150}` }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: T.n900, margin: 0 }}>События и уведомления</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => navigate('/calendar')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '0',
                          background: 'transparent', border: 'none',
                          fontSize: 14, fontWeight: 700, color: T.brand,
                          cursor: 'pointer', textDecoration: 'none',
                          borderBottom: 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderBottomColor = T.brandBd }}
                        onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
                      >
                        Открыть календарь
                        <MaterialSymbol name="chevron_right" size={16} color={T.brand} />
                      </button>
                      {unreadCount > 0 ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.n500 }}>
                          {unreadCount} непрочит.
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ padding: '12px 18px 10px', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.n500, margin: '0 0 6px' }}>Ближайшие</p>
                    {recentEvents.length === 0 ? (
                      <p style={{ fontSize: 13, color: T.n400, margin: 0, lineHeight: 1.45 }}>
                        Событий пока нет — загляните в календарь, когда появятся встречи.
                      </p>
                    ) : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {recentEvents.map((ev, index) => (
                          <li
                            key={ev.id}
                            style={{
                              display: 'flex',
                              gap: 10,
                              paddingBottom: index === recentEvents.length - 1 ? 0 : 10,
                              borderBottom: index === recentEvents.length - 1 ? 'none' : `1px solid ${T.n100}`,
                              fontSize: 13,
                              color: T.n800,
                            }}
                          >
                            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: T.n500, width: 44, flexShrink: 0 }}>{ev.time}</span>
                            <span style={{ fontWeight: 500, minWidth: 0, lineHeight: 1.4 }}>{ev.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div style={{ height: 1, background: T.n150, flexShrink: 0 }} />

                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.n500, margin: 0 }}>Уведомления</p>
                      <button
                        type="button"
                        onClick={() => setNotifModalOpen(true)}
                        style={{ fontSize: 13, fontWeight: 700, color: T.brand, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Все
                      </button>
                    </div>
                    <div
                      style={{ padding: '0 18px 12px 18px' }}
                    >
                      {recentNotifsGrouped.length === 0 ? (
                        <p style={{ fontSize: 13, color: T.n400, margin: '8px 0 0', lineHeight: 1.45 }}>Пока тихо — новые сообщения появятся здесь.</p>
                      ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {recentNotifsGrouped.map(({ item, count }) => {
                            const timeStr = item.sub.split('·').pop()?.trim() ?? item.sub
                            return (
                              <li key={`${item.title}-${item.id}`} style={{ borderBottom: `1px solid ${T.n100}` }}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectNotification(item)}
                                  style={{
                                    display: 'flex',
                                    width: '100%',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                    padding: '12px 6px 12px 0',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: T.n900,
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#FBFCFF' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  onFocus={e => { e.currentTarget.style.outline = `2px solid ${T.brand}`; e.currentTarget.style.outlineOffset = '2px' }}
                                  onBlur={e => { e.currentTarget.style.outline = 'none' }}
                                >
                                  <span style={{ width: 22, display: 'inline-flex', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                    <MaterialSymbol name={item.icon} size={18} color={item.read ? T.n400 : T.brand} />
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, fontSize: 13, fontWeight: item.read ? 500 : 600, lineHeight: 1.35 }}>
                                      <span>{item.title}</span>
                                      {count > 1 ? (
                                        <span style={{ fontSize: 11, fontWeight: 600, color: T.n400 }}>×{count}</span>
                                      ) : null}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 12, color: T.n400, marginTop: 5 }}>{timeStr}</span>
                                  </span>
                                  {!item.read ? (
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.brand, flexShrink: 0, marginTop: 6 }} aria-label="Непрочитано" />
                                  ) : null}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </section>

              {/* Блок 1: графики — визуальная сводка недели */}
              <section
                aria-label="Графики сводки недели"
                style={{
                  borderRadius: T.rXl,
                  border: `1px solid ${T.n200}`,
                  background: T.white,
                  boxShadow: T.shadowSm,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Subtle Grid Background */}
                <div 
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `radial-gradient(circle, #D1DBE8 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                    opacity: 0.15,
                    pointerEvents: 'none',
                  }}
                />

                <div
                  className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
                  style={{ padding: '24px 28px', borderBottom: `1px solid ${T.n150}`, position: 'relative' }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <MaterialSymbol name="leaderboard" size={18} color={T.brand} />
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.n500, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                        Неделя
                      </p>
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: T.n900, margin: 0, letterSpacing: '-0.02em' }}>
                      Сводка активности по Доске
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Всего задач', value: totalTasks, icon: 'badge', color: T.brand, bg: T.brandLt },
                      { label: 'В работе', value: inProgressTasks, icon: 'refresh', color: T.warning, bg: T.warningLt },
                      { label: 'Проверка', value: reviewTasks, icon: 'search', color: T.brandMid, bg: T.n100 },
                      { label: 'Готово', value: completedTasks, icon: 'check_circle', color: T.success, bg: T.successLt },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 14px',
                          background: T.white,
                          border: `1px solid ${T.n200}`,
                          borderRadius: 999,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        }}
                      >
                        <MaterialSymbol name={item.icon} size={16} color={item.color} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.n700 }}>{item.value}</span>
                        <span style={{ fontSize: 12, color: T.n400 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '24px', background: 'transparent', position: 'relative' }}>
                  <div
                    className="grid grid-cols-1 gap-4 xl:grid-cols-12"
                    style={{
                      alignItems: 'stretch',
                    }}
                  >
                  {/* AreaChart — performance trend */}
                  <div
                    className="xl:col-span-7"
                    style={{
                      background: T.white,
                      border: `1px solid ${T.n200}`,
                      borderRadius: T.rMd,
                      boxShadow: T.shadowSm,
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                  <div style={{ padding: '18px 20px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: T.n500, margin: 0 }}>Нагрузка</p>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: T.n900, marginTop: 5, marginBottom: 0, letterSpacing: '-0.02em' }}>
                        Эффективность за неделю
                      </h3>
                      <p style={{ fontSize: 12, color: T.n400, marginTop: 6, marginBottom: 0 }}>
                        Средняя нагрузка: <b style={{ color: T.n700 }}>{avgLoad}</b>
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: T.n500 }}>
                        <span style={{ width: 10, height: 3, borderRadius: 2, background: T.brand }} />
                        Текущая
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: T.n500 }}>
                        <span style={{ width: 14, borderTop: `2px dashed ${T.n300}`, display: 'inline-block' }} />
                        Ориентир
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '4px 8px 0 2px', minHeight: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyData} margin={{ top: 12, right: 18, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="ag-current" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={T.brand} stopOpacity={0.15} />
                            <stop offset="60%"  stopColor={T.brand} stopOpacity={0.05} />
                            <stop offset="100%" stopColor={T.brand} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={T.n150} strokeDasharray="4 6" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: T.n400, fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                          dy={8}
                        />
                        <YAxis 
                          hide={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: T.n300, fontWeight: 500 }}
                          width={30}
                        />
                        <Tooltip content={<AreaTip />} cursor={{ stroke: T.n200, strokeWidth: 1 }} />
                        <Area
                          type="monotone"
                          dataKey="Ориентир"
                          stroke={T.n300}
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                          fill="none"
                          dot={false}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="Текущая"
                          stroke={T.brand}
                          strokeWidth={2.5}
                          fill="url(#ag-current)"
                          dot={{ r: 4, fill: T.white, stroke: T.brand, strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: T.brand, stroke: T.white, strokeWidth: 2.5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.n100}`, background: '#F9FBFF', display: 'flex', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.n400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Макс. нагрузка</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.n800, marginTop: 4 }}>
                        {Math.max(...weeklyData.map(d => Number(d['Текущая']) || 0), 0)}
                      </div>
                    </div>
                    <div style={{ width: 1, height: 24, background: T.n150, alignSelf: 'center' }} />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.n400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SLA</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.success, marginTop: 4 }}>
                        {dashboardData._extra?.sla?.compliance ?? 0}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:col-span-5">
                  {/* Donut — completion % */}
                  <div
                    className="grid grid-cols-1 sm:grid-cols-[minmax(154px,0.85fr)_minmax(0,1fr)]"
                    style={{
                      background: T.white,
                      border: `1px solid ${T.n200}`,
                      borderRadius: T.rMd,
                      boxShadow: T.shadowSm,
                      minHeight: 196,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px 8px 20px 16px',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 136,
                          height: 136,
                          flexShrink: 0,
                        }}
                        aria-label={`Выполнено ${completionPct} процентов`}
                      >
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <WoltStyleProgressRing pct={completionPct} size={136} stroke={5.5} />
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            paddingBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 1,
                              lineHeight: 1,
                              color: T.n900,
                            }}
                          >
                            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                              {completionPct}
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: T.n400 }}>%</span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: T.n500, marginTop: 5, letterSpacing: '0.01em' }}>
                            закрыто
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '18px 18px 18px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.n500, margin: 0 }}>Прогресс</p>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: T.n900, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                        Выполнение задач
                      </h3>
                      <p style={{ fontSize: 12, color: T.n500, margin: '6px 0 0', lineHeight: 1.45 }}>
                        {completedTasks} из {totalTasks} закрыто · {inProgressTasks} в работе
                      </p>
                      <div style={{ marginTop: 14, height: 4, borderRadius: 99, background: T.n150, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${completionPct}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: T.progressRing,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Progress Indicators — "My Goals" Style */}
                  <div
                    style={{
                      background: T.white,
                      border: `1px solid ${T.n200}`,
                      borderRadius: T.rMd,
                      boxShadow: T.shadowSm,
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      overflow: 'hidden',
                      padding: '24px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MaterialSymbol name="leaderboard" size={22} color={T.brand} />
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: T.n900, margin: 0, letterSpacing: '-0.02em' }}>
                          Статусы задач
                        </h3>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.n400 }}>{totalTasks} всего</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {taskStatusData.map((item) => {
                        const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0
                        return (
                          <div key={item.label}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: T.n700 }}>{item.label}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: T.n900 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 99, background: T.n100, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  borderRadius: 99,
                                  background: item.color,
                                  transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                }}
                              />
                            </div>
                            <p style={{ fontSize: 12, color: T.n400, marginTop: 6, margin: 0 }}>
                              {item.count} задач в этом статусе
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                  </div>
                </div>
              </section>


              {/* Блок: Аналитика производительности — углубленные метрики доски */}
              <section
                aria-label="Аналитика производительности"
                style={{
                  borderRadius: T.rXl,
                  border: `1px solid ${T.n200}`,
                  background: T.white,
                  boxShadow: T.shadowSm,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Subtle Grid Background */}
                <div 
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `radial-gradient(circle, #D1DBE8 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                    opacity: 0.12,
                    pointerEvents: 'none',
                  }}
                />

                <div 
                  style={{ 
                    padding: '24px 28px', 
                    borderBottom: `1px solid ${T.n150}`, 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: 16,
                    position: 'relative'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <MaterialSymbol name="leaderboard" size={18} color={T.brand} />
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.n500, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                        Аналитика
                      </p>
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: T.n900, margin: 0, letterSpacing: '-0.02em' }}>
                      Производительность доски
                    </h2>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: T.white, 
                        borderRadius: 999, 
                        padding: '4px 6px', 
                        border: `1px solid ${T.n200}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      }}
                    >
                      <MaterialSymbol name="filter_list" size={16} color={T.n400} style={{ marginLeft: 6 }} />
                      <select 
                        value={selectedBoardId} 
                        onChange={e => setSelectedBoardId(e.target.value)}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: T.n700, 
                          padding: '6px 10px', 
                          outline: 'none', 
                          cursor: 'pointer', 
                          maxWidth: 160 
                        }}
                      >
                        <option value="">Все доски</option>
                        {availableBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>

                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: T.white, 
                        borderRadius: 999, 
                        padding: '4px', 
                        border: `1px solid ${T.n200}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      }}
                    >
                      {(['day', 'week', 'month'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setSelectedPeriod(p)}
                          style={{
                            padding: '6px 16px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 999,
                            border: 'none',
                            background: selectedPeriod === p ? T.brand : 'transparent',
                            color: selectedPeriod === p ? T.white : T.n500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {p === 'day' ? 'День' : p === 'week' ? 'Нед' : 'Мес'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '28px', background: 'transparent', position: 'relative' }}>
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                    
                    {/* SLA & Cycle Time & Reopen Rate */}
                    <div className="xl:col-span-4 flex flex-col gap-6">
                      <div 
                        style={{ 
                          background: T.white, 
                          border: `1px solid ${T.n200}`, 
                          borderRadius: T.rLg, 
                          padding: '24px', 
                          boxShadow: T.shadowSm,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <MaterialSymbol name="check_circle" size={18} color={T.success} />
                          <SL>Исполнение SLA</SL>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                          <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                             <WoltStyleProgressRing pct={slaData?.compliance ?? 0} size={90} stroke={7} />
                             <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: T.n900 }}>
                               {Math.round(slaData?.compliance ?? 0)}%
                             </div>
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: T.n800, margin: 0 }}>Соблюдение сроков</p>
                            <p style={{ fontSize: 12, color: T.n500, marginTop: 6, lineHeight: 1.5 }}>
                              <span style={{ color: T.success, fontWeight: 700 }}>{slaData?.onTime ?? 0}</span> вовремя<br/>
                              <span style={{ color: T.error, fontWeight: 700 }}>{slaData?.overdue ?? 0}</span> просрочено
                            </p>
                          </div>
                        </div>
                      </div>

                      <div 
                        style={{ 
                          background: T.white, 
                          border: `1px solid ${T.n200}`, 
                          borderRadius: T.rLg, 
                          padding: '24px', 
                          boxShadow: T.shadowSm 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <MaterialSymbol name="schedule" size={18} color={T.brand} />
                          <SL>Средний цикл (Cycle Time)</SL>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 36, fontWeight: 800, color: T.n900, letterSpacing: '-0.04em' }}>{cycleTime?.days.toFixed(1) ?? '0.0'}</span>
                          <span style={{ fontSize: 16, fontWeight: 600, color: T.n500 }}>дней</span>
                        </div>
                        <p style={{ fontSize: 12, color: T.n400, marginTop: 8, margin: 0 }}>
                          Среднее время от «В работе» до «Готово».
                        </p>
                      </div>

                      <div 
                        style={{ 
                          background: T.white, 
                          border: `1px solid ${T.n200}`, 
                          borderRadius: T.rLg, 
                          padding: '24px', 
                          boxShadow: T.shadowSm 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <MaterialSymbol name="description" size={18} color={T.warningMid} />
                          <SL>Качество (Reopen Rate)</SL>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: 32, fontWeight: 800, color: (dashboardData._extra?.reopenRate ?? 0) > 15 ? T.error : T.n900 }}>
                              {Math.round(dashboardData._extra?.reopenRate ?? 0)}%
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.n400 }}>возвратов</span>
                          </div>
                          <div style={{ height: 8, width: 80, borderRadius: 99, background: T.n100, overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${Math.min(100, (dashboardData._extra?.reopenRate ?? 0) * 2)}%`, 
                                height: '100%', 
                                background: (dashboardData._extra?.reopenRate ?? 0) > 15 ? T.error : T.brand,
                                borderRadius: 99,
                                transition: 'width 1s ease-out'
                              }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Workload Distribution Pie */}
                    <div className="xl:col-span-4" style={{ background: T.white, border: `1px solid ${T.n200}`, borderRadius: T.rLg, padding: '24px', boxShadow: T.shadowSm, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <MaterialSymbol name="leaderboard" size={18} color={T.brand} />
                        <SL>Распределение нагрузки</SL>
                      </div>
                      <div style={{ flex: 1, height: 220, position: 'relative', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0}>
                          <PieChart>
                            <Pie
                              data={workload || [{ name: 'Нет данных', value: 1 }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={6}
                              dataKey="value"
                              stroke="none"
                            >
                              {(workload || [{ name: 'None', value: 1 }]).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={[T.brand, T.warningMid, T.error, T.success, T.n400][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip content={<BarTip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 24 }}>
                        {workload?.slice(0, 4).map((item, index) => {
                          const colors = [T.brand, T.warningMid, T.error, T.success, T.n400];
                          return (
                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[index % colors.length] }} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: T.n600, flex: 1 }}>{item.name}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.n900 }}>{item.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Efficiency Trend Line */}
                    <div className="xl:col-span-4" style={{ background: T.white, border: `1px solid ${T.n200}`, borderRadius: T.rLg, padding: '24px', boxShadow: T.shadowSm, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <MaterialSymbol name="leaderboard" size={18} color={T.brand} />
                        <SL>Тренд эффективности</SL>
                      </div>
                      <div style={{ flex: 1, height: 220, position: 'relative', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0}>
                          <LineChart data={efficiencyTrend} margin={{ top: 10, right: 14, left: -20, bottom: 10 }}>
                            <CartesianGrid vertical={false} stroke={T.n100} strokeDasharray="6 6" />
                            <XAxis dataKey="date" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke={T.brand} 
                              strokeWidth={3} 
                              dot={{ r: 5, fill: T.white, strokeWidth: 2, stroke: T.brand }} 
                              activeDot={{ r: 7, fill: T.brand, stroke: T.white, strokeWidth: 2 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ marginTop: 24, padding: '16px', background: T.n50, borderRadius: T.rMd, border: `1px solid ${T.n150}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.n500, margin: 0 }}>Загрузка мощностей</p>
                          <p style={{ fontSize: 18, fontWeight: 800, color: T.n900, margin: '4px 0 0' }}>{Math.round(capacity?.usage ?? 0)}%</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.n500, margin: 0 }}>Лимит WIP</p>
                          <p style={{ fontSize: 18, fontWeight: 800, color: T.n900, margin: '4px 0 0' }}>{capacity?.active ?? 0} активных</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Overdue & Stale Tasks Grid */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
                    <div 
                      style={{ 
                        background: T.white, 
                        border: `1px solid ${T.n200}`, 
                        borderRadius: T.rLg, 
                        padding: '24px', 
                        boxShadow: T.shadowSm,
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: T.errorLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialSymbol name="error" size={18} color={T.error} />
                          </div>
                          <SL>Просроченные ({overdueTasks.length})</SL>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.error }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {overdueTasks.length === 0 ? (
                          <div style={{ padding: '24px 0', textAlign: 'center', background: T.n50, borderRadius: T.rMd, border: `1px dashed ${T.n200}` }}>
                            <p style={{ fontSize: 13, color: T.n400, margin: 0 }}>Просроченных задач нет</p>
                          </div>
                        ) : (
                          overdueTasks.slice(0, 3).map(t => (
                            <div 
                              key={t.id} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 12, 
                                padding: '12px 14px', 
                                background: T.white, 
                                borderRadius: T.rMd, 
                                border: `1px solid ${T.errorBd}44`,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.08)';
                                e.currentTarget.style.borderColor = T.errorBd;
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = `${T.errorBd}44`;
                              }}
                            >
                              <MaterialSymbol name="warning" size={16} color={T.error} style={{ opacity: 0.8 }} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: T.n800, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: T.error, background: T.errorLt, padding: '4px 10px', borderRadius: 99, letterSpacing: '0.02em' }}>+{t.days}д</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div 
                      style={{ 
                        background: T.white, 
                        border: `1px solid ${T.n200}`, 
                        borderRadius: T.rLg, 
                        padding: '24px', 
                        boxShadow: T.shadowSm,
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: T.warningLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialSymbol name="history" size={18} color={T.warning} />
                          </div>
                          <SL>Зависшие ({staleTasks.length})</SL>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.warningMid }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {staleTasks.length === 0 ? (
                          <div style={{ padding: '24px 0', textAlign: 'center', background: T.n50, borderRadius: T.rMd, border: `1px dashed ${T.n200}` }}>
                            <p style={{ fontSize: 13, color: T.n400, margin: 0 }}>Все задачи в движении</p>
                          </div>
                        ) : (
                          staleTasks.slice(0, 3).map(t => (
                            <div 
                              key={t.id} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 12, 
                                padding: '12px 14px', 
                                background: T.white, 
                                borderRadius: T.rMd, 
                                border: `1px solid ${T.warningBd}44`,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.08)';
                                e.currentTarget.style.borderColor = T.warningBd;
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = `${T.warningBd}44`;
                              }}
                            >
                              <MaterialSymbol name="hourglass_empty" size={16} color={T.warning} style={{ opacity: 0.8 }} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: T.n800, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: T.warning, background: T.warningLt, padding: '4px 10px', borderRadius: 99, letterSpacing: '0.02em' }}>{t.days}д</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>




            </div>
          )}
        </div>

        {/* ══ CONFIRM DELETE ══════════════════════════════════════════════ */}
        <AppConfirmDialog
          open={Boolean(deleteTarget)}
          title="Удаление задачи"
          message={deleteTarget ? `Удалить задачу «${deleteTarget.title}»? Это действие нельзя отменить.` : ''}
          confirmText="Удалить"
          cancelText="Отмена"
          isLoading={deleteLoading}
          onConfirm={handleConfirmDelete}
          onCancel={() => { if (!deleteLoading) setDeleteTarget(null) }}
        />

        {/* ══ NOTIFICATION DETAIL MODAL ════════════════════════════════ */}
        {selectedNotif && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
              background: 'rgba(7,16,28,0.55)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSelectedNotif(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nd-title"
          >
            <div
              style={{
                width: '100%', maxWidth: 480,
                background: T.white,
                border: `1px solid ${T.n200}`,
                borderRadius: T.rXl,
                boxShadow: T.shadowXl,
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.n150}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: T.rMd, background: T.brandLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialSymbol name={selectedNotif.icon} size={15} color={T.brand} />
                  </div>
                  <h3 id="nd-title" style={{ fontSize: 15, fontWeight: 700, color: T.n900 }}>Уведомление</h3>
                </div>
                <button type="button" onClick={() => setSelectedNotif(null)} aria-label="Закрыть"
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: T.rSm, background: 'transparent', border: 'none', cursor: 'pointer', color: T.n400 }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.n100 }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <MaterialSymbol name="close" size={16} color="currentColor" />
                </button>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ padding: '14px 16px', background: T.n50, border: `1px solid ${T.n100}`, borderRadius: T.rLg }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: T.n900 }}>{selectedNotif.title}</p>
                  <p style={{ fontSize: 13, color: T.n500, marginTop: 8, lineHeight: 1.6 }}>{selectedNotif.sub}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
                  {selectedNotif.metadata?.kind === 'kanban_task' && (
                    <button
                      type="button"
                      onClick={() => void handleOpenInBoard(String(selectedNotif.metadata?.task_id))}
                      style={{
                        padding: '7px 16px',
                        borderRadius: T.rMd,
                        background: T.brand,
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.white,
                        cursor: 'pointer',
                      }}
                    >
                      Перейти к задаче
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedNotif(null)}
                    style={{ padding: '7px 16px', borderRadius: T.rMd, background: T.brandLt, border: `1px solid ${T.brandBd}`, fontSize: 13, fontWeight: 600, color: T.brand, cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.brand; e.currentTarget.style.color = T.white }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.brandLt; e.currentTarget.style.color = T.brand }}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ALL NOTIFICATIONS MODAL ══════════════════════════════════ */}
        {notifModalOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px 16px',
              background: 'rgba(7,16,28,0.55)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setNotifModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="na-title"
          >
            <div
              style={{
                width: '100%', maxWidth: 760,
                maxHeight: 'min(86vh, 860px)',
                minHeight: 0,
                background: T.white,
                border: `1px solid ${T.n200}`,
                borderRadius: T.rXl,
                boxShadow: T.shadowXl,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.n150}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <SL>Системные события</SL>
                  <h3 id="na-title" style={{ fontSize: 18, fontWeight: 700, color: T.n900, marginTop: 6 }}>Все уведомления</h3>
                  <p style={{ fontSize: 12, color: T.n400, marginTop: 2 }}>
                    {dashboardData.notifications.length} записей
                    {unreadCount > 0 && ` · ${unreadCount} непрочитанных`}
                  </p>
                </div>
                <button type="button" onClick={() => setNotifModalOpen(false)} aria-label="Закрыть"
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: T.rMd, background: T.n100, border: `1px solid ${T.n200}`, cursor: 'pointer', color: T.n500 }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.n150 }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.n100 }}
                >
                  <MaterialSymbol name="close" size={16} color="currentColor" />
                </button>
              </div>

              {/* Body */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarGutter: 'stable',
                  overscrollBehavior: 'contain',
                  padding: '16px 20px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box', paddingBottom: 40 }}>
                  {(!dashboardData.notifications || dashboardData.notifications.length === 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                      <div style={{ width: 44, height: 44, borderRadius: T.rLg, background: T.n100, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <MaterialSymbol name="notifications_none" size={22} color={T.n300} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.n700 }}>Уведомлений нет</p>
                    </div>
                  ) : dashboardData.notifications.map((item, i) => {
                    const nColors = [T.brand, T.success, T.warningMid, T.error]
                    const nBgs    = [T.brandLt, T.successLt, T.warningLt, T.errorLt]
                    const timeStr = item.sub.split('·').pop()?.trim() ?? item.sub
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setNotifModalOpen(false); handleSelectNotification(item) }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 14,
                          width: '100%',
                          padding: '16px 18px',
                          background: item.read ? T.n50 : T.white,
                          border: `1px solid ${item.read ? T.n100 : T.n200}`,
                          borderRadius: T.rLg,
                          textAlign: 'left', cursor: 'pointer',
                          transition: 'all 0.1s',
                          boxSizing: 'border-box',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = T.brandLt; e.currentTarget.style.borderColor = T.brandBd }}
                        onMouseLeave={e => { e.currentTarget.style.background = item.read ? T.n50 : T.white; e.currentTarget.style.borderColor = item.read ? T.n100 : T.n200 }}
                        onFocus={e => { e.currentTarget.style.outline = `2px solid ${T.brand}`; e.currentTarget.style.outlineOffset = '2px' }}
                        onBlur={e => { e.currentTarget.style.outline = 'none' }}
                        >
                        <div style={{ width: 36, height: 36, borderRadius: T.rMd, background: nBgs[i % nBgs.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <MaterialSymbol name={item.icon} size={16} color={nColors[i % nColors.length]} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: item.read ? 500 : 700, color: T.n900, lineHeight: 1.35 }}>{item.title}</p>
                          <p
                            style={{
                              margin: '6px 0 0',
                              fontSize: 12,
                              color: T.n500,
                              lineHeight: 1.5,
                              display: 'block',
                              maxWidth: '100%',
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'break-word',
                              wordBreak: 'normal',
                              paddingRight: 4,
                            }}
                          >
                            {item.sub}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <MaterialSymbol name="schedule" size={11} color={T.n400} />
                            <span style={{ fontSize: 11, color: T.n400, lineHeight: 1.4 }}>{timeStr}</span>
                          </div>
                        </div>
                        {!item.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.brand, flexShrink: 0, marginTop: 6, alignSelf: 'flex-start' }} aria-label="Непрочитано" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
