import { useEffect, useRef, useState } from 'react'
import type { BoardTask } from '../../../domain/entities/board/BoardModels'
import type {
  BoardActivityViewModel,
  BoardCommentViewModel,
  BoardLabelViewModel,
  BoardTaskViewModel,
  BoardUserViewModel,
  BoardGoalViewModel,
  BoardProjectViewModel,
  BoardSprintViewModel,
} from '../../view-models/BoardViewModel'
import AppConfirmDialog from '../../../shared/ui/AppConfirmDialog'
import AppSelect from '../../../shared/ui/AppSelect'
import AppToast from '../../../shared/ui/AppToast'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import BoardCommentsSection from './advanced/BoardCommentsSection'
import TaskAttachmentCard from './TaskAttachmentCard'
import TaskDescriptionMarkdown from './TaskDescriptionMarkdown'

type AttachmentPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported'

interface AttachmentPreviewState {
  attachmentId?: string
  sourceUrl: string
  fileName: string
  mimeType: string
  objectUrl: string
  kind: AttachmentPreviewKind
  textContent?: string
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac'])
const TEXT_EXTENSIONS = new Set(['.txt', '.log', '.json', '.js', '.ts', '.css', '.html', '.md'])

/** Jira-like tall description panel with internal scroll */
const DESCRIPTION_PANEL_SCROLL =
  'min-h-[max(320px,min(56vh,560px))] max-h-[max(480px,min(72vh,720px))] overflow-y-auto overscroll-contain [scrollbar-color:#C8D5E8_transparent] [scrollbar-width:thin]'



const getFileNameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url, window.location.origin)
    const pathname = parsed.pathname
    return pathname.slice(pathname.lastIndexOf('/') + 1) || 'file'
  } catch {
    return 'file'
  }
}



