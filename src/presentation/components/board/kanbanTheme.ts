export const KANBAN_PAGE_BG = '#F8F9FA'
export const KANBAN_COLUMN_BG = '#F1F3F5'
export const KANBAN_ACCENT_BUTTON = '#1A1C23'
export const KANBAN_ACCENT_BUTTON_HOVER = '#0F1117'

/** Типографика Kanban — лёгкие веса, как в референсе */
export const KANBAN_TYPO = {
  columnTitle: 'text-[15px] font-semibold tracking-tight text-[#374151]',
  columnCount: 'text-[13px] font-normal tabular-nums text-[#9CA3AF]',
  cardLabel: 'text-[11px] font-medium leading-none',
  cardTitle: 'text-[15px] font-medium leading-[1.4] text-[#1F2937]',
  cardMeta: 'text-[11px] font-normal text-[#9CA3AF]',
  addTaskLink: 'text-[13px] font-normal text-[#9CA3AF]',
  toolbarBtn: 'text-[13px] font-normal text-[#4B5563]',
  toolbarPrimary: 'text-[13px] font-medium text-white',
} as const

export type TaskCardAccent = {
  label: string
  color: string
}

const PRIORITY_ACCENT: Record<string, TaskCardAccent> = {
  low: { label: 'Низкий', color: '#14B8A6' },
  medium: { label: 'Средний', color: '#F59E0B' },
  high: { label: 'Высокий', color: '#EF4444' },
  critical: { label: 'Критичный', color: '#DC2626' },
}

export function getTaskCardAccent(
  labels: Array<{ name: string; color: string }> | undefined,
  priority: string,
): TaskCardAccent {
  const first = labels?.[0]
  if (first?.name?.trim()) {
    return {
      label: first.name.trim(),
      color: first.color?.trim() || '#6B7280',
    }
  }
  return PRIORITY_ACCENT[priority] ?? PRIORITY_ACCENT.medium
}

/** @deprecated */
export function getPriorityStyle(priority: string) {
  const accent = PRIORITY_ACCENT[priority] ?? PRIORITY_ACCENT.medium
  return { label: accent.label, color: accent.color }
}

/** Короткая дата для шапки карточки: «14 мая» */
export function formatShortDueDate(dueAt: string, dueAtLabel: string): string | null {
  if (!dueAt?.trim() || dueAtLabel === 'Без срока') return null
  const date = new Date(dueAt)
  if (Number.isNaN(date.valueOf())) return null
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}

export function formatFooterDueLabel(dueAtLabel: string): string {
  return dueAtLabel?.trim() || 'Без срока'
}

/** Стили полей модалки создания/редактирования задачи */
export const TASK_FORM = {
  label: 'mb-1.5 block text-xs font-medium text-[#90A4AE]',
  input:
    'h-11 w-full rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm text-[#263238] outline-none transition placeholder:text-[#B0BEC5] focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20',
  textarea:
    'w-full resize-y rounded-lg border border-[#E0E0E0] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#263238] outline-none transition placeholder:text-[#B0BEC5] focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20',
  selectBtn:
    '!h-11 !rounded-lg !border-[#E0E0E0] !bg-white !px-3 !text-sm !font-normal !text-[#263238] hover:!border-[#CFD8DC] focus:!ring-2 focus:!ring-[#9CA3AF]/20',
  selectMenu: '!rounded-xl !border-[#ECEFF1] !shadow-[0_8px_24px_rgba(15,23,42,0.12)]',
} as const
