import { useMemo, useState } from 'react'
import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { Avatar, Chip, priorityMeta, statusMeta } from './primitives'

interface TaskItem {
  id: string
  title: string
  priority: string
  due: string
  status: string
  assignee: string
  prog: number
}

interface TasksPanelProps {
  tasks?: TaskItem[]
  onCreate?: () => void
}

const filters = ['Все', 'К выполнению', 'В работе', 'На проверке', 'Готово'] as const

const normalizeStatus = (status: string): (typeof filters)[number] => {
  const value = status.trim().toLowerCase()
  if (value === 'в работе' || value === 'in progress' || value === 'in_progress' || value === 'doing') {
    return 'В работе'
  }
  if (value === 'в процессе проверки' || value === 'на проверке' || value === 'review') {
    return 'На проверке'
  }
  if (value === 'готово' || value === 'done' || value === 'completed' || value === 'завершено') {
    return 'Готово'
  }
  if (value === 'к выполнению' || value === 'todo' || value === 'to do' || value === 'new' || value === 'не начато') {
    return 'К выполнению'
  }
  return 'Все'
}

export default function TasksPanel({ tasks = [], onCreate }: TasksPanelProps) {
  const [filter, setFilter] = useState<(typeof filters)[number]>('Все')
  const visibleTasks = useMemo(
    () => (filter === 'Все' ? tasks : tasks.filter((task) => normalizeStatus(task.status) === filter)),
    [filter, tasks],
  )
  const seeds: Record<string, number> = { АС: 0, МБ: 1, ДН: 2, АИ: 3 }

  return (
    <CardShell className="overflow-hidden border-0 bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-[#0A1628]">Мои задачи</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-[#64748B]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            {tasks.length} активных задач
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={[
                'rounded-lg ring-1 px-3.5 py-1.5 text-[13px] font-bold transition-all',
                filter === item
                  ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
                  : 'bg-white text-slate-600 ring-black/5 hover:bg-slate-50',
              ].join(' ')}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 py-1.5 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#1565C0] hover:shadow"
          >
            <MaterialSymbol name="add" size={16} color="#fff" />
            Создать
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-[#F8FAFC]">
            <tr>
              {['Задача', 'Приоритет', 'Срок', 'Статус', 'Прогресс'].map((head) => (
                <th key={head} className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map((task) => {
              const priority = priorityMeta(task.priority)
              const status = statusMeta(task.status)
              return (
                <tr key={task.id} className="border-t border-black/3 transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex min-w-[280px] items-center gap-3.5">
                      <Avatar initials={task.assignee} size={28} seed={seeds[task.assignee] ?? 0} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#0A1628] group-hover:text-blue-600">{task.title}</p>
                        <p className="mt-0.5 text-xs text-[#94A3B8]">Исполнитель: {task.assignee}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Chip label={task.priority} color={priority.color} bg={priority.bg} />
                  </td>
                  <td className="px-6 py-4 text-[13px] font-medium text-[#475569]">{task.due}</td>
                  <td className="px-6 py-4">
                    <Chip label={task.status} color={status.color} bg={status.bg} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-28">
                      <div className="mb-1 flex justify-between text-xs text-[#8497B4]">
                        <span>{task.prog}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EAEFF8]">
                        <div
                          className="h-full rounded-full bg-[#1E88E5]"
                          style={{ width: `${Math.min(100, Math.max(0, task.prog))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-[#8497B4]">Задач по выбранному фильтру нет</div>
      ) : null}
    </CardShell>
  )
}
