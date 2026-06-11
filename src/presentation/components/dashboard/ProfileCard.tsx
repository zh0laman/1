import CardShell from '../../../shared/ui/CardShell'
import GradientAvatar from '../../../shared/ui/GradientAvatar'

interface ProfileCardProps {
  userName: string
  avatarUrl?: string
  department: string
  stats: {
    tasks: number
    meetings: number
    documents: number
  }
}

export default function ProfileCard({ userName, avatarUrl, department, stats }: ProfileCardProps) {
  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'

  return (
    <CardShell className="relative overflow-hidden border-0 bg-linear-to-br from-[#1E3A8A] via-[#1E40AF] to-[#0A1628] p-6 text-white shadow-lg ring-1 ring-white/10">
      {/* Decorative gradient blur */}
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[#3B82F6]/30 blur-2xl" />

      <div className="relative z-10">
        <div className="mb-5 flex items-center gap-4">
          <div className="rounded-full bg-white p-1 shadow-md">
            <GradientAvatar initials={initials} src={avatarUrl} size={54} seed={0} />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-100">Добро пожаловать,</p>
            <h2 className="truncate text-xl font-extrabold tracking-tight text-white">{userName}</h2>
            <div className="mt-1.5 inline-flex items-center rounded-lg bg-white/10 px-2.5 py-1 backdrop-blur-md ring-1 ring-white/20">
              <span className="text-[11px] font-semibold text-blue-50">{department}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 py-3 backdrop-blur-sm transition-all hover:bg-white/20">
            <p className="text-xl font-extrabold leading-none text-white">{stats.tasks}</p>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">Задачи</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 py-3 backdrop-blur-sm transition-all hover:bg-white/20">
            <p className="text-xl font-extrabold leading-none text-white">{stats.meetings}</p>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">Встречи</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 py-3 backdrop-blur-sm transition-all hover:bg-white/20">
            <p className="text-xl font-extrabold leading-none text-white">{stats.documents}</p>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">Файлы</p>
          </div>
        </div>
      </div>
    </CardShell>
  )
}
