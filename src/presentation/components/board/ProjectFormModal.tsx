import type { BoardGoalViewModel } from '../../view-models/BoardViewModel'

export interface ProjectFormValue {
  name: string
  description: string
  goalId: string
  status: string
}

interface ProjectFormModalProps {
  open: boolean
  title: string
  confirmText: string
  value: ProjectFormValue
  goals: BoardGoalViewModel[]
  isSubmitting: boolean
  onChange: (next: ProjectFormValue) => void
  onClose: () => void
  onSubmit: () => void
}

export default function ProjectFormModal({
  open,
  title,
  confirmText,
  value,
  goals,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#0A1628]/35 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#DDE3EE] bg-white p-5 shadow-[0_18px_60px_rgba(10,22,40,0.25)]">
        <h2 className="text-lg font-bold text-[#0A1628]">{title}</h2>
        <div className="mt-4 flex flex-col gap-3">
          <label>
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
              onChange={(event) => onChange({ ...value, goalId: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            >
              <option value="">Без цели</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
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
              <option value="active">Активный</option>
              <option value="planned">Запланирован</option>
              <option value="paused">Приостановлен</option>
              <option value="done">Завершен</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-[#8497B4]">Описание</span>
            <textarea
              rows={4}
              value={value.description}
              onChange={(event) => onChange({ ...value, description: event.target.value })}
              className="mt-1 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] p-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
            />
          </label>
        </div>

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
            disabled={isSubmitting || !value.name.trim()}
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
