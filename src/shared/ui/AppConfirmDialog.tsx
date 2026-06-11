import MaterialSymbol from './MaterialSymbol'

interface AppConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function AppConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  isLoading = false,
  onConfirm,
  onCancel,
}: AppConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#0A1628]/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#DDE3EE] bg-white p-5 shadow-[0_18px_60px_rgba(10,22,40,0.25)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF6F6]">
            <MaterialSymbol name="warning" size={18} color="#C53030" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#0A1628]">{title}</h3>
            <p className="mt-1 break-words text-sm text-[#6B7280] [overflow-wrap:anywhere]">
              {message}
            </p>
          </div>
        </div>

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
            disabled={isLoading}
            className="h-10 rounded-xl bg-[#C53030] px-4 text-sm font-semibold text-white hover:bg-[#A91E1E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Выполняется...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
