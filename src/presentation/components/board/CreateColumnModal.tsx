import AppSelect from '../../../shared/ui/AppSelect'

interface CreateColumnModalProps {
  open: boolean
  mode: 'create' | 'rename'
  name: string
  statusKey: string
  isSubmitting: boolean
  onClose: () => void
  onNameChange: (value: string) => void
  onStatusChange: (value: string) => void
  onSubmit: () => void
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'К выполнению' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'TEST', label: 'На проверке' },
  { value: 'DONE', label: 'Готово' },
]

export default function CreateColumnModal({ 
  open, 
  mode,
  name, 
  statusKey,
  isSubmitting, 
  onClose, 
  onNameChange, 
  onStatusChange,
  onSubmit 
}: CreateColumnModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#0A1628]/35 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#DDE3EE] bg-white p-6 shadow-[0_18px_60px_rgba(10,22,40,0.25)]">
        <h2 className="text-lg font-bold text-[#0A1628]">
          {mode === 'create' ? 'Новая колонка' : 'Редактировать колонку'}
        </h2>
        <p className="mt-1 text-sm text-[#8497B4]">
          {mode === 'create' 
            ? 'Добавьте новую колонку и привяжите её к системному статусу.' 
            : 'Измените название или привязку к системному статусу.'}
        </p>
        
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-[#8497B4]">Название</span>
            <input
              value={name}
              autoFocus
              maxLength={50}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Например, Дизайн"
              className="mt-1 h-11 w-full rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] outline-none transition focus:border-[#1E88E5]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[#8497B4]">Привязка к статусу</span>
            <div className="mt-1">
              <AppSelect
                value={statusKey}
                options={STATUS_OPTIONS}
                onChange={onStatusChange}
                ariaLabel="Системный статус"
                showButtonAvatar={false}
                showOptionAvatar={false}
              />
            </div>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#DDE3EE] bg-white px-5 text-sm font-semibold text-[#374C6B] transition hover:bg-[#F9FAFB]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSubmitting || !name.trim()}
            onClick={onSubmit}
            className="h-10 rounded-xl bg-[#1E88E5] px-5 text-sm font-semibold text-white transition hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
