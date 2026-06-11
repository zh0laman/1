import { useMemo, useState } from 'react'
import type {
  BoardLabelViewModel,
} from '../../view-models/BoardViewModel'
import type { BoardTask } from '../../../domain/entities/board/BoardModels'
import AppSelect from '../../../shared/ui/AppSelect'
import BoardBackgroundSection, { type BackgroundPresetViewModel } from './advanced/BoardBackgroundSection'
import BoardLabelsSection from './advanced/BoardLabelsSection'

interface QuickActionTaskOption {
  id: string
  title: string
  columnName: string
}

interface BoardAdvancedPanelProps {
  selectedTask: BoardTask | null
  quickActionTasks: QuickActionTaskOption[]
  labels: BoardLabelViewModel[]
  backgroundMode: string
  backgroundPresetId: string
  backgroundPresetHex: string
  backgroundImageUrl: string
  canManageBackground: boolean
  isBackgroundLoading: boolean
  isLabelsLoading: boolean
  isCommentsLoading: boolean
  activeSection?: 'all' | 'background' | 'labels'
  onBackgroundPreset: (presetId: string) => Promise<void>
  onBackgroundUpload: (file: File) => Promise<void>
  onBackgroundDelete: () => Promise<void>
  onRestoreBackgroundPreset: () => Promise<void>
  onCreateLabel: (payload: { name: string; color: string }) => Promise<void>
  onDeleteLabel: (labelId: string) => Promise<void>
  onAddTaskLabel: (labelId: string) => Promise<void>
  onRemoveTaskLabel: (labelId: string) => Promise<void>
  onUpdateTaskStatus: (taskId: string, status: string) => Promise<void>
  onUploadAndAttachFile: (taskId: string, file: File) => Promise<void>
}

const PRESETS: BackgroundPresetViewModel[] = [
  { id: 'preset_default', name: 'Стандарт', preview: 'linear-gradient(135deg,#F8F9FB 0%, #EEF2F7 100%)' },
  { id: 'preset_mint', name: 'Мята', preview: 'linear-gradient(135deg,#F2FBF6 0%, #E1F3EA 100%)' },
  { id: 'preset_sand', name: 'Песок', preview: 'linear-gradient(135deg,#FFF7EE 0%, #FCE8D2 100%)' },
  { id: 'preset_sky', name: 'Небо', preview: 'linear-gradient(135deg,#F0F6FF 0%, #DDEBFF 100%)' },
]

const TASK_STATUS_OPTIONS = [
  { value: '', label: 'Выберите статус' },
  { value: 'К ВЫПОЛНЕНИЮ', label: 'К выполнению' },
  { value: 'В РАБОТЕ', label: 'В работе' },
  { value: 'В ПРОЦЕССЕ ПРОВЕРКИ', label: 'На проверке' },
  { value: 'ГОТОВО', label: 'Готово' },
]