const createBlobFingerprint = async (blob: Blob): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const resolveAttachmentPreviewKind = (mimeType: string, fileName: string): AttachmentPreviewKind => {
  const normalizedMime = mimeType?.trim().toLowerCase() ?? ''
  const dotIndex = fileName.lastIndexOf('.')
  const extension = dotIndex !== -1 ? fileName.slice(dotIndex).toLowerCase() : ''

  if (normalizedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (normalizedMime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (normalizedMime.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (normalizedMime === 'application/pdf' || extension === '.pdf') return 'pdf'
  if (normalizedMime.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) return 'text'
  return 'unsupported'
}

interface TaskDetailModalProps {
  open: boolean
  task: BoardTask | null
  users: BoardUserViewModel[]
  sprints: BoardSprintViewModel[]
  goals: BoardGoalViewModel[]
  projects: BoardProjectViewModel[]
  activity: BoardActivityViewModel | null
  activityLoading: boolean
  labels: BoardLabelViewModel[]
  labelsLoading: boolean
  parentTask: BoardTaskViewModel | null
  availableParentTasks: BoardTaskViewModel[]
  comments: BoardCommentViewModel[]
  commentsLoading: boolean
  saving: boolean
  userRole?: string
  onClose: () => void
  onSave: (payload: {
    title?: string
    description?: string
    priority?: string
    dueAt?: string
    sprintId?: string
    goalId?: string
    projectId?: string
    assigneeIds?: number[]
    parentId?: string | null
    clearParentId?: boolean
    status?: string
  }) => Promise<void>
  onDelete: () => void
  onOpenTask: (taskId: string) => void
  onUpload: (file: File) => Promise<void>
  onAddWorklog: (payload: { timeSpentSec: number; comment?: string }) => void
  onAddTaskLabel: (labelId: string) => Promise<void>
  onRemoveTaskLabel: (labelId: string) => Promise<void>
  onCreateBoardLabel: (payload: { name: string; color: string }) => Promise<void>
  onCreateComment: (payload: { content: string }) => Promise<void>
  onCreatePhotoComment: (payload: { file: File; content?: string }) => Promise<void>
  onLoadAttachment: (url: string) => Promise<Blob>
  onDeleteAttachment: (attachmentId: string) => Promise<void>
  onUpdateComment: (commentId: string, content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
  onRefreshComments: () => void
  onRefreshActivity: () => void
  onUpdateStatus?: (status: string) => Promise<void>
  onAiAssist?: () => Promise<void>
  isAiProcessing?: boolean
}

interface TaskAutosavePayload {
  title: string
  description: string
  priority: BoardTask['priority']
  dueAt: string
  sprintId: string
  goalId: string
  projectId: string
  assigneeIds: number[]
  parentId: string | undefined
  clearParentId: boolean
}

const buildTaskShareUrl = (task: BoardTask): string => {
  const taskRef = task.taskKey || task.id
  const baseUrl = import.meta.env.BASE_URL || '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const link = task.link?.trim() || `kanban?task=${encodeURIComponent(taskRef)}`
  const normalizedLink = link.startsWith('/') ? link.slice(1) : link
  const path = `${normalizedBase}${normalizedLink}`
  return `${window.location.origin}${path}`
}

type TaskHistoryEntry = BoardActivityViewModel['history'][number]

const getHistoryEventMeta = (action: string) => {
  const normalized = action.toLowerCase()

  if (normalized.includes('назнач')) {
    return {
      icon: 'person_add',
      iconColor: '#1E88E5',
      iconBackground: '#EBF4FE',
      badgeClassName: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
    }
  }

  if (normalized.includes('снятие') || normalized.includes('удал')) {
    return {
      icon: 'person_remove',
      iconColor: '#DC2626',
      iconBackground: '#FEF2F2',
      badgeClassName: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
    }
  }

  if (normalized.includes('перемещ')) {
    return {
      icon: 'swap_horiz',
      iconColor: '#7C3AED',
      iconBackground: '#F3E8FF',
      badgeClassName: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]',
    }
  }

  if (normalized.includes('обновлен')) {
    return {
      icon: 'edit',
      iconColor: '#D97706',
      iconBackground: '#FFF7ED',
      badgeClassName: 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]',
    }
  }

  if (normalized.includes('создан')) {
    return {
      icon: 'task_alt',
      iconColor: '#059669',
      iconBackground: '#ECFDF5',
      badgeClassName: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
    }
  }

  return {
    icon: 'history',
    iconColor: '#5B6B82',
    iconBackground: '#EAEFF8',
    badgeClassName: 'border-[#D9E4F3] bg-[#F8FBFF] text-[#526581]',
  }
}

function TaskHistoryItem({
  item,
  meta,
  isLast,
}: {
  item: TaskHistoryEntry
  meta: ReturnType<typeof getHistoryEventMeta>
  isLast: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const details = item.details || item.action
  const threshold = 180

  const shouldTruncate = details.length > threshold
  const displayedText = shouldTruncate && !isExpanded
    ? `${details.slice(0, threshold)}...`
    : details

  return (
    <div className="relative pl-14">
      {!isLast ? (
        <div className="absolute left-[19px] top-12 h-[calc(100%+16px)] w-px bg-[#D9E4F3]" />
      ) : null}

      <div
        className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-white shadow-sm"
        style={{ backgroundColor: meta.iconBackground, color: meta.iconColor }}
      >
        <MaterialSymbol name={meta.icon} size={18} color="currentColor" />
      </div>

      <div className="rounded-2xl border border-[#E1E9F5] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1A2D45]">{item.userName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.badgeClassName}`}>
                {item.action}
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-medium text-[#6B7E99]">
            {item.createdAtLabel}
          </span>
        </div>

        <div className="mt-3">
          <p className="break-words text-sm leading-6 text-[#415A77] whitespace-pre-wrap">
            {displayedText}
          </p>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#3F51B5] hover:text-[#303F9F] transition duration-150 outline-none"
            >
              <span>{isExpanded ? 'Скрыть' : 'Показать полностью'}</span>
              <MaterialSymbol 
                name={isExpanded ? 'expand_less' : 'expand_more'} 
                size={14} 
                className="transition-transform duration-200" 
              />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskHistoryList({
  items,
  loading,
}: {
  items: TaskHistoryEntry[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1E88E5] border-t-transparent" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9E4F3] bg-white/80 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#5C7AB3]">
          <MaterialSymbol name="history" size={22} color="currentColor" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#1A2D45]">История пока пуста</p>
        <p className="mt-1 max-w-[260px] text-xs leading-5 text-[#7B8DAA]">
          Здесь будут появляться изменения статуса, исполнителей, колонок и другие действия по задаче.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {items.map((item, idx) => (
        <TaskHistoryItem
          key={item.id}
          item={item}
          meta={getHistoryEventMeta(item.action)}
          isLast={idx === items.length - 1}
        />
      ))}
    </div>
  )
}

export default function TaskDetailModal({
  open,
  task,
  users,
  sprints,
  goals,
  projects,
  activity,
  activityLoading,
  labels,
  parentTask,
  availableParentTasks,
  comments,
  commentsLoading,
  saving,
  userRole,
  onClose,
  onDelete,
  onOpenTask,
  onSave,
  onUpload,
  onAddWorklog,
  onAddTaskLabel,
  onRemoveTaskLabel,
  onCreateBoardLabel,
  onCreateComment,
  onCreatePhotoComment,
  onLoadAttachment,
  onDeleteAttachment,
  onUpdateComment,
  onDeleteComment,
  onRefreshComments,
  onRefreshActivity,
  onUpdateStatus,
  onAiAssist,
  isAiProcessing,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<BoardTask['priority']>(task?.priority ?? 'medium')
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 10) : '')
  const [assigneeIds, setAssigneeIds] = useState<number[]>(task?.assigneeIds ?? [])
  const [parentId, setParentId] = useState(task?.parentId ?? '')
  const [sprintId, setSprintId] = useState(task?.sprintId ?? '')
  const [goalId, setGoalId] = useState(task?.goalId ?? '')
  const [projectId, setProjectId] = useState(task?.projectId ?? '')
  const [status, setStatus] = useState(task?.status ?? 'TODO')
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [mobileStatusMenuOpen, setMobileStatusMenuOpen] = useState(false)
  const [activeFeedTab, setActiveFeedTab] = useState<'comments' | 'history' | 'worklog'>('comments')
  const [worklogHours, setWorklogHours] = useState('1')
  const [worklogComment, setWorklogComment] = useState('')
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<AttachmentPreviewState | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [attachmentToDelete, setAttachmentToDelete] = useState<{ id: string; fileName: string } | null>(null)
  const [hiddenTaskAttachmentIds, setHiddenTaskAttachmentIds] = useState<string[]>([])
  const [showNewLabelForm, setShowNewLabelForm] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#1E88E5')
  const [shareToast, setShareToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [descriptionTab, setDescriptionTab] = useState<'edit' | 'preview'>('edit')
  const [autosaveError, setAutosaveError] = useState('')
  const previewRequestIdRef = useRef(0)
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveInFlightRef = useRef(false)
  const queuedSaveRef = useRef<{
    snapshot: string
    payload: TaskAutosavePayload
  } | null>(null)
  const lastSavedSnapshotRef = useRef('')

  const assignees = users.filter((user) => assigneeIds.includes(user.id))

  const filteredProjectsForSelect = goalId
    ? projects.filter((p) => p.goalId === goalId)
    : projects

  const handleGoalChangeForTask = (nextGoalId: string) => {
    setGoalId(nextGoalId)
    if (nextGoalId) {
      const selectedProj = projects.find((p) => p.id === projectId)
      if (selectedProj && selectedProj.goalId !== nextGoalId) {
        setProjectId('')
      }
    }
  }

  const handleProjectChangeForTask = (nextProjectId: string) => {
    setProjectId(nextProjectId)
    if (nextProjectId) {
      const selectedProj = projects.find((p) => p.id === nextProjectId)
      if (selectedProj && selectedProj.goalId) {
        setGoalId(selectedProj.goalId)
      }
    }
  }
  const taskLabelIds = new Set((task?.labels ?? []).map((label) => label.id))
  const addableLabelOptions = labels
    .filter((label) => !taskLabelIds.has(label.id))
    .map((label) => ({ value: label.id, label: label.name }))

  const isOwner = userRole === 'owner'
  const isEditor = userRole === 'editor'
  const canEditTask = isOwner || isEditor
  const canDeleteTask = isOwner || isEditor

  const visibleTaskAttachments = (task?.attachments ?? []).filter(
    (attachment) => !hiddenTaskAttachmentIds.includes(attachment.id),
  )
  const previewableAttachments = visibleTaskAttachments.filter((attachment) => Boolean(attachment.downloadUrl))

  const handleStatusChange = (next: string) => {
    setStatus(next)
    setStatusMenuOpen(false)
    setMobileStatusMenuOpen(false)
    if (onUpdateStatus) {
      void onUpdateStatus(next)
    }
  }

  const buildPersistPayload = (): TaskAutosavePayload => ({
    title,
    description,
    priority,
    dueAt: dueAt ? `${dueAt}T00:00:00Z` : '',
    assigneeIds,
    parentId: parentId || undefined,
    clearParentId: !parentId && Boolean(task?.parentId),
    sprintId,
    goalId,
    projectId,
  })

  const buildTaskSnapshot = (payload: TaskAutosavePayload) =>
    JSON.stringify({
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      dueAt: payload.dueAt,
      assigneeIds: [...(payload.assigneeIds ?? [])].sort((left, right) => left - right),
      parentId: payload.parentId ?? '',
      clearParentId: Boolean(payload.clearParentId),
      sprintId: payload.sprintId ?? '',
      goalId: payload.goalId ?? '',
      projectId: payload.projectId ?? '',
    })

  const persistTaskChanges = async (
    snapshot: string,
    payload: TaskAutosavePayload,
  ): Promise<void> => {
    if (snapshot === lastSavedSnapshotRef.current) {
      return
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = { snapshot, payload }
      return
    }

    saveInFlightRef.current = true
    setAutosaveError('')

    try {
      await onSave(payload)
      lastSavedSnapshotRef.current = snapshot
    } catch (error) {
      setAutosaveError(error instanceof Error && error.message ? error.message : 'Не удалось сохранить изменения')
      throw error
    } finally {
      saveInFlightRef.current = false
    }

    if (queuedSaveRef.current && queuedSaveRef.current.snapshot !== lastSavedSnapshotRef.current) {
      const nextQueuedSave = queuedSaveRef.current
      queuedSaveRef.current = null
      await persistTaskChanges(nextQueuedSave.snapshot, nextQueuedSave.payload)
      return
    }

    queuedSaveRef.current = null
  }

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setPriority(task.priority || 'medium')
      setDueAt(task.dueAt ? task.dueAt.slice(0, 10) : '')
      setAssigneeIds(task.assigneeIds ?? [])
      setParentId(task.parentId ?? '')
      setSprintId(task.sprintId ?? '')
      setGoalId(task.goalId ?? '')
      setProjectId(task.projectId ?? '')
      setStatus(task.status || 'TODO')
      setAutosaveError('')
      setDescriptionTab('edit')
      lastSavedSnapshotRef.current = buildTaskSnapshot({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        dueAt: task.dueAt || '',
        assigneeIds: task.assigneeIds ?? [],
        parentId: task.parentId ?? undefined,
        clearParentId: false,
        sprintId: task.sprintId ?? '',
        goalId: task.goalId ?? '',
        projectId: task.projectId ?? '',
      })
    }
  }, [task])

  useEffect(() => {
    if (!open || !task || !canEditTask) {
      return
    }

    const payload = buildPersistPayload()
    const nextSnapshot = buildTaskSnapshot(payload)
    if (nextSnapshot === lastSavedSnapshotRef.current || !title.trim()) {
      return
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      autosaveTimeoutRef.current = null
      void persistTaskChanges(nextSnapshot, payload)
    }, 500)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
        autosaveTimeoutRef.current = null
      }
    }
  }, [open, task, canEditTask, title, description, priority, dueAt, assigneeIds, parentId, sprintId, goalId, projectId])

  useEffect(() => {
    return () => {
      if (preview?.objectUrl) {
        URL.revokeObjectURL(preview.objectUrl)
      }
    }
  }, [preview])

  const closePreview = () => {
    previewRequestIdRef.current += 1
    setPreview((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl)
      }
      return null
    })
    setPreviewError('')
    setPreviewLoading(false)
  }

  useEffect(() => {
    if (!open) {
      previewRequestIdRef.current += 1
      setPreview((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl)
        }
        return null
      })
      setPreviewError('')
      setPreviewLoading(false)
    }
  }, [open])

  useEffect(() => {
    const taskAttachments = task?.attachments ?? []
    const commentAttachmentUrls = comments
      .map((comment) => comment.attachmentUrl)
      .filter(Boolean)

    let cancelled = false

    if (!taskAttachments.length || !commentAttachmentUrls.length) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setHiddenTaskAttachmentIds([])
        }
      })
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        const commentFingerprints = new Set(
          await Promise.all(
            commentAttachmentUrls.map(async (url) => {
              const blob = await onLoadAttachment(url)
              return createBlobFingerprint(blob)
            }),
          ),
        )

        const hiddenIds = (
          await Promise.all(
            taskAttachments.map(async (attachment) => {
              if (!attachment.downloadUrl) return null

              const blob = await onLoadAttachment(attachment.downloadUrl)
              const fingerprint = await createBlobFingerprint(blob)
              return commentFingerprints.has(fingerprint) ? attachment.id : null
            }),
          )
        ).filter((value): value is string => Boolean(value))

        if (!cancelled) {
          setHiddenTaskAttachmentIds(hiddenIds)
        }
      } catch {
        if (!cancelled) {
          setHiddenTaskAttachmentIds([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [comments, onLoadAttachment, task])

  const handleOpenAttachment = async (input: { url: string; fileName?: string; mimeType?: string; blob?: Blob; attachmentId?: string }) => {
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    setPreviewLoading(true)
    setPreviewError('')

    try {
      const blob = input.blob ?? await onLoadAttachment(input.url)
      if (requestId !== previewRequestIdRef.current) return
      const fileName = input.fileName || getFileNameFromUrl(input.url)
      const mimeType = blob.type || input.mimeType || ''
      const kind = resolveAttachmentPreviewKind(mimeType, fileName)
      const objectUrl = URL.createObjectURL(blob)
      const textContent = kind === 'text' ? await blob.text() : undefined

      if (requestId !== previewRequestIdRef.current) {
        URL.revokeObjectURL(objectUrl)
        return
      }

      setPreview((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl)
        }
        return {
          attachmentId: input.attachmentId,
          sourceUrl: input.url,
          fileName,
          mimeType,
          objectUrl,
          kind,
          textContent,
        }
      })
    } catch (error) {
      if (requestId !== previewRequestIdRef.current) return
      const message = error instanceof Error && error.message ? error.message : 'Не удалось открыть вложение'
      setPreviewError(message)
      throw error
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }

  const currentPreviewIndex = preview
    ? previewableAttachments.findIndex((attachment) =>
        (preview.attachmentId && attachment.id === preview.attachmentId) ||
        (preview.sourceUrl && attachment.downloadUrl === preview.sourceUrl),
      )
    : -1

  const canOpenPrevAttachment = currentPreviewIndex > 0
  const canOpenNextAttachment = currentPreviewIndex >= 0 && currentPreviewIndex < previewableAttachments.length - 1

  const openAttachmentByIndex = (index: number) => {
    if (index < 0 || index >= previewableAttachments.length) return

    const target = previewableAttachments[index]
    void handleOpenAttachment({
      attachmentId: target.id,
      url: target.downloadUrl,
      fileName: target.fileName,
      mimeType: target.mimeType,
    }).catch(() => {})
  }

  useEffect(() => {
    if (!preview && !previewLoading) return

    const handlePreviewNavigation = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && canOpenPrevAttachment) {
        event.preventDefault()
        openAttachmentByIndex(currentPreviewIndex - 1)
      }

      if (event.key === 'ArrowRight' && canOpenNextAttachment) {
        event.preventDefault()
        openAttachmentByIndex(currentPreviewIndex + 1)
      }
    }

    document.addEventListener('keydown', handlePreviewNavigation)
    return () => {
      document.removeEventListener('keydown', handlePreviewNavigation)
    }
  }, [preview, previewLoading, canOpenPrevAttachment, canOpenNextAttachment, currentPreviewIndex, previewableAttachments])

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  const handleOpenPreviewInNewTab = () => {
    if (!preview?.objectUrl) return

    const anchor = document.createElement('a')
    anchor.href = preview.objectUrl
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleDownloadPreview = () => {
    if (!preview?.objectUrl) return

    const anchor = document.createElement('a')
    anchor.href = preview.objectUrl
    anchor.download = preview.fileName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
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

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(Boolean)
    if (!list.length) return

    setIsUploading(true)
    setUploadStatus(null)
    try {
      for (const file of list) {
        await onUpload(file)
      }
      setUploadStatus({
        type: 'success',
        text:
          list.length === 1
            ? `Файл «${list[0].name}» успешно загружен`
            : `${list.length} файл(ов) загружено`,
      })
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Не удалось загрузить файл'
      setUploadStatus({ type: 'error', text: message })
    } finally {
      setIsUploading(false)
    }
  }

  const handleAttachmentInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return
    void uploadFiles(files)
    event.target.value = ''
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.includes('image') || item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          await uploadFiles([file])
        }
      }
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (files?.length) {
      await uploadFiles(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const copyShareLink = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!copied) throw new Error('Не удалось скопировать ссылку')
  }

  const handleCopyTaskLink = async () => {
    if (!task) return

    try {
      await copyShareLink(buildTaskShareUrl(task))
      setShareToast({ message: 'Ссылка на задачу скопирована', variant: 'success' })
    } catch {
      setShareToast({ message: 'Не удалось скопировать ссылку на задачу', variant: 'error' })
    }
  }

  const handleShareTask = async () => {
    if (!task) return

    const shareUrl = buildTaskShareUrl(task)
    const shareTitle = task.title || 'Задача'

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl })
        return
      }

      await copyShareLink(shareUrl)
      setShareToast({ message: 'Ссылка на задачу скопирована', variant: 'success' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return

      try {
        await copyShareLink(shareUrl)
        setShareToast({ message: 'Ссылка на задачу скопирована', variant: 'success' })
      } catch {
        setShareToast({ message: 'Не удалось скопировать ссылку на задачу', variant: 'error' })
      }
    }
  }

  if (!open || !task) return null

  const taskDisplayKey = task.taskKey || `TASK-${task.id.slice(0, 8)}`
  const historyItems = activity?.history ?? []

  return (
    <div 
      className="fixed inset-0 z-[600] flex items-center justify-center bg-[#091728]/45 p-4 backdrop-blur-sm sm:p-6 lg:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="flex h-full max-h-[min(94vh,960px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl border border-[#DCE4F1] bg-white shadow-[0_24px_70px_rgba(10,22,40,0.35)]">
        
        {/* Modern Jira-style Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-5 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#64748B]">
              <MaterialSymbol name="view_kanban" size={14} className="text-[#3F51B5]" />
              <span>Проекты</span>
              <span>/</span>
              <span>Алем Доска</span>
              <span>/</span>
              <button
                type="button"
                onClick={handleCopyTaskLink}
                className="inline-flex items-center gap-1 rounded bg-[#F1F5F9] px-2 py-0.5 text-xs font-bold text-[#3F51B5] hover:bg-[#E2E8F0] transition"
                title="Скопировать ссылку"
              >
                <MaterialSymbol name="content_copy" size={11} />
                {taskDisplayKey}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {canEditTask ? (
              <span className="hidden text-xs font-medium text-[#64748B] sm:inline">
                {saving ? (
                  <span className="flex items-center gap-1">
                    <MaterialSymbol name="sync" size={12} className="animate-spin" />
                    Сохраняем...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#10B981]">
                    <MaterialSymbol name="cloud_done" size={12} />
                    Сохранено автоматически
                  </span>
                )}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void handleShareTask()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition hover:bg-[#F8FAFC]"
              title="Поделиться"
            >
              <MaterialSymbol name="share" size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition hover:bg-[#F8FAFC]"
              aria-label="Закрыть"
            >
              <MaterialSymbol name="close" size={16} />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 overflow-hidden">
          
          {/* Main Content Column (Left) */}
          <div className="flex-1 overflow-y-auto bg-white p-5 sm:p-6 lg:p-8 [scrollbar-color:#C8D5E8_transparent] [scrollbar-width:thin]">
            <div className="mx-auto flex w-full min-h-full max-w-[980px] flex-col space-y-5">
              
              {/* Task Title (Massive & Borderless) */}
              <div className="shrink-0">
                <input
                  value={title}
                  readOnly={!canEditTask}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full rounded-xl bg-transparent px-1 py-2 text-2xl font-extrabold leading-tight tracking-tight text-[#0F172A] outline-none placeholder:text-[#94A3B8] transition-all duration-150 hover:bg-[#F8FAFC] focus:bg-white focus:ring-2 focus:ring-[#3F51B5]/15 sm:text-[26px] ${!canEditTask ? 'cursor-default' : ''}`}
                  placeholder="Название задачи"
                />
              </div>

              {/* Description — tall Jira-style panel */}
              <div className="flex min-h-0 flex-1 flex-col space-y-3">
                {canEditTask && descriptionTab === 'edit' ? (
                  <div className="flex min-h-0 flex-1 flex-col space-y-3">
                    <div className="relative flex min-h-0 flex-1 flex-col">
                      {onAiAssist ? (
                        <button
                          type="button"
                          onClick={() => void onAiAssist()}
                          disabled={isAiProcessing || (!title.trim() && !description.trim())}
                          title="ИИ помощник"
                          aria-label="ИИ помощник"
                          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-white/95 text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAiProcessing ? (
                            <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
                          ) : (
                            <MaterialSymbol name="auto_awesome" size={16} />
                          )}
                        </button>
                      ) : null}
                      <textarea
                        ref={descriptionRef}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`block h-full w-full resize-none rounded-xl border border-[#E2E8F0] bg-white px-5 py-4 pr-14 font-sans text-[15px] leading-7 text-[#1E293B] shadow-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#3F51B5]/20 ${DESCRIPTION_PANEL_SCROLL}`}
                        placeholder="Добавьте описание: шаги воспроизведения, ожидаемый результат, детали..."
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDescriptionTab('preview')}
                        className="inline-flex h-9 items-center rounded-md bg-[#3F51B5] px-4 text-sm font-semibold text-white transition hover:bg-[#303F9F]"
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescriptionTab('preview')}
                        className="inline-flex h-9 items-center rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:bg-[#F8FAFC]"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    {onAiAssist && canEditTask ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void onAiAssist()
                        }}
                        disabled={isAiProcessing || (!title.trim() && !description.trim())}
                        title="ИИ помощник"
                        aria-label="ИИ помощник"
                        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-white/95 text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isAiProcessing ? (
                          <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
                        ) : (
                          <MaterialSymbol name="auto_awesome" size={16} />
                        )}
                      </button>
                    ) : null}
                    <div
                      onClick={() => canEditTask && setDescriptionTab('edit')}
                      className={`h-full cursor-pointer rounded-xl border border-[#EEF2F6] bg-[#FAFBFC] px-5 py-4 pr-14 transition-all duration-200 hover:border-[#E2E8F0] hover:bg-[#F8FAFC] ${DESCRIPTION_PANEL_SCROLL}`}
                    >
                      <TaskDescriptionMarkdown
                        source={description}
                        emptyLabel="Нажмите, чтобы добавить описание к этой задаче..."
                      />
                    </div>
                  </div>
                )}
                {autosaveError ? (
                  <p className="mt-2 text-xs font-semibold text-[#C53030]">{autosaveError}</p>
                ) : null}
              </div>

              {/* Mobile details block (Visible only on mobile screen widths) */}
              <article className="xl:hidden my-2 space-y-4 rounded-2xl border border-[#E2E8F0] bg-[#FAFBFC] p-5">
                <div className="mb-2 flex items-center gap-2">
                  <MaterialSymbol name="info" size={15} className="text-[#5E7596]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5E7596]">Параметры задачи</span>
                </div>
                
                <FieldRow label="Статус">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMobileStatusMenuOpen(!mobileStatusMenuOpen)}
                      className={[
                        'flex h-9 w-full items-center justify-between gap-2.5 rounded-lg border px-3 text-left text-sm font-semibold transition-all cursor-pointer bg-white outline-none',
                        status === 'TODO' ? 'border-slate-200 text-[#42526e] hover:bg-slate-50' : '',
                        status === 'IN_PROGRESS' ? 'border-[#b3d4ff] bg-[#deebff]/80 text-[#0052cc] hover:bg-[#deebff]' : '',
                        status === 'TEST' ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100/50' : '',
                        status === 'DONE' ? 'border-[#abf5d1] bg-[#e3fcef]/80 text-[#006644] hover:bg-[#e3fcef]' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="flex items-center gap-1.5">
                        <MaterialSymbol
                          name={
                            status === 'TODO' ? 'radio_button_unchecked' :
                            status === 'IN_PROGRESS' ? 'change_circle' :
                            status === 'TEST' ? 'visibility' : 'check_circle'
                          }
                          size={14}
                          color="currentColor"
                        />
                        <span>
                          {status === 'TODO' ? 'К выполнению' :
                           status === 'IN_PROGRESS' ? 'В работе' :
                           status === 'TEST' ? 'Проверка' : 'Готово'}
                        </span>
                      </div>
                      <MaterialSymbol name="expand_more" size={14} color="currentColor" />
                    </button>

                    {mobileStatusMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-[1000]" onClick={() => setMobileStatusMenuOpen(false)} />
                        <div className="absolute top-[calc(100%+6px)] left-0 z-[1010] w-full overflow-hidden rounded-xl border border-[#EDF2F8] bg-white p-1 shadow-[0_12px_32px_rgba(15,35,62,0.12)]">
                          {[
                            { value: 'TODO', label: 'К выполнению', icon: 'radio_button_unchecked', color: '#42526e', hoverClass: 'hover:bg-slate-50 text-[#42526e]' },
                            { value: 'IN_PROGRESS', label: 'В работе', icon: 'change_circle', color: '#0052cc', hoverClass: 'hover:bg-[#deebff]/40 text-[#0052cc]' },
                            { value: 'TEST', label: 'Проверка', icon: 'visibility', color: '#6D28D9', hoverClass: 'hover:bg-purple-50/40 text-purple-700' },
                            { value: 'DONE', label: 'Готово', icon: 'check_circle', color: '#006644', hoverClass: 'hover:bg-[#e3fcef]/40 text-[#006644]' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleStatusChange(opt.value)}
                              className={[
                                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors border-0 bg-transparent cursor-pointer',
                                status === opt.value ? 'bg-slate-100 font-bold' : opt.hoverClass,
                              ].join(' ')}
                            >
                              <MaterialSymbol name={opt.icon} size={14} color={opt.color} />
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </FieldRow>

                <FieldRow label="Исполнитель">
                  {canEditTask ? (
                    <AppSelect
                      multiple
                      selectedValues={assigneeIds.map(String)}
                      options={users.map((u) => ({
                        value: String(u.id),
                        label: u.fullName,
                        image: u.avatarUrl,
                      }))}
                      value=""
                      onChange={() => {}}
                      onSelectedValuesChange={(next) => {
                        setAssigneeIds(next.map(Number).filter(Boolean))
                      }}
                      selectedSummaryText={(selected) => selected.map(o => o.label).join(', ')}
                      searchable
                      searchPlaceholder="Найти исполнителей..."
                      placeholder="Добавить исполнителя..."
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#475569]">
                      {assignees.length > 0 ? assignees.map((u) => u.fullName).join(', ') : 'Не назначен'}
                    </span>
                  )}
                </FieldRow>

                <FieldRow label="Приоритет">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'critical', label: 'Крит', activeClass: 'border-red-200 bg-red-50 text-red-700 ring-1 ring-red-100' },
                      { id: 'high', label: 'Выс', activeClass: 'border-amber-200 bg-amber-50 text-amber-700 ring-1 ring-amber-100' },
                      { id: 'medium', label: 'Сред', activeClass: 'border-yellow-200 bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100' },
                      { id: 'low', label: 'Низ', activeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' }
                    ].map((item) => {
                      const isActive = priority === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!canEditTask}
                          onClick={() => setPriority(item.id as any)}
                          className={[
                            'inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-extrabold tracking-wider transition-all cursor-pointer outline-none uppercase',
                            isActive ? item.activeClass : 'border-[#CBD5E1] bg-white text-[#64748B] hover:border-[#94A3B8] hover:text-[#334155]'
                          ].join(' ')}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </FieldRow>

                <FieldRow label="Срок">
                  <input
                    type="date"
                    value={dueAt}
                    min={new Date().toLocaleDateString('en-CA')}
                    readOnly={!canEditTask}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0A1628] outline-none"
                  />
                </FieldRow>

                <FieldRow label="Спринт">
                  {canEditTask ? (
                    <AppSelect
                      value={sprintId}
                      options={[
                        { value: '', label: 'Без спринта' },
                        ...sprints.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                      onChange={setSprintId}
                      showButtonAvatar={false}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#475569]">
                      {sprints.find((s) => s.id === sprintId)?.name || 'Без спринта'}
                    </span>
                  )}
                </FieldRow>

                <FieldRow label="Цель">
                  {canEditTask ? (
                    <AppSelect
                      value={goalId}
                      options={[
                        { value: '', label: 'Без цели' },
                        ...goals.map((g) => ({ value: g.id, label: g.name })),
                      ]}
                      onChange={handleGoalChangeForTask}
                      showButtonAvatar={false}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#475569]">
                      {goals.find((g) => g.id === goalId)?.name || 'Без цели'}
                    </span>
                  )}
                </FieldRow>

                <FieldRow label="Проект">
                  {canEditTask ? (
                    <AppSelect
                      value={projectId}
                      options={[
                        { value: '', label: 'Без проекта' },
                        ...filteredProjectsForSelect.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                      onChange={handleProjectChangeForTask}
                      showButtonAvatar={false}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#475569]">
                      {projects.find((p) => p.id === projectId)?.name || 'Без проекта'}
                    </span>
                  )}
                </FieldRow>

                <FieldRow label="Метки">
                  <div className="flex flex-wrap gap-1.5">
                    {(task.labels ?? []).map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E4F3] bg-[#F8FBFF] px-2 py-0.5 text-xs text-[#294869] shadow-sm"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="font-semibold">{l.name}</span>
                        {canEditTask && (
                          <button
                            type="button"
                            onClick={() => void onRemoveTaskLabel(l.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {canEditTask && (
                      <AppSelect
                        value=""
                        options={[{ value: '', label: 'Добавить...' }, ...addableLabelOptions]}
                        onChange={(val) => val && void onAddTaskLabel(val)}
                        className="min-w-[170px] max-w-full"
                        buttonClassName="!h-9 !px-3 !rounded-lg !text-sm"
                        showButtonAvatar={false}
                        showOptionAvatar={false}
                      />
                    )}
                  </div>
                </FieldRow>
              </article>

              {/* Parent issue block (Desktop) */}
              <div className="hidden border-t border-[#EEF2F6] pt-6 xl:block">
                <SectionLabel className="text-xs font-bold text-[#64748B]">Родительская задача</SectionLabel>
                <div className="mt-3 flex flex-col gap-3">
                  {canEditTask ? (
                    <AppSelect
                      value={parentId}
                      options={[
                        { value: '', label: 'Без родителя' },
                        ...availableParentTasks.map((item) => ({ value: item.id, label: item.title })),
                      ]}
                      onChange={setParentId}
                      className="w-full sm:w-96"
                      searchable
                      searchPlaceholder="Поиск задач..."
                      buttonClassName="!h-9 !px-3 !rounded-lg !text-sm"
                    />
                  ) : null}

                  {parentTask ? (
                    <button
                      type="button"
                      onClick={() => onOpenTask(parentTask.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#DDE3EE] bg-[#F8F9FD] px-4 py-3 text-left transition hover:border-[#1E88E5] hover:bg-[#F1F7FE]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#0A1628]">{parentTask.title}</span>
                        <span className="mt-0.5 block text-xs text-[#6F86A8]">Открыть родительскую задачу</span>
                      </span>
                      <MaterialSymbol name="open_in_new" size={16} color="#6F86A8" />
                    </button>
                  ) : !canEditTask ? (
                    <span className="text-sm font-medium text-[#8497B4]">Нет родительской задачи</span>
                  ) : null}
                </div>
              </div>

              {/* Subtasks Section */}
              {(task.subtasks?.length ?? 0) > 0 ? (
                <div className="border-t border-[#EEF2F6] pt-6">
                  <SectionLabel className="text-xs font-bold text-[#64748B]">Подзадачи</SectionLabel>
                  <div className="mt-3 space-y-2">
                    {(task.subtasks ?? []).map((subtask) => (
                      <button
                        key={subtask.id}
                        type="button"
                        onClick={() => onOpenTask(subtask.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#DDE3EE] bg-white px-3.5 py-2.5 text-left transition hover:border-[#1E88E5] hover:bg-[#F8FBFF]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#0A1628]">{subtask.title}</span>
                          <span className="mt-0.5 block text-xs text-[#6F86A8]">{subtask.status || 'Без статуса'}</span>
                        </span>
                        <MaterialSymbol name="chevron_right" size={18} color="#6F86A8" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Attachments Section */}
              <div className="border-t border-[#EEF2F6] pt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Вложения</span>
                  {canEditTask ? (
                    <label
                      className={[
                        'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition',
                        isUploading
                          ? 'cursor-not-allowed border-[#CBD5E1] bg-slate-50 text-[#94A3B8]'
                          : 'border-[#CFE0F5] bg-[#EFF6FF] text-[#1E88E5] hover:bg-[#DBEAFE]',
                      ].join(' ')}
                      title={isUploading ? 'Загрузка...' : 'Добавить файл'}
                    >
                      {isUploading ? (
                        <MaterialSymbol name="sync" size={16} className="animate-spin" />
                      ) : (
                        <MaterialSymbol name="add" size={18} color="currentColor" />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        disabled={isUploading}
                        onChange={handleAttachmentInputChange}
                      />
                    </label>
                  ) : null}
                </div>

                {uploadStatus ? (
                  <p className={`mb-3 text-xs font-semibold ${uploadStatus.type === 'success' ? 'text-[#1B8F4D]' : 'text-[#C53030]'}`}>
                    {uploadStatus.text}
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleTaskAttachments.length > 0 ? (
                    visibleTaskAttachments.map((attachment) => (
                      <TaskAttachmentCard
                        key={`${attachment.id}:${attachment.downloadUrl}:${attachment.mimeType}`}
                        attachment={attachment}
                        onLoadAttachment={onLoadAttachment}
                        onOpenAttachment={handleOpenAttachment}
                        onDelete={() => setAttachmentToDelete({ id: attachment.id, fileName: attachment.fileName || 'Файл' })}
                        deleteDisabled={saving}
                      />
                    ))
                  ) : (
                    <p className="text-xs text-[#94A3B8] sm:col-span-2 lg:col-span-3">
                      Вложений пока нет. Нажмите «+» или перетащите файлы в модалку.
                    </p>
                  )}
                </div>
                {previewError ? (
                  <p className="text-xs font-semibold text-[#C53030] mt-2">{previewError}</p>
                ) : null}
              </div>

              {/* Unified Secondary Activity Feed Section */}
              <div className="border-t border-[#EEF2F6] pt-6">
                <div className="mb-4 border-b border-[#E2E8F0]">
                  <div className="flex flex-wrap gap-2 sm:gap-5">
                    {[
                      { id: 'comments', label: 'Комментарии', icon: 'forum', count: comments.length },
                      { id: 'history', label: 'История изменений', icon: 'history', count: historyItems.length },
                      { id: 'worklog', label: 'Учет времени', icon: 'schedule' }
                    ].map((tab) => {
                      const isActive = activeFeedTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveFeedTab(tab.id as any)}
                          className={`inline-flex h-11 items-center gap-2 px-1 pb-2.5 text-sm font-semibold border-b-2 transition-all outline-none ${
                            isActive
                              ? 'border-[#3F51B5] text-[#3F51B5]'
                              : 'border-transparent text-[#64748B] hover:text-[#475569]'
                          }`}
                        >
                          <MaterialSymbol name={tab.icon} size={16} />
                          <span>{tab.label}</span>
                          {tab.count !== undefined && tab.count > 0 && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              isActive ? 'bg-[#EEF2FF] text-[#3F51B5]' : 'bg-[#F1F5F9] text-[#64748B]'
                            }`}>
                              {tab.count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="min-h-[180px] pb-8 pt-2">
                  {activeFeedTab === 'comments' && (
                    <div className="space-y-4">
                      {onRefreshComments && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={onRefreshComments}
                            disabled={commentsLoading}
                            className="flex items-center gap-1 text-xs font-semibold text-[#3F51B5] hover:underline"
                          >
                            <MaterialSymbol name="refresh" size={13} className={commentsLoading ? 'animate-spin' : ''} />
                            <span>Обновить комментарии</span>
                          </button>
                        </div>
                      )}
                      <BoardCommentsSection
                        selectedTask={task}
                        comments={comments}
                        isLoading={commentsLoading}
                        isSubmitting={saving}
                        showContainer={false}
                        showHeader={false}
                        onCreateComment={onCreateComment}
                        onCreatePhotoComment={onCreatePhotoComment}
                        onLoadAttachment={onLoadAttachment}
                        onOpenAttachment={(url) => handleOpenAttachment({ url })}
                        onUpdateComment={onUpdateComment}
                        onDeleteComment={onDeleteComment}
                      />
                    </div>
                  )}

                  {activeFeedTab === 'history' && (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={onRefreshActivity}
                          disabled={activityLoading}
                          className="flex items-center gap-1 text-xs font-semibold text-[#3F51B5] hover:underline"
                        >
                          <MaterialSymbol name="refresh" size={13} className={activityLoading ? 'animate-spin' : ''} />
                          <span>Обновить историю</span>
                        </button>
                      </div>
                      <TaskHistoryList items={historyItems} loading={activityLoading} />
                    </div>
                  )}

                  {activeFeedTab === 'worklog' && (
                    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]/50 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MaterialSymbol name="schedule" size={16} className="text-[#3F51B5]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">Учет рабочего времени</span>
                      </div>
                      <p className="text-xs text-[#64748B] mb-4">Записывайте время, затраченное на выполнение этой задачи, для точной отчетности.</p>
                      
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[100px_1fr_auto]">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase">Часы</span>
                          <input
                            type="number"
                            value={worklogHours}
                            onChange={(e) => setWorklogHours(e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm outline-none focus:border-[#3F51B5]"
                            placeholder="1"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase">Комментарий</span>
                          <input
                            value={worklogComment}
                            onChange={(e) => setWorklogComment(e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm outline-none focus:border-[#3F51B5]"
                            placeholder="Что было сделано..."
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const h = Number(worklogHours)
                              if (!h || h <= 0) return
                              onAddWorklog({ timeSpentSec: Math.round(h * 3600), comment: worklogComment })
                              setWorklogComment('')
                              setWorklogHours('1')
                            }}
                            disabled={saving}
                            className="h-9 rounded-lg bg-[#3F51B5] px-4 text-xs font-semibold text-white transition hover:bg-[#303F9F] disabled:opacity-50"
                          >
                            Записать
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Metadata Sidebar details (Desktop right panel) */}
          <aside className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-[#E2E8F0] bg-[#FAFBFC] [scrollbar-color:#C8D5E8_transparent] [scrollbar-width:thin] xl:flex xl:flex-col">
            <header className="border-b border-[#E2E8F0] px-5 py-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Сведения</span>
            </header>
            
            <div className="space-y-4 border-b border-[#E2E8F0] p-5">
              <FieldRow label="Статус">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                    className={[
                      'flex h-9 w-full items-center justify-between gap-2.5 rounded-lg border px-3 text-left text-sm font-semibold transition-all cursor-pointer bg-white outline-none',
                      status === 'TODO' ? 'border-slate-200 text-[#42526e] hover:bg-slate-50' : '',
                      status === 'IN_PROGRESS' ? 'border-[#b3d4ff] bg-[#deebff]/80 text-[#0052cc] hover:bg-[#deebff]' : '',
                      status === 'TEST' ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100/50' : '',
                      status === 'DONE' ? 'border-[#abf5d1] bg-[#e3fcef]/80 text-[#006644] hover:bg-[#e3fcef]' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="flex items-center gap-1.5">
                      <MaterialSymbol
                        name={
                          status === 'TODO' ? 'radio_button_unchecked' :
                          status === 'IN_PROGRESS' ? 'change_circle' :
                          status === 'TEST' ? 'visibility' : 'check_circle'
                        }
                        size={13}
                        color="currentColor"
                      />
                      <span>
                        {status === 'TODO' ? 'К выполнению' :
                         status === 'IN_PROGRESS' ? 'В работе' :
                         status === 'TEST' ? 'Проверка' : 'Готово'}
                      </span>
                    </div>
                    <MaterialSymbol name="expand_more" size={14} color="currentColor" />
                  </button>

                  {statusMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-[1000]" onClick={() => setStatusMenuOpen(false)} />
                      <div className="absolute top-[calc(100%+6px)] left-0 z-[1010] w-full overflow-hidden rounded-xl border border-[#EDF2F8] bg-white p-1 shadow-[0_12px_32px_rgba(15,35,62,0.12)] animate-in fade-in slide-in-from-top-1 duration-150">
                        {[
                          { value: 'TODO', label: 'К выполнению', icon: 'radio_button_unchecked', color: '#42526e', hoverClass: 'hover:bg-slate-50 text-[#42526e]' },
                          { value: 'IN_PROGRESS', label: 'В работе', icon: 'change_circle', color: '#0052cc', hoverClass: 'hover:bg-[#deebff]/40 text-[#0052cc]' },
                          { value: 'TEST', label: 'Проверка', icon: 'visibility', color: '#6D28D9', hoverClass: 'hover:bg-purple-50/40 text-purple-700' },
                          { value: 'DONE', label: 'Готово', icon: 'check_circle', color: '#006644', hoverClass: 'hover:bg-[#e3fcef]/40 text-[#006644]' }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleStatusChange(opt.value)}
                            className={[
                              'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors border-0 bg-transparent cursor-pointer',
                              status === opt.value ? 'bg-slate-100 font-bold' : opt.hoverClass,
                            ].join(' ')}
                          >
                            <MaterialSymbol name={opt.icon} size={14} color={opt.color} />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </FieldRow>
              
              <FieldRow label="Исполнитель">
                {canEditTask ? (
                  <AppSelect
                    multiple
                    selectedValues={assigneeIds.map(String)}
                    options={users.map((u) => ({
                      value: String(u.id),
                      label: u.fullName,
                      image: u.avatarUrl,
                    }))}
                    value=""
                    onChange={() => {}}
                    onSelectedValuesChange={(next) => {
                      setAssigneeIds(next.map(Number).filter(Boolean))
                    }}
                    selectedSummaryText={(selected) => selected.map(o => o.label).join(', ')}
                    searchable
                    searchPlaceholder="Найти исполнителей..."
                    placeholder="Добавить исполнителя..."
                  />
                ) : (
                  <span className="text-xs font-semibold text-[#475569]">
                    {assignees.length > 0 ? assignees.map((u) => u.fullName).join(', ') : 'Не назначен'}
                  </span>
                )}
              </FieldRow>

              <FieldRow label="Приоритет">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'critical', label: 'Крит', activeClass: 'border-red-200 bg-red-50 text-red-700 ring-1 ring-red-100' },
                    { id: 'high', label: 'Выс', activeClass: 'border-amber-200 bg-amber-50 text-amber-700 ring-1 ring-amber-100' },
                    { id: 'medium', label: 'Сред', activeClass: 'border-yellow-200 bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100' },
                    { id: 'low', label: 'Низ', activeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' }
                  ].map((item) => {
                    const isActive = priority === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!canEditTask}
                        onClick={() => setPriority(item.id as any)}
                        className={[
                          'inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-bold tracking-wider transition-all cursor-pointer outline-none uppercase',
                          isActive ? item.activeClass : 'border-[#CBD5E1] bg-white text-[#64748B] hover:border-[#94A3B8] hover:text-[#334155]'
                        ].join(' ')}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </FieldRow>

               <FieldRow label="Срок">
                <input
                  type="date"
                  value={dueAt}
                  min={new Date().toLocaleDateString('en-CA')}
                  readOnly={!canEditTask}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0A1628] outline-none"
                />
              </FieldRow>

              <FieldRow label="Спринт">
                {canEditTask ? (
                  <AppSelect
                    value={sprintId}
                    options={[
                      { value: '', label: 'Без спринта' },
                      ...sprints.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                    onChange={setSprintId}
                    showButtonAvatar={false}
                  />
                ) : (
                  <span className="text-xs font-semibold text-[#475569]">
                    {sprints.find((s) => s.id === sprintId)?.name || 'Без спринта'}
                  </span>
                )}
              </FieldRow>

              <FieldRow label="Цель">
                {canEditTask ? (
                  <AppSelect
                    value={goalId}
                    options={[
                      { value: '', label: 'Без цели' },
                      ...goals.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                    onChange={handleGoalChangeForTask}
                    showButtonAvatar={false}
                  />
                ) : (
                  <span className="text-xs font-semibold text-[#475569]">
                    {goals.find((g) => g.id === goalId)?.name || 'Без цели'}
                  </span>
                )}
              </FieldRow>

              <FieldRow label="Проект">
                {canEditTask ? (
                  <AppSelect
                    value={projectId}
                    options={[
                      { value: '', label: 'Без проекта' },
                      ...filteredProjectsForSelect.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    onChange={handleProjectChangeForTask}
                    showButtonAvatar={false}
                  />
                ) : (
                  <span className="text-xs font-semibold text-[#475569]">
                    {projects.find((p) => p.id === projectId)?.name || 'Без проекта'}
                  </span>
                )}
              </FieldRow>

              <FieldRow label="Метки">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(task.labels ?? []).map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E4F3] bg-[#F8FBFF] px-2 py-0.5 text-xs text-[#294869] shadow-sm"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="font-semibold">{l.name}</span>
                        {canEditTask && (
                          <button
                            type="button"
                            onClick={() => void onRemoveTaskLabel(l.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {canEditTask && (
                      <div className="flex items-center gap-1.5">
                        <AppSelect
                          value=""
                          options={[{ value: '', label: 'Добавить...' }, ...addableLabelOptions]}
                          onChange={(val) => val && void onAddTaskLabel(val)}
                          className="min-w-[170px] max-w-full"
                          buttonClassName="!h-9 !px-3 !rounded-lg !text-sm"
                          showButtonAvatar={false}
                          showOptionAvatar={false}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewLabelForm(!showNewLabelForm)}
                          aria-label={showNewLabelForm ? 'Скрыть форму новой метки' : 'Добавить новую метку'}
                          title={showNewLabelForm ? 'Скрыть форму' : 'Добавить метку'}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#CFE0F5] bg-[#EFF6FF] text-[#1E88E5] transition hover:bg-[#DBEAFE]"
                        >
                          <MaterialSymbol name={showNewLabelForm ? 'close' : 'add'} size={14} color="currentColor" />
                        </button>
                      </div>
                    )}
                  </div>
                  {showNewLabelForm && (
                    <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="Имя..."
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-[#3F51B5]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCreateLabel()
                          }
                        }}
                      />
                      <input
                        type="color"
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="h-9 w-9 shrink-0 rounded-lg border border-[#DDE3EE] bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={handleCreateLabel}
                        disabled={!newLabelName.trim()}
                        className="h-9 rounded-lg bg-[#3F51B5] px-4 text-sm font-semibold text-white transition hover:bg-[#303F9F] disabled:opacity-50"
                      >
                        ОК
                      </button>
                    </div>
                  )}
                </div>
              </FieldRow>
            </div>
            <header className="flex shrink-0 items-center justify-between border-b border-[#E1E7F2] px-5 py-3.5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F86A8]">История</span>
                <p className="mt-1 text-[11px] leading-relaxed text-[#7B8DAA]">
                  {historyItems.length > 0 ? `${historyItems.length} событий` : 'Изменения полей и статусов'}
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshActivity}
                disabled={activityLoading}
                aria-label="Обновить историю"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6F86A8] transition ${
                  activityLoading ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#EAEFF8] hover:text-[#3F51B5]'
                }`}
              >
                <span className={activityLoading ? 'animate-spin' : ''}>
                  <MaterialSymbol name="refresh" size={16} color="currentColor" />
                </span>
              </button>
            </header>
            <div className="flex-1 p-5 pb-6">
              <TaskHistoryList items={historyItems} loading={activityLoading} />
            </div>
          </aside>
        </main>

        {canDeleteTask ? (
          <footer className="flex items-center justify-start border-t border-[#E1E7F2] bg-white px-6 py-4">
            <button
              type="button"
              onClick={onDelete}
              className="h-10 rounded-xl border border-[#F3D5D5] bg-[#FFF5F5] px-4 text-sm font-semibold text-[#C53030] hover:bg-[#FEEEEE]"
            >
              Удалить
            </button>
          </footer>
        ) : null}
      </div>

      <AppConfirmDialog
        open={Boolean(attachmentToDelete)}
        title="Удаление файла"
        message={attachmentToDelete ? `Удалить файл «${attachmentToDelete.fileName}»?` : 'Удалить файл?'}
        confirmText="Удалить"
        isLoading={saving}
        onCancel={() => setAttachmentToDelete(null)}
        onConfirm={() => {
          if (!attachmentToDelete) return
          void onDeleteAttachment(attachmentToDelete.id).finally(() => {
            setAttachmentToDelete(null)
          })
        }}
      />

      {(previewLoading || preview) ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#091728]/60 p-4 backdrop-blur-[2px]">
          <div className="flex h-full max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#DCE4F1] bg-white shadow-[0_30px_80px_rgba(10,22,40,0.38)]">
            <header className="flex items-center justify-between gap-3 border-b border-[#E1E7F2] bg-[#F8F9FD] px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#0A1628]">{preview?.fileName || 'Вложение'}</p>
                <p className="mt-1 text-xs text-[#6F86A8]">
                  {preview?.mimeType || 'Файл'}
                  {currentPreviewIndex >= 0 ? ` • ${currentPreviewIndex + 1} из ${previewableAttachments.length}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {preview && previewableAttachments.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openAttachmentByIndex(currentPreviewIndex - 1)}
                      disabled={!canOpenPrevAttachment}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE3EE] bg-white px-3 text-xs font-semibold text-[#334E73] transition hover:bg-[#F3F7FE] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MaterialSymbol name="chevron_left" size={16} color="currentColor" />
                      <span>Предыдущий</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAttachmentByIndex(currentPreviewIndex + 1)}
                      disabled={!canOpenNextAttachment}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DDE3EE] bg-white px-2 text-[10px] font-semibold text-[#334E73] transition hover:bg-[#F3F7FE] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Вперед</span>
                      <MaterialSymbol name="chevron_right" size={14} color="currentColor" />
                    </button>
                  </>
                ) : null}
                {preview ? (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenPreviewInNewTab}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE3EE] bg-white px-3 text-xs font-semibold text-[#334E73] transition hover:bg-[#F3F7FE]"
                    >
                      <MaterialSymbol name="open_in_new" size={14} color="currentColor" />
                      <span>Открыть отдельно</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPreview}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE3EE] bg-white px-3 text-xs font-semibold text-[#334E73] transition hover:bg-[#F3F7FE]"
                    >
                      <MaterialSymbol name="download" size={14} color="currentColor" />
                      <span>Скачать</span>
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={closePreview}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE3EE] bg-white text-[#4D6486] transition hover:bg-[#F3F7FE]"
                  aria-label="Закрыть просмотр"
                >
                  <MaterialSymbol name="close" size={18} color="currentColor" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 bg-[#EEF4FB] p-4 sm:p-6">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#1E88E5] border-t-transparent" />
                </div>
              ) : preview ? (
                <div className="relative h-full">
                  {previewableAttachments.length > 1 && canOpenPrevAttachment ? (
                    <button
                      type="button"
                      onClick={() => openAttachmentByIndex(currentPreviewIndex - 1)}
                      className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-[#0F172A]/74 text-white shadow-[0_12px_30px_rgba(10,22,40,0.28)] transition hover:bg-[#163056]"
                      aria-label="Предыдущее вложение"
                    >
                      <MaterialSymbol name="chevron_left" size={22} color="currentColor" />
                    </button>
                  ) : null}

                  {previewableAttachments.length > 1 && canOpenNextAttachment ? (
                    <button
                      type="button"
                      onClick={() => openAttachmentByIndex(currentPreviewIndex + 1)}
                      className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-[#0F172A]/74 text-white shadow-[0_12px_30px_rgba(10,22,40,0.28)] transition hover:bg-[#163056]"
                      aria-label="Следующее вложение"
                    >
                      <MaterialSymbol name="chevron_right" size={22} color="currentColor" />
                    </button>
                  ) : null}

                  <AttachmentPreviewBody preview={preview} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#C8D5E8] bg-white/70 text-sm text-[#6F86A8]">
                  Предпросмотр недоступен
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {shareToast ? (
        <AppToast
          message={shareToast.message}
          variant={shareToast.variant}
          onClose={() => setShareToast(null)}
        />
      ) : null}
    </div>
  )
}

function SectionLabel({
  children,
  icon,
  iconOnClick,
  iconDisabled = false,
  iconSpinning = false,
  className,
}: {
  children: React.ReactNode
  icon?: string
  iconOnClick?: () => void
  iconDisabled?: boolean
  iconSpinning?: boolean
  className?: string
}) {
  return (
    <div className={`mb-2 flex items-center justify-between ${className || ''}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F86A8]">{children}</span>
      {icon ? (
        <button
          type="button"
          onClick={iconOnClick}
          disabled={iconDisabled}
          className={`flex h-5 w-5 items-center justify-center rounded transition ${
            iconOnClick && !iconDisabled ? 'cursor-pointer hover:bg-[#EAEFF8] hover:text-[#3F51B5]' : ''
          }`}
        >
          <span className={iconSpinning ? 'animate-spin' : ''}>
            <MaterialSymbol name={icon} size={14} color="#6F86A8" />
          </span>
        </button>
      ) : null}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[108px_1fr] items-start gap-4 py-1">
      <span className="pt-2 text-xs font-semibold text-[#5E7596]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function AttachmentPreviewBody({ preview }: { preview: AttachmentPreviewState }) {
  switch (preview.kind) {
    case 'image':
      return (
        <div className="flex h-full items-center justify-center overflow-auto rounded-2xl border border-[#DCE4F1] bg-white p-4">
          <img
            src={preview.objectUrl}
            alt={preview.fileName}
            className="max-h-full max-w-full rounded-xl object-contain shadow-[0_16px_40px_rgba(10,22,40,0.14)]"
          />
        </div>
      )
    case 'video':
      return (
        <div className="flex h-full items-center justify-center rounded-2xl border border-[#DCE4F1] bg-[#07111F] p-4">
          <video src={preview.objectUrl} controls className="max-h-full w-full rounded-xl bg-black" />
        </div>
      )
    case 'audio':
      return (
        <div className="flex h-full items-center justify-center rounded-2xl border border-[#DCE4F1] bg-white p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-[#E1E7F2] bg-[#F8F9FD] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF1FC] text-[#2D4D80]">
                <MaterialSymbol name="graphic_eq" size={24} color="currentColor" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#0A1628]">{preview.fileName}</p>
                <p className="mt-1 text-xs text-[#6F86A8]">{preview.mimeType || 'Аудио'}</p>
              </div>
            </div>
            <audio src={preview.objectUrl} controls className="w-full" />
          </div>
        </div>
      )
    case 'pdf':
      return (
        <div className="h-full rounded-2xl border border-[#DCE4F1] bg-white p-2">
          <iframe title={preview.fileName} src={preview.objectUrl} className="h-full w-full rounded-xl" />
        </div>
      )
    case 'text':
      return (
        <div className="h-full overflow-auto rounded-2xl border border-[#DCE4F1] bg-white p-4">
          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[#1A2D45]">
            {preview.textContent || 'Файл пуст.'}
          </pre>
        </div>
      )
    default:
      return (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#C8D5E8] bg-white p-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF1FC] text-[#2D4D80]">
              <MaterialSymbol name="insert_drive_file" size={28} color="currentColor" />
            </div>
            <p className="text-base font-bold text-[#0A1628]">{preview.fileName}</p>
            <p className="mt-2 text-sm text-[#5B7193]">
              Для этого типа файла нет встроенного предпросмотра. Можно открыть его в новой вкладке или скачать.
            </p>
          </div>
        </div>
      )
  }
}
