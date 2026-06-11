import type { BoardGoalViewModel, BoardProjectViewModel } from '../../view-models/BoardViewModel'

function isValidDateString(str: string): boolean {
  if (!str) return true
  const parts = str.split('-')
  if (parts.length !== 3) return false

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
}

function parseLocalDate(str: string): Date {
  const parts = str.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  return new Date(year, month - 1, day)
}

export interface SprintFormValue {
  name: string
  goalId: string
  projectId: string
  status: string
  startDate: string
  endDate: string
}

interface CreateSprintModalProps {
  open: boolean
  value: SprintFormValue
  goals: BoardGoalViewModel[]
  projects: BoardProjectViewModel[]
  title?: string
  confirmText?: string
  isSubmitting: boolean
  onClose: () => void
  onChange: (next: SprintFormValue) => void
  onSubmit: () => void
}

export default function CreateSprintModal({
  open,
  value,
  goals,
  projects,
  title = 'Создать спринт',
  confirmText = 'Создать',
  isSubmitting,
  onClose,
  onChange,
  onSubmit,
}: CreateSprintModalProps) {
  if (!open) return null

  const startInvalid = value.startDate ? !isValidDateString(value.startDate) : false
  const endInvalid = value.endDate ? !isValidDateString(value.endDate) : false

  let dateErrorMessage = ''
  if (startInvalid || endInvalid) {
    dateErrorMessage = 'Указана некорректная дата'
  } else if (value.startDate && value.endDate) {
    const start = parseLocalDate(value.startDate)
    const end = parseLocalDate(value.endDate)
    if (start.getTime() > end.getTime()) {
      dateErrorMessage = 'Дата завершения не может быть раньше даты начала'
    }
  }

  const filteredProjects = value.goalId
    ? projects.filter((project) => project.goalId === value.goalId)
    : projects

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#0A1628]/35 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#DDE3EE] bg-white p-5 shadow-[0_18px_60px_rgba(10,22,40,0.25)]">
        <h2 className="text-lg font-bold text-[#0A1628]">{title}</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-[#8497B4]">Название</span>
            <input
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-[#8497B4]">Цель</span>
            <select
              value={value.goalId}
              onChange={(event) => {
                const nextGoalId = event.target.value
                const nextProjectId = value.projectId && projects.some((project) => project.id === value.projectId && project.goalId === nextGoalId)
                  ? value.projectId
                  : ''
                onChange({ ...value, goalId: nextGoalId, projectId: nextProjectId })
              }}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            >
              <option value="">Без цели</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-[#8497B4]">Проект</span>
            <select
              value={value.projectId}
              onChange={(event) => {
                const nextProjectId = event.target.value
                const relatedProject = projects.find((project) => project.id === nextProjectId)
                onChange({
                  ...value,
                  projectId: nextProjectId,
                  goalId: relatedProject?.goalId ?? value.goalId,
                })
              }}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            >
              <option value="">Без проекта</option>
              {filteredProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-[#8497B4]">Статус</span>
            <select
              value={value.status}
              onChange={(event) => onChange({ ...value, status: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            >
              <option value="planned">Запланирован</option>
              <option value="active">Активен</option>
              <option value="closed">Завершен</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-[#8497B4]">Дата начала</span>
            <input
              type="date"
              value={value.startDate}
              onChange={(event) => onChange({ ...value, startDate: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-[#8497B4]">Дата завершения</span>
            <input
              type="date"
              value={value.endDate}
              onChange={(event) => onChange({ ...value, endDate: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            />
          </label>
        </div>

        {dateErrorMessage ? (
          <div className="mt-3 text-xs font-semibold text-[#E53935]">{dateErrorMessage}</div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#DDE3EE] bg-white px-4 text-sm font-semibold text-[#374C6B] hover:bg-[#F9FAFB]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSubmitting || !value.name.trim() || !!dateErrorMessage}
            onClick={onSubmit}
            className="h-10 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Сохранение...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
