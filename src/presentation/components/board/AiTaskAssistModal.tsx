import type { TzAiTaskAssistResponse } from '../../../domain/entities/AiTools'
import type { BoardSprintViewModel, BoardUserViewModel } from '../../view-models/BoardViewModel'
import type { BoardTask } from '../../../domain/entities/board/BoardModels'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface AiTaskAssistModalProps {
  open: boolean
  onClose: () => void
  onApply: () => void
  original: {
    title: string
    description: string
    priority: BoardTask['priority']
    sprintId: string
    assigneeIds: number[]
    dueAt: string
  }
  suggested: TzAiTaskAssistResponse
  users: BoardUserViewModel[]
  sprints: BoardSprintViewModel[]
}

export default function AiTaskAssistModal({
  open,
  onClose,
  onApply,
  original,
  suggested,
  users,
  sprints,
}: AiTaskAssistModalProps) {
  if (!open) return null

  const getPriorityLabel = (p: string | undefined | null) => {
    switch (p) {
      case 'low': return 'Низкий'
      case 'medium': return 'Средний'
      case 'high': return 'Высокий'
      case 'critical': return 'Критичный'
      default: return p || 'Не указан'
    }
  }

  const getSprintName = (id: string | undefined | null) => sprints.find((s) => s.id === id)?.name || 'Без спринта'
  const getUserNames = (ids: number[]) => ids.map((id) => users.find((u) => u.id === id)?.fullName).filter(Boolean).join(', ') || 'Не назначен'
  const formatDueAt = (date: string | undefined | null) => date ? new Date(date).toLocaleDateString('ru-RU') : 'Не указан'

  const sug = suggested.ai_suggestion

  const DiffRow = ({ label, oldVal, newVal, changed }: { label: string; oldVal: string; newVal: string; changed: boolean }) => (
    <div className={`grid grid-cols-2 gap-4 border-b border-[#F1F4F9] py-3 last:border-0 ${changed ? 'bg-[#F0F9FF]/30' : ''}`}>
      <div className="flex flex-col gap-1 pr-2 border-r border-[#F1F4F9]">
        <span className="text-[10px] font-bold uppercase text-[#8497B4] tracking-wider">{label} (Текущее)</span>
        <div className="text-sm text-[#4D6486] line-clamp-4 overflow-hidden whitespace-pre-wrap">{oldVal}</div>
      </div>
      <div className="flex flex-col gap-1 pl-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${changed ? 'text-[#0284C7]' : 'text-[#8497B4]'}`}>
          {label} {changed ? '(ИИ предлагает)' : '(Без изменений)'}
        </span>
        <div className={`text-sm whitespace-pre-wrap ${changed ? 'font-semibold text-[#0369A1]' : 'text-[#4D6486]'}`}>
          {newVal}
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-[#0A1628]/45 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-[#DDE3EE] bg-white shadow-[0_24px_80px_rgba(10,22,40,0.3)] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#F1F4F9] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-lg shadow-[#0284C7]/20">
              <MaterialSymbol name="auto_awesome" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0A1628]">Предложения ИИ</h2>
              <p className="text-xs text-[#8497B4]">Сравните оригинальную версию с улучшениями от ИИ</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[#8497B4] hover:bg-[#F9FBFE] hover:text-[#0A1628] transition">
            <MaterialSymbol name="close" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-1">
            <DiffRow 
              label="Название" 
              oldVal={original.title} 
              newVal={suggested.suggested_title || original.title} 
              changed={!!suggested.suggested_title && suggested.suggested_title !== original.title} 
            />
            <DiffRow 
              label="Описание" 
              oldVal={original.description || '(Пусто)'} 
              newVal={suggested.description} 
              changed={suggested.description !== original.description} 
            />
            <DiffRow 
              label="Приоритет" 
              oldVal={getPriorityLabel(original.priority)} 
              newVal={getPriorityLabel(sug?.priority || original.priority)} 
              changed={!!sug?.priority && sug.priority !== original.priority} 
            />
            <DiffRow 
              label="Спринт" 
              oldVal={getSprintName(original.sprintId)} 
              newVal={getSprintName(sug?.sprint_id || original.sprintId)} 
              changed={!!sug?.sprint_id && sug.sprint_id !== original.sprintId} 
            />
            <DiffRow 
              label="Исполнитель" 
              oldVal={getUserNames(original.assigneeIds)} 
              newVal={sug?.assignee_id ? (users.find(u => u.id === sug.assignee_id)?.fullName || 'Предложен') : getUserNames(original.assigneeIds)} 
              changed={!!sug?.assignee_id && !original.assigneeIds.includes(sug.assignee_id)} 
            />
            <DiffRow 
              label="Срок" 
              oldVal={formatDueAt(original.dueAt)} 
              newVal={formatDueAt(sug?.due_at || original.dueAt)} 
              changed={!!sug?.due_at && sug.due_at !== original.dueAt} 
            />
            {suggested.confirmation_message && (
              <div className="mt-4 rounded-xl bg-[#F0F9FF] p-4 border border-[#BAE6FD]">
                <div className="flex gap-2 items-start text-[#0369A1]">
                  <MaterialSymbol name="info" size={18} />
                  <div className="flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider mb-1">Рекомендация ИИ</div>
                    <div className="text-sm leading-relaxed">{suggested.confirmation_message}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#F1F4F9] bg-[#F9FBFE] px-6 py-4 rounded-b-2xl">
          <button
            onClick={onClose}
            className="h-11 px-6 rounded-xl border border-[#DDE3EE] bg-white text-sm font-bold text-[#4D6486] hover:bg-[#F1F4F9] transition shadow-sm"
          >
            Оставить как есть
          </button>
          <button
            onClick={onApply}
            className="h-11 px-8 rounded-xl bg-[#0284C7] text-sm font-bold text-white hover:bg-[#0369A1] transition shadow-lg shadow-[#0284C7]/20"
          >
            Применить изменения
          </button>
        </div>
      </div>
    </div>
  )
}
