interface AppPromptDialogProps {
  open: boolean
  title: string
  label: string
  value: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function AppPromptDialog({
  open,
  title,
  label,
  value,
  placeholder,
  confirmText = 'Сохранить',
  cancelText = 'Отмена',
  isLoading = false,
  onChange,
  onConfirm,
  onCancel,
}: AppPromptDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#0A1628]/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#DDE3EE] bg-white p-5 shadow-[0_18px_60px_rgba(10,22,40,0.25)]">
        <h3 className="text-base font-bold text-[#0A1628]">{title}</h3>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-[#8497B4]">{label}</span>
          <input
            value={value}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none focus:border-[#1E88E5]"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="h-10 rounded-xl border border-[#DDE3EE] bg-white px-4 text-sm font-semibold text-[#374C6B] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !value.trim()}
            className="h-10 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Сохранение...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
