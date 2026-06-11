import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { ProfileStatsViewModel } from '../../view-models/ProfileViewModel'

interface ProfileAnalyticsSectionProps {
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

export default function ProfileAnalyticsSection({ stats }: ProfileAnalyticsSectionProps) {
  const periodLabel = periodMap[stats.period] ?? stats.period

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-5 flex items-center gap-2">
        <MaterialSymbol name="analytics" size={18} color="#2563EB" />
        <h3 className="text-[15px] font-semibold text-[#111827]">Аналитика и оценка профиля</h3>
        <span className="ml-auto text-[11px] font-medium text-[#9CA3AF]">{periodLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,300px)_1fr]">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">Всего оценок</p>
            <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827]">{stats.reviewCount}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">Средний балл</p>
            <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827]">
              {stats.overallScore.toFixed(1)}
              <span className="ml-1 text-[14px] font-medium text-[#9CA3AF]">/ 5.0</span>
            </p>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-[13px] font-semibold text-[#374151]">Мой рейтинг</h4>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {stats.skills.map((skill) => {
              const normalized = Math.max(0, Math.min(5, skill.score))
              const percentage = (normalized / 5) * 100

              return (
                <div key={skill.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[#4B5563]">{skill.label}</p>
                    <p className="text-[12px] font-semibold text-[#111827]">
                      {normalized.toFixed(1)}
                      <span className="font-medium text-[#9CA3AF]"> / 5.0</span>
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
