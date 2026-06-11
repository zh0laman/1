import { useState } from 'react'
import AppSelect from '../../../../shared/ui/AppSelect'
import type { BoardLabelViewModel, BoardTaskViewModel, BoardUserViewModel } from '../../../view-models/BoardViewModel'

interface BoardSearchSectionProps {
  users: BoardUserViewModel[]
  labels: BoardLabelViewModel[]
  columnKeyOptions: Array<{ key: string; name: string }>
  myTodoTasks: BoardTaskViewModel[]
  searchResults: BoardTaskViewModel[]
  isLoading: boolean
  onLoadMyTodo: () => Promise<void>
  onSearchTasks: (payload: {
    q?: string
    priorities?: string[]
    assigneeIds?: number[]
    columnKeys?: string[]
    labelIds?: string[]
    dateFrom?: string
    dateTo?: string
  }) => Promise<void>
}

const toStartOfDayUtcIso = (dateValue: string): string => {
  if (!dateValue) return ''
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString()
}

const toEndOfDayUtcIso = (dateValue: string): string => {
  if (!dateValue) return ''
  return new Date(`${dateValue}T23:59:59.999Z`).toISOString()
}

export default function BoardSearchSection({
  users,
  labels,
  columnKeyOptions,
  myTodoTasks,
  searchResults,
  isLoading,
  onLoadMyTodo,
  onSearchTasks,
}: BoardSearchSectionProps) {
  const [searchText, setSearchText] = useState('')
  const [priority, setPriority] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [labelId, setLabelId] = useState('')
  const [columnKey, setColumnKey] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  return (
    <section className="rounded-2xl border border-[#E2EAF5] bg-white p-4">
      <h4 className="text-base font-bold text-[#0A1628]">Быстрый поиск задач</h4>
      <p className="mt-1 text-xs text-[#7186A7]">Найдите задачи по тексту, приоритету, исполнителю, метке, колонке и диапазону дат.</p>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-7">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void onLoadMyTodo()
          }}
          className="h-10 rounded-xl border border-[#DDE3EE] bg-white px-3 text-sm font-semibold text-[#334E73] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Загрузить мои задачи
        </button>

        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Название или описание"
          className="h-10 rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
        />

        <AppSelect
          value={priority}
          options={[
            { value: '', label: 'Любой приоритет' },
            { value: 'low', label: 'Низкий' },
            { value: 'medium', label: 'Средний' },
            { value: 'high', label: 'Высокий' },
            { value: 'critical', label: 'Критичный' },
          ]}
          onChange={setPriority}
          ariaLabel="Фильтр по приоритету"
        />

        <AppSelect
          value={assigneeId}
          options={[{ value: '', label: 'Любой исполнитель' }, ...users.map((item) => ({ value: String(item.id), label: item.fullName }))]}
          onChange={setAssigneeId}
          ariaLabel="Фильтр по исполнителю"
        />

        <AppSelect
          value={labelId}
          options={[{ value: '', label: 'Любая метка' }, ...labels.map((item) => ({ value: item.id, label: item.name }))]}
          onChange={setLabelId}
          ariaLabel="Фильтр по метке"
        />

        <AppSelect
          value={columnKey}
          options={[
            { value: '', label: 'Любая колонка' },
            ...columnKeyOptions.map((item) => ({ value: item.key, label: `${item.name} (${item.key})` })),
          ]}
          onChange={setColumnKey}
          ariaLabel="Фильтр по колонке"
        />

        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void onSearchTasks({
              q: searchText.trim() || undefined,
              priorities: priority ? [priority] : undefined,
              assigneeIds: assigneeId ? [Number(assigneeId)] : undefined,
              columnKeys: columnKey ? [columnKey] : undefined,
              labelIds: labelId ? [labelId] : undefined,
              dateFrom: dateFrom ? toStartOfDayUtcIso(dateFrom) : undefined,
              dateTo: dateTo ? toEndOfDayUtcIso(dateTo) : undefined,
            })
          }}
          className="h-10 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white transition hover:bg-[#1976D2] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Найти
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="h-10 rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="h-10 rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
        />
      </div>

      <div className="mt-3 rounded-xl border border-[#EEF3FB] bg-[#F9FCFF] p-3 text-sm text-[#486284]">
        TODO: <span className="font-semibold text-[#0A1628]">{myTodoTasks.length}</span> · Найдено: <span className="font-semibold text-[#0A1628]">{searchResults.length}</span>
      </div>

      {!isLoading && searchResults.length === 0 ? (
        <p className="mt-2 text-xs text-[#8CA1C0]">Ничего не найдено по фильтрам.</p>
      ) : null}
    </section>
  )
}
