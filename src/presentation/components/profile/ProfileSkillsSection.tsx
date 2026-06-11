import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { ProfileStatsViewModel } from '../../view-models/ProfileViewModel'

interface ProfileSkillsSectionProps {
  stats: ProfileStatsViewModel
}

export default function ProfileSkillsSection({ stats }: ProfileSkillsSectionProps) {
  return (
    <section className="rounded-2xl border border-[#DDE3EE] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold tracking-tight text-[#0A1628]">Мой рейтинг</h3>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF4FE] text-[#1E88E5]">
          <MaterialSymbol name="military_tech" size={20} color="currentColor" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
        {stats.skills.map((skill) => {
          const normalized = Math.max(0, Math.min(5, skill.score))
          const percentage = (normalized / 5) * 100

          return (
            <div key={skill.key} className="group">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#4E6485] group-hover:text-[#1E88E5] transition-colors">{skill.label}</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-extrabold text-[#0A1628]">{normalized.toFixed(1)}</span>
                  <span className="text-[9px] font-bold text-[#8497B4]">/ 5.0</span>
                </div>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#EAF0F8]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1E88E5] to-[#2F6AD9] transition-all duration-700 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
