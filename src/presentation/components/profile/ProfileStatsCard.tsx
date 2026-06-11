import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { ProfileStatsViewModel } from '../../view-models/ProfileViewModel'

interface ProfileStatsCardProps {
  stats: ProfileStatsViewModel
}

const periodMap: Record<string, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  current_day: 'Сегодня',
  current_week: 'На этой неделе',
  current_month: 'В этом месяце',
  quarter: 'Квартал',
  year: 'Год',
}

export default function ProfileStatsCard({ stats }: ProfileStatsCardProps) {
  const periodLabel = periodMap[stats.period] ?? stats.period

  return (
    <section className="rounded-2xl border border-[#DDE3EE] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-[#0A1628]">Статистика профиля</h3>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Период: <span className="text-[#1E88E5] font-bold">{periodLabel}</span></p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF4FE] text-[#1E88E5]">
          <MaterialSymbol name="leaderboard" size={20} color="currentColor" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="group relative overflow-hidden rounded-xl bg-[#F8FBFF] p-5 ring-1 ring-[#EAEFF8]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5B7396]">Всего оценок</p>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tighter text-[#0A1628]">{stats.reviewCount}</p>
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1E88E5] opacity-10">
            <MaterialSymbol name="rate_review" size={48} color="currentColor" />
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl bg-[#F8FBFF] p-5 ring-1 ring-[#EAEFF8]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5B7396]">Средний балл</p>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tighter text-[#0A1628]">{stats.overallScore.toFixed(1)}</p>
            <span className="text-xs font-bold text-[#7B94B8]">/ 5.0</span>
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1E88E5] opacity-10">
            <MaterialSymbol name="star" size={48} color="currentColor" />
          </div>
        </div>
      </div>
    </section>
  )
}