export default function BoardAdvancedPanel({
  selectedTask,
  quickActionTasks,
  labels,
  backgroundMode,
  backgroundPresetId,
  backgroundPresetHex,
  backgroundImageUrl,
  canManageBackground,
  isBackgroundLoading,
  isLabelsLoading,
  isCommentsLoading,
  activeSection = 'all',
  onBackgroundPreset,
  onBackgroundUpload,
  onBackgroundDelete,
  onRestoreBackgroundPreset,
  onCreateLabel,
  onDeleteLabel,
  onAddTaskLabel,
  onRemoveTaskLabel,
  onUpdateTaskStatus,
  onUploadAndAttachFile,
}: BoardAdvancedPanelProps) {
  const [taskStatus, setTaskStatus] = useState('')
  const [quickActionTaskId, setQuickActionTaskId] = useState('')

  const selectedTaskLabelIds = useMemo(() => selectedTask?.labels?.map((item) => item.id) ?? [], [selectedTask?.labels])

  const quickTaskOptions = useMemo(
    () => quickActionTasks.map((task) => ({ value: task.id, label: `${task.title} · ${task.columnName}` })),
    [quickActionTasks],
  )

  const effectiveQuickTaskId = quickActionTaskId || selectedTask?.id || ''
  const currentBackgroundLabel = useMemo(() => {
    const mode = (backgroundMode || '').toLowerCase()
    const isPresetMode = mode.includes('preset') || mode.includes('color')
    const isImageMode = mode.includes('image')

    if (isImageMode) {
      return 'Изображение'
    }

    const fromPreset = PRESETS.find((item) => item.id === backgroundPresetId)
    if (fromPreset) return fromPreset.name

    if (isPresetMode && backgroundPresetHex) {
      return `Цвет ${backgroundPresetHex}`
    }

    if (!isPresetMode && !isImageMode && backgroundImageUrl) {
      return 'Изображение'
    }

    return 'Стандартный'
  }, [backgroundImageUrl, backgroundMode, backgroundPresetHex, backgroundPresetId])

  return (
    <section className="space-y-4 p-0">
      {activeSection === 'all' && (
        <div className="rounded-2xl border border-[#E2EAF5] bg-white p-4">
          <h4 className="text-base font-bold text-[#0A1628]">Быстрые действия по задаче</h4>
          <p className="mt-1 text-xs text-[#7186A7]">Сначала выберите задачу, затем обновите статус или прикрепите файл без открытия карточки.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AppSelect
              value={effectiveQuickTaskId}
              options={quickTaskOptions}
              onChange={setQuickActionTaskId}
              className="w-full max-w-[420px]"
              placeholder="Выберите задачу"
              ariaLabel="Задача для быстрых действий"
              searchable
              searchPlaceholder="Поиск задачи"
            />
            <AppSelect
              value={taskStatus}
              options={TASK_STATUS_OPTIONS}
              onChange={setTaskStatus}
              className="w-full max-w-[280px]"
              ariaLabel="Статус задачи"
            />
            <button
              type="button"
              disabled={!effectiveQuickTaskId || !taskStatus || isCommentsLoading}
              onClick={() => {
                if (!effectiveQuickTaskId) return
                void onUpdateTaskStatus(effectiveQuickTaskId, taskStatus)
              }}
              className="h-10 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white transition hover:bg-[#1976D2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Обновить статус
            </button>
            <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-[#DDE3EE] bg-white px-3 text-sm font-semibold text-[#334E73] transition hover:bg-[#F9FAFB]">
              Загрузить и прикрепить файл
              <input
                type="file"
                className="hidden"
                disabled={!effectiveQuickTaskId || isCommentsLoading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file && effectiveQuickTaskId) {
                    void onUploadAndAttachFile(effectiveQuickTaskId, file)
                    event.target.value = ''
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${(activeSection === 'all' && canManageBackground) ? 'xl:grid-cols-2' : ''}`}>
        {(activeSection === 'all' || activeSection === 'background') && canManageBackground ? (
          <BoardBackgroundSection
            presets={PRESETS}
            activePresetId={backgroundPresetId}
            currentBackgroundLabel={currentBackgroundLabel}
            isImageBackground={(backgroundMode || '').toLowerCase().includes('image')}
            isLoading={isBackgroundLoading}
            onPresetSelect={onBackgroundPreset}
            onUploadImage={onBackgroundUpload}
            onDeleteBackground={onBackgroundDelete}
            onRestorePreset={onRestoreBackgroundPreset}
          />
        ) : null}

        {(activeSection === 'all' || activeSection === 'labels') && (
          <BoardLabelsSection
            labels={labels}
            selectedTaskLabelIds={selectedTaskLabelIds}
            isLoading={isLabelsLoading}
            onCreateLabel={onCreateLabel}
            onDeleteLabel={onDeleteLabel}
            onAddTaskLabel={onAddTaskLabel}
            onRemoveTaskLabel={onRemoveTaskLabel}
          />
        )}
      </div>
    </section>
  )
}
