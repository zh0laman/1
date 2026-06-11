/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from 'react'
import { C } from '../../pages/dashboard/model/constants'

const Chip = ({ label, color, bg }) => (
  <span
    className="inline-block whitespace-nowrap rounded-[5px] px-2 py-[3px] text-[10px] font-bold tracking-[0.04em]"
    style={{ color, background: bg }}
  >
    {label}
  </span>
)

const priorityMeta = (p) =>
  ({
    Высокий: { color: C.red, bg: C.redBg },
    Средний: { color: C.amber, bg: C.amberBg },
    Низкий: { color: C.green, bg: C.greenBg },
  }[p] || { color: C.inkMuted, bg: C.canvas })

const statusMeta = (s) =>
  ({
    'В работе': { color: C.blue, bg: C.blueSoft },
    'На проверке': { color: C.amber, bg: C.amberBg },
    'Готово': { color: C.green, bg: C.greenBg },
    'К выполнению': { color: C.inkMuted, bg: C.canvas },
  }[s] || { color: C.inkMuted, bg: C.canvas })

const Avatar = ({ initials, size = 28, seed = 0 }) => {
  const gs = [
    `linear-gradient(135deg,${C.blue} 0%,${C.blueDark} 100%)`,
    'linear-gradient(135deg,#6235C0 0%,#3B1F8C 100%)',
    `linear-gradient(135deg,${C.green} 0%,#065F46 100%)`,
    `linear-gradient(135deg,${C.amber} 0%,#92400E 100%)`,
  ]

  return (
    <div
      className="shrink-0 select-none flex items-center justify-center font-bold text-white tracking-[0.02em] shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: gs[seed % gs.length],
        fontSize: size * 0.33,
      }}
    >
      {initials}
    </div>
  )
}

const Spark = ({ data, color }) => {
  const W = 64
  const H = 28
  const pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (W - pad * 2), H - pad - ((v - min) / range) * (H - pad * 2)])
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fill =
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') +
    ` L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`
  const gradientId = `sg-${color.replace('#', '')}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <path d={path} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  )
}

const Ring = ({ pct, size = 56, stroke = 5, color }) => {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const [drawn, setDrawn] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDrawn(pct), 120)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <svg width={size} height={size} className="-rotate-90 transition-all duration-300">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${(drawn / 100) * circ} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

export { Avatar, Chip, Ring, Spark, priorityMeta, statusMeta }
