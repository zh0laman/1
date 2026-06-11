import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface BoardHeaderProps {
  boardName: string
  totalTasks: number
  boardsCount: number
  isRefreshing: boolean
  onRefresh: () => void
}

export default function BoardHeader({
  boardName,
  totalTasks,
  boardsCount,
  isRefreshing,
  onRefresh,
}: BoardHeaderProps) {
  return (
    <header className="rounded-2xl border border-[#DDE3EE] bg-white p-4 shadow-[0_1px_2px_rgba(10,22,40,0.04)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8497B4]">Доска</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[#0A1628]">{boardName || 'Kanban Board'}</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Досок: {boardsCount} · Задач: {totalTasks}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white transition hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialSymbol name="refresh" size={15} color="currentColor" />
            {isRefreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
      </div>
    </header>
  )
}
