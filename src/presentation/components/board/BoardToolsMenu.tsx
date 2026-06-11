import { useRef, useEffect } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface BoardToolsMenuProps {
  open: boolean
  onClose: () => void
  onOpenMembers: () => void
  onOpenCreateBoard: () => void
  onOpenCreateColumn: () => void
  onOpenCreateSprint: () => void
  onOpenDeleteSprint: () => void
  onOpenBackground: () => void
  onOpenAlemAI: () => void
  onOpenLabels: () => void
  onOpenEditBoard: () => void
  onOpenDeleteBoard: () => void
  onOpenStats: () => void
  isOwner: boolean
  canModifyBoard: boolean
  canDeleteSprint: boolean
}

export default function BoardToolsMenu({
  open,
  onClose,
  onOpenMembers,
  onOpenCreateBoard,
  onOpenCreateColumn,
  onOpenCreateSprint,
  onOpenDeleteSprint,
  onOpenBackground,
  onOpenAlemAI,
  onOpenLabels,
  onOpenEditBoard,
  onOpenDeleteBoard,
  onOpenStats,
  isOwner,
  canModifyBoard,
  canDeleteSprint,
}: BoardToolsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="custom-scrollbar absolute right-0 top-full z-[520] mt-2 flex max-h-[min(60vh,520px)] w-60 origin-top-right flex-col overflow-y-auto overscroll-contain rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-[0_8px_30px_rgba(15,23,42,0.10)] animate-in fade-in zoom-in duration-150"
    >
      <MenuItem icon="group" label="Участники" onClick={() => { onOpenMembers(); onClose(); }} />
      <Divider />
      <MenuItem icon="analytics" label="Статистика" onClick={() => { onOpenStats(); onClose(); }} />
      <Divider />
      <MenuItem icon="add" label="Создать доску" onClick={() => { onOpenCreateBoard(); onClose(); }} />
      {canModifyBoard ? (
        <>
          <Divider />
          <MenuItem icon="add_circle" label="Создать колонку" onClick={() => { onOpenCreateColumn(); onClose(); }} />
          <Divider />
          <MenuItem icon="timer" label="Создать спринт" onClick={() => { onOpenCreateSprint(); onClose(); }} />
          <Divider />
          <MenuItem
            icon="error"
            label="Удалить выбранный спринт"
            onClick={() => { onOpenDeleteSprint(); onClose(); }}
            danger
            disabled={!canDeleteSprint}
          />
          <Divider />
          <MenuItem
            icon="auto_awesome"
            label="Создать с Alem AI"
            onClick={() => { onOpenAlemAI(); onClose(); }}
            accent="ai"
          />
          <Divider />
          <MenuItem icon="label" label="Метки" onClick={() => { onOpenLabels(); onClose(); }} />
        </>
      ) : null}
      {isOwner ? (
        <>
          <Divider />
          <MenuItem icon="image" label="Настройка фона" onClick={() => { onOpenBackground(); onClose(); }} />
          <Divider />
          <MenuItem icon="edit" label="Редактировать доску" onClick={() => { onOpenEditBoard(); onClose(); }} />
          <Divider />
          <MenuItem icon="delete" label="Удалить доску" onClick={() => { onOpenDeleteBoard(); onClose(); }} danger />
        </>
      ) : null}
    </div>
  )
}

type MenuItemAccent = 'default' | 'ai' | 'danger'

function MenuItem({
  icon,
  label,
  onClick,
  accent = 'default',
  danger = false,
  disabled = false,
}: {
  icon: string
  label: string
  onClick: () => void
  accent?: MenuItemAccent
  danger?: boolean
  disabled?: boolean
}) {
  const resolvedAccent: MenuItemAccent = danger ? 'danger' : accent

  const iconWrapClass = {
    default: 'bg-[#F3F4F6] text-[#4B5563]',
    ai: 'bg-[#EEF2FF] text-[#6366F1]',
    danger: 'bg-[#FEF2F2] text-[#DC2626]',
  }[resolvedAccent]

  const labelClass = {
    default: 'text-[#374151]',
    ai: 'text-[#4F46E5]',
    danger: 'text-[#DC2626]',
  }[resolvedAccent]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconWrapClass}`}
      >
        <MaterialSymbol name={icon} size={18} color="currentColor" />
      </span>
      <span className={`text-[13px] font-normal leading-snug ${labelClass}`}>{label}</span>
    </button>
  )
}

function Divider() {
  return <div className="mx-3 h-px bg-[#F3F4F6]" />
}
