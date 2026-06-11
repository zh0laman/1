export interface GoalFormValue {
  name: string
  description: string
}

interface GoalFormModalProps {
  open: boolean
  title: string
  confirmText: string
  value: GoalFormValue
  isSubmitting: boolean
  onChange: (next: GoalFormValue) => void
  onClose: () => void
  onSubmit: () => void
}

export default function GoalFormModal({
  open,
  title,
  confirmText,
  value,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: GoalFormModalProps) {
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
