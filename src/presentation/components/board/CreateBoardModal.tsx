interface CreateBoardModalProps {
  open: boolean
  value: string
  isSubmitting: boolean
  onClose: () => void
  onChange: (value: string) => void
  onSubmit: () => void
}

export default function CreateBoardModal({ open, value, isSubmitting, onClose, onChange, onSubmit }: CreateBoardModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#0A1628]/35 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#DDE3EE] bg-white p-5 shadow-[0_18px_60px_rgba(10,22,40,0.25)]">
        <h2 className="text-lg font-bold text-[#0A1628]">Создать доску</h2>
        <p className="mt-1 text-sm text-[#8497B4]">Укажите название новой kanban-доски.</p>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Например, Команда платформы"
          className="mt-4 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none transition focus:border-[#1E88E5]"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#DDE3EE] bg-white px-4 text-sm font-semibold text-[#374C6B] transition hover:bg-[#F9FAFB]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSubmitting || !value.trim()}
            onClick={onSubmit}
            className="h-10 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white transition hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
