import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { Spark } from './primitives'

interface KpiItem {
  id: string
  label: string
  value: number
  unit: string
  delta: number
  deltaLabel: string
  icon: string
  color: string
  bg: string
  sparkline: number[]
}

interface KpiCardProps {
  stat: KpiItem
}

export default function KpiCard({ stat }: KpiCardProps) {
  const isUp = stat.delta >= 0

  return (
    <CardShell 
      className="group relative overflow-hidden border-0 bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <div 
        className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-40" 
        style={{ backgroundImage: `radial-gradient(circle at 100% 0%, ${stat.color}, transparent 50%)` }} 
      />
      {/* Тор section: Icon & Title */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 pr-2">
          <div 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition-transform group-hover:scale-105" 
            style={{ backgroundColor: `${stat.color}15` }}
          >
            <MaterialSymbol name={stat.icon} size={20} color={stat.color} />
          </div>
          <span className="line-clamp-2 text-[13px] font-bold leading-tight text-[#64748B]">
            {stat.label}
          </span>
        </div>
      </div>

      {/* Middle section: Numbers */}
      <div className="relative mb-4 flex items-baseline gap-1.5">
        <span className="text-[34px] font-extrabold tracking-tight text-[#0A1628] leading-none">
          {stat.value}
        </span>
        {stat.unit ? <span className="text-sm font-bold text-[#94A3B8]">{stat.unit}</span> : null}
      </div>

      {/* Bottom section: Delta & Sparkline */}
      <div className="relative flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={[
              'inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[11px] font-extrabold tracking-wide',
              isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
            ].join(' ')}
          >
            {isUp ? '+' : '-'}
            {Math.abs(stat.delta)}%
          </span>
          <span className="truncate text-[12px] font-medium text-[#94A3B8]">{stat.deltaLabel}</span>
        </div>
        <div className="h-8 w-16 shrink-0 opacity-60 mix-blend-multiply transition-opacity group-hover:opacity-100">
          <Spark data={stat.sparkline} color={stat.color} />
        </div>
      </div>
    </CardShell>
  )
}
