import type { BoardSprintViewModel, BoardUserViewModel, BoardLabelViewModel, BoardTaskViewModel, BoardGoalViewModel, BoardProjectViewModel } from '../../view-models/BoardViewModel'
import type { BoardTask } from '../../../domain/entities/board/BoardModels'
import type { KanbanAssigneeAdviceResponse } from '../../../domain/entities/AiTools'
import { useEffect, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react'
import AppSelect from '../../../shared/ui/AppSelect'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import TaskDescriptionMarkdown from './TaskDescriptionMarkdown'
import { getPriorityStyle, TASK_FORM } from './kanbanTheme'

const COMPACT_LABEL = 'mb-1 block text-[11px] font-medium text-[#90A4AE]'
const COMPACT_INPUT =
  'h-9 w-full rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm text-[#263238] outline-none transition placeholder:text-[#B0BEC5] focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20'
const COMPACT_SELECT = `${TASK_FORM.selectBtn} !h-9 !text-sm`
const DESCRIPTION_SCROLL =
  'min-h-[88px] max-h-[120px] resize-none overflow-y-auto [scrollbar-color:#C8D5E8_transparent] [scrollbar-width:thin]'

interface CreateTaskModalProps {
  open: boolean
  users: BoardUserViewModel[]
  sprints: BoardSprintViewModel[]
  goals: BoardGoalViewModel[]
  projects: BoardProjectViewModel[]
  allLabels: BoardLabelViewModel[]
  availableParentTasks: BoardTaskViewModel[]
  isSubmitting: boolean
  value: {
    title: string
    description: string
    priority: BoardTask['priority']
    sprintId: string
    goalId: string
    projectId: string
    dueAt: string
    assigneeIds: number[]
    labelIds: string[]
    parentId: string
    attachmentFileIds: string[]
  }
  uploadedAttachments: { id: string; fileName: string }[]
  onClose: () => void
  onChange: (next: CreateTaskModalProps['value']) => void
  onUpload: (file: File) => Promise<void>
  onRemoveAttachment: (id: string) => void
  onSubmit: () => void
  onCreateBoardLabel: (payload: { name: string; color: string }) => Promise<void>
  onAiAssist?: () => Promise<void>
  isAiProcessing?: boolean
  onAnalyzeAssigneeWorkload?: (payload: {
    title: string
    description: string
    userId: number
    teamRole: string
  }) => Promise<KanbanAssigneeAdviceResponse>
}

export default function CreateTaskModal({
  open,
  users,
  sprints,
  goals,
  projects,
  allLabels,
  availableParentTasks,
  isSubmitting,
  value,
  uploadedAttachments,
  onClose,
  onChange,
  onUpload,
  onRemoveAttachment,
  onSubmit,
  onCreateBoardLabel,
  onAiAssist,
  isAiProcessing,
  onAnalyzeAssigneeWorkload,
}: CreateTaskModalProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showNewLabelForm, setShowNewLabelForm] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#42A5F5')
  const [descriptionTab, setDescriptionTab] = useState<'edit' | 'preview'>('edit')
  const [assigneeAdvice, setAssigneeAdvice] = useState<KanbanAssigneeAdviceResponse | null>(null)
  const [assigneeAdviceError, setAssigneeAdviceError] = useState('')
  const [isAssigneeAdviceLoading, setIsAssigneeAdviceLoading] = useState(false)

  const filteredProjects = value.goalId
    ? projects.filter((p) => p.goalId === value.goalId)
    : projects

  const handleGoalChangeForTask = (goalId: string) => {
    let nextProjectId = value.projectId
    if (goalId) {
      const selectedProj = projects.find((p) => p.id === value.projectId)
      if (selectedProj && selectedProj.goalId !== goalId) {
        nextProjectId = ''
      }
    }
    onChange({ ...value, goalId, projectId: nextProjectId })
  }

  const handleProjectChangeForTask = (projectId: string) => {
    let nextGoalId = value.goalId
    if (projectId) {
      const selectedProj = projects.find((p) => p.id === projectId)
      if (selectedProj && selectedProj.goalId) {
        nextGoalId = selectedProj.goalId
      }
    }
    onChange({ ...value, projectId, goalId: nextGoalId })
  }

  useEffect(() => {
    if (!open) {
      setAssigneeAdvice(null)
      setAssigneeAdviceError('')
      setIsAssigneeAdviceLoading(false)
    }
  }, [open])

  if (!open) return null

  const primaryAssigneeId = value.assigneeIds[0]
  const primaryAssignee = primaryAssigneeId != null ? users.find((user) => user.id === primaryAssigneeId) : undefined
  const primaryTeamRole = primaryAssignee?.teamRole?.trim() || ''
  const recommendedAssigneeId = assigneeAdvice?.recommended_assignee?.user_id
  const canAnalyzeAssignee =
    Boolean(onAnalyzeAssigneeWorkload) &&
    Boolean(value.title.trim()) &&
    primaryAssigneeId != null &&
    Boolean(primaryTeamRole) &&
    !isAssigneeAdviceLoading

  const handleAnalyzeAssigneeWorkload = async () => {
    if (!onAnalyzeAssigneeWorkload || primaryAssigneeId == null || !primaryTeamRole) return

    setIsAssigneeAdviceLoading(true)
    setAssigneeAdviceError('')
    try {
      const result = await onAnalyzeAssigneeWorkload({
        title: value.title.trim(),
        description: value.description.trim(),
        userId: primaryAssigneeId,
        teamRole: primaryTeamRole,
      })
      setAssigneeAdvice(result)
    } catch (error) {
      setAssigneeAdvice(null)
      setAssigneeAdviceError(error instanceof Error ? error.message : 'Не удалось проанализировать нагрузку')
    } finally {
      setIsAssigneeAdviceLoading(false)
    }
  }

  const handleApplyRecommendedAssignee = () => {
    if (!assigneeAdvice?.recommended_assignee) return
    onChange({ ...value, assigneeIds: [assigneeAdvice.recommended_assignee.user_id] })
  }

  const priorityStyle = getPriorityStyle(value.priority)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError('')
    try {
      await onUpload(file)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.includes('image') || item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          setIsUploading(true)
          setUploadError('')
          try {
            await onUpload(file)
          } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки')
          } finally {
            setIsUploading(false)
          }
        }
      }
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      setIsUploading(true)
      setUploadError('')
      try {
        for (let i = 0; i < files.length; i++) {
          await onUpload(files[i])
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return
    try {
      await onCreateBoardLabel({ name: newLabelName.trim(), color: newLabelColor })
      setNewLabelName('')
      setShowNewLabelForm(false)
    } catch {
      // handled by parent
    }
  }

  const addableLabelOptions = allLabels
    .filter((l) => !value.labelIds.includes(l.id))
    .map((l) => ({ value: l.id, label: l.name }))

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center bg-[#263238]/30 p-4 backdrop-blur-[2px]"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-[680px] max-h-[min(88vh,720px)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ECEFF1] px-4 py-3 sm:px-5">
          <h2 id="create-task-title" className="text-lg font-bold tracking-tight text-[#263238]">
            Новая задача
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#90A4AE] transition hover:bg-[#F5F5F5] hover:text-[#455A64]"
            aria-label="Закрыть"
          >
            <MaterialSymbol name="close" size={18} color="currentColor" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={COMPACT_LABEL}>Название</span>
            <input
              value={value.title}
              onChange={(event) => onChange({ ...value, title: event.target.value })}
              className={COMPACT_INPUT}
              placeholder="Краткое название задачи"
              autoFocus
            />
          </label>

          <div className="sm:col-span-2">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className={COMPACT_LABEL.replace('mb-1 ', '')}>Описание</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {onAiAssist ? (
                  <button
                    type="button"
                    onClick={onAiAssist}
                    disabled={isAiProcessing || (!value.title.trim() && !value.description.trim())}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#42A5F5] transition hover:bg-[#E3F2FD] disabled:opacity-50"
                  >
                    {isAiProcessing ? (
                      <MaterialSymbol name="progress_activity" size={13} className="animate-spin" />
                    ) : (
                      <MaterialSymbol name="auto_awesome" size={13} color="#42A5F5" />
                    )}
                    ИИ
                  </button>
                ) : null}
                <div className="inline-flex rounded-md border border-[#ECEFF1] bg-[#FAFAFA] p-0.5">
                  <button
                    type="button"
                    onClick={() => setDescriptionTab('edit')}
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                      descriptionTab === 'edit'
                        ? 'bg-white text-[#263238] shadow-sm'
                        : 'text-[#90A4AE] hover:text-[#546E7A]'
                    }`}
                  >
                    Текст
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescriptionTab('preview')}
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                      descriptionTab === 'preview'
                        ? 'bg-white text-[#263238] shadow-sm'
                        : 'text-[#90A4AE] hover:text-[#546E7A]'
                    }`}
                  >
                    Превью
                  </button>
                </div>
              </div>
            </div>

            {descriptionTab === 'edit' ? (
              <textarea
                value={value.description}
                onChange={(event) => onChange({ ...value, description: event.target.value })}
                rows={4}
                spellCheck={false}
                className={`${TASK_FORM.textarea} ${DESCRIPTION_SCROLL} py-2 text-sm`}
                placeholder="Markdown: **жирный**, списки…"
              />
            ) : (
              <div className={`rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 ${DESCRIPTION_SCROLL}`}>
                <TaskDescriptionMarkdown
                  source={value.description}
                  emptyLabel="Пусто — вкладка «Текст»."
                />
              </div>
            )}
          </div>

          <label>
            <span className={COMPACT_LABEL}>Приоритет</span>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: priorityStyle.color }}
                aria-hidden
              />
              <AppSelect
                value={value.priority}
                options={[
                  { value: 'low', label: 'Низкий' },
                  { value: 'medium', label: 'Средний' },
                  { value: 'high', label: 'Высокий' },
                  { value: 'critical', label: 'Критичный' },
                ]}
                onChange={(next) => onChange({ ...value, priority: next as BoardTask['priority'] })}
                ariaLabel="Выбор приоритета"
                showButtonAvatar={false}
                buttonClassName={`${COMPACT_SELECT} !pl-8`}
                menuClassName={TASK_FORM.selectMenu}
              />
            </div>
          </label>

          <label>
            <span className={COMPACT_LABEL}>Спринт</span>
            <AppSelect
              value={value.sprintId}
              options={[
                { value: '', label: 'Без спринта' },
                ...sprints.map((sprint) => ({ value: sprint.id, label: sprint.name })),
              ]}
              onChange={(next) => onChange({ ...value, sprintId: next })}
              ariaLabel="Выбор спринта"
              showButtonAvatar={false}
              buttonClassName={COMPACT_SELECT}
              menuClassName={TASK_FORM.selectMenu}
            />
          </label>

          <label>
            <span className={COMPACT_LABEL}>Цель</span>
            <AppSelect
              value={value.goalId}
              options={[
                { value: '', label: 'Без цели' },
                ...goals.map((g) => ({ value: g.id, label: g.name })),
              ]}
              onChange={handleGoalChangeForTask}
              ariaLabel="Выбор цели"
              showButtonAvatar={false}
              buttonClassName={COMPACT_SELECT}
              menuClassName={TASK_FORM.selectMenu}
            />
          </label>

          <label>
            <span className={COMPACT_LABEL}>Проект</span>
            <AppSelect
              value={value.projectId}
              options={[
                { value: '', label: 'Без проекта' },
                ...filteredProjects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={handleProjectChangeForTask}
              ariaLabel="Выбор проекта"
              showButtonAvatar={false}
              buttonClassName={COMPACT_SELECT}
              menuClassName={TASK_FORM.selectMenu}
            />
          </label>

          <label>
            <span className={COMPACT_LABEL}>Срок</span>
            <div className="relative">
              <input
                type="date"
                value={value.dueAt}
                min={new Date().toLocaleDateString('en-CA')}
                onChange={(event) => onChange({ ...value, dueAt: event.target.value })}
                className={`${COMPACT_INPUT} pr-9 [color-scheme:light]`}
              />
              <MaterialSymbol
                name="calendar_today"
                size={18}
                color="#90A4AE"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              />
            </div>
          </label>

          <label>
            <span className={COMPACT_LABEL}>Родитель</span>
            <AppSelect
              value={value.parentId}
              options={[
                { value: '', label: 'Без родителя' },
                ...availableParentTasks.map((task) => ({ value: task.id, label: task.title })),
              ]}
              onChange={(next) => onChange({ ...value, parentId: next })}
              ariaLabel="Выбор родительской задачи"
              searchable
              searchPlaceholder="Поиск..."
              showButtonAvatar={false}
              buttonClassName={COMPACT_SELECT}
              menuClassName={TASK_FORM.selectMenu}
            />
          </label>

          <div className="sm:col-span-2">
            <span className={COMPACT_LABEL}>Исполнители</span>
            <AppSelect
              multiple
              selectedValues={value.assigneeIds.map(String)}
              options={users.map((user) => ({
                value: String(user.id),
                label: user.fullName,
                image: user.avatarUrl,
              }))}
              value=""
              onChange={() => {}}
              onSelectedValuesChange={(next) => {
                const ids = next.map(Number).filter(Boolean)
                onChange({ ...value, assigneeIds: ids })
              }}
              ariaLabel="Выбор исполнителей"
              searchable
              searchPlaceholder="Поиск..."
              placeholder="Исполнитель..."
              buttonClassName={COMPACT_SELECT}
              menuClassName={TASK_FORM.selectMenu}
            />
            {value.assigneeIds.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {value.assigneeIds.map((uid) => {
                  const user = users.find((u) => u.id === uid)
                  if (!user) return null
                  const isRecommended = recommendedAssigneeId === uid
                  const isOverloadedProposed =
                    assigneeAdvice != null &&
                    !assigneeAdvice.can_assign &&
                    assigneeAdvice.assignee_user_id === uid
                  return (
                    <span
                      key={uid}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full border bg-[#FAFAFA] py-0.5 pl-1 pr-2 text-xs font-medium text-[#455A64]',
                        isRecommended
                          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300'
                          : isOverloadedProposed
                            ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300'
                            : 'border-[#ECEFF1]',
                      ].join(' ')}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E3F2FD] text-[10px] font-bold text-[#1976D2]">
                          {user.initials}
                        </span>
                      )}
                      <span className="max-w-[140px] truncate">{user.fullName}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({ ...value, assigneeIds: value.assigneeIds.filter((id) => id !== uid) })
                        }
                        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[#90A4AE] hover:bg-[#FFEBEE] hover:text-[#E53935]"
                        aria-label={`Убрать ${user.fullName}`}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            ) : null}

            {primaryAssigneeId != null && !primaryTeamRole ? (
              <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                У исполнителя не указана team role на доске.
              </p>
            ) : null}

            {onAnalyzeAssigneeWorkload ? (
              <button
                type="button"
                onClick={() => void handleAnalyzeAssigneeWorkload()}
                disabled={!canAnalyzeAssignee}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAssigneeAdviceLoading ? (
                  <MaterialSymbol name="progress_activity" size={14} className="animate-spin" />
                ) : (
                  <MaterialSymbol name="psychology" size={14} />
                )}
                Анализ нагрузки (ИИ)
              </button>
            ) : null}

            {assigneeAdviceError ? (
              <p className="mt-1.5 text-[11px] font-semibold text-[#C53030]">{assigneeAdviceError}</p>
            ) : null}

            {assigneeAdvice ? (
              <div
                className={`mt-2 space-y-2 rounded-lg border px-2.5 py-2 ${
                  assigneeAdvice.can_assign
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      assigneeAdvice.can_assign
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {assigneeAdvice.can_assign ? 'OK' : 'Перегруз'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#334155]">{assigneeAdvice.rationale}</p>

                {assigneeAdvice.recommended_assignee &&
                assigneeAdvice.recommended_assignee.user_id !== primaryAssigneeId ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#0F172A]">
                        {assigneeAdvice.recommended_assignee.fio}
                      </p>
                      <p className="text-[10px] text-[#64748B]">рекомендуется</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyRecommendedAssignee}
                      className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    >
                      Назначить
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={COMPACT_LABEL.replace('mb-1 ', '')}>Метки</span>
              <button
                type="button"
                onClick={() => setShowNewLabelForm(!showNewLabelForm)}
                className="text-[10px] font-bold uppercase tracking-wider text-[#42A5F5] transition hover:text-[#1976D2]"
              >
                {showNewLabelForm ? 'Отмена' : '+ Создать метку'}
              </button>
            </div>

            {showNewLabelForm ? (
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Имя метки..."
                  className={`${TASK_FORM.input} !h-9 flex-1 !text-xs`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCreateLabel()
                    }
                  }}
                />
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-[#E0E0E0] bg-white p-1"
                  aria-label="Цвет метки"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateLabel()}
                  disabled={!newLabelName.trim()}
                  className="h-9 shrink-0 rounded-lg bg-[#455A64] px-3 text-xs font-bold text-white transition hover:bg-[#37474F] disabled:opacity-50"
                >
                  ОК
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {value.labelIds.map((lid) => {
                const label = allLabels.find((l) => l.id === lid)
                if (!label) return null
                return (
                  <span
                    key={lid}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#ECEFF1] bg-white py-1 pl-2.5 pr-1.5 text-xs font-medium text-[#455A64]"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, labelIds: value.labelIds.filter((id) => id !== lid) })}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[#90A4AE] hover:bg-[#FFEBEE] hover:text-[#E53935]"
                      aria-label={`Удалить метку ${label.name}`}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
              <AppSelect
                value=""
                options={[{ value: '', label: 'Добавить...' }, ...addableLabelOptions]}
                onChange={(lid) => {
                  if (lid && !value.labelIds.includes(lid)) {
                    onChange({ ...value, labelIds: [...value.labelIds, lid] })
                  }
                }}
                className="min-w-[130px] flex-1 sm:flex-none"
                showButtonAvatar={false}
                buttonClassName={`${COMPACT_SELECT}`}
                menuClassName={TASK_FORM.selectMenu}
                placeholder="Добавить..."
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className={COMPACT_LABEL.replace('mb-1 ', '')}>Вложения</span>
              <label
                className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#CFE0F5] bg-[#EFF6FF] text-[#1E88E5] transition hover:bg-[#DBEAFE] ${isUploading ? 'cursor-wait opacity-60' : ''}`}
                title="Прикрепить файл"
              >
                {isUploading ? (
                  <MaterialSymbol name="sync" size={15} className="animate-spin" />
                ) : (
                  <MaterialSymbol name="add" size={16} color="currentColor" />
                )}
                <input type="file" className="hidden" onChange={handleFileChange} disabled={isUploading} />
              </label>
            </div>
            {uploadedAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {uploadedAttachments.map((file) => (
                  <span
                    key={file.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#ECEFF1] bg-[#FAFAFA] py-0.5 pl-1.5 pr-1 text-[11px] text-[#455A64]"
                  >
                    <MaterialSymbol name="attach_file" size={14} color="#90A4AE" />
                    <span className="max-w-[160px] truncate">{file.fileName}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(file.id)}
                      className="text-[#90A4AE] hover:text-[#E53935]"
                      aria-label="Удалить вложение"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#B0BEC5]">Нет файлов</p>
            )}
            {uploadError ? <p className="mt-1 text-[11px] font-medium text-[#E53935]">{uploadError}</p> : null}
          </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#F0F0F0] px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#E0E0E0] bg-white px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#FAFAFA]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSubmitting || !value.title.trim()}
            onClick={onSubmit}
            className="h-9 rounded-lg bg-[#1E88E5] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
