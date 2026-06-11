import CardShell from '../../../shared/ui/CardShell'
import { Ring } from './primitives'

interface PerformanceModel {
  periodScore: number
  totalScore: number
  level: number
  progressPercent: number
}

interface PerformanceCardProps {
  performance: PerformanceModel
}

export default function PerformanceCard({ performance }: PerformanceCardProps) {
  const progress = Math.max(0, Math.min(100, performance.progressPercent))

  return (
    <CardShell className="p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">Результативность за неделю</p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
          <Ring pct={progress} size={76} stroke={7} color="#1E88E5" />
          <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-[#0A1628]">{progress}%</div>
        </div>
        <div>
          <p className="text-3xl font-extrabold leading-none tracking-[-0.03em] text-[#0A1628]">{performance.totalScore}</p>
          <p className="mt-1 text-xs text-[#8497B4]">Общие баллы</p>
          <p className="mt-1.5 text-xs text-[#0A8F5C]">+{performance.periodScore} за период</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#F8FAFD] p-3.5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#374C6B]">
            Уровень {performance.level} {'->'} {performance.level + 1}
          </span>
          <span className="font-bold text-[#0A1628]">{performance.totalScore}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#DDE3EE]">
          <div className="h-full rounded-full bg-[#1E88E5]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </CardShell>
  )
}
