import { useEffect, useRef, useState } from 'react'
import type { BoardCommentViewModel } from '../../../view-models/BoardViewModel'
import type { BoardTask } from '../../../../domain/entities/board/BoardModels'
import AppConfirmDialog from '../../../../shared/ui/AppConfirmDialog'
import MaterialSymbol from '../../../../shared/ui/MaterialSymbol'

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png'])
const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png']
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac'])
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.log', '.csv', '.xml', '.yaml', '.yml'])

type AttachmentPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported'

const isSupportedCommentPhoto = (file: File): boolean => {
  if (file.type && ALLOWED_PHOTO_MIME_TYPES.has(file.type.toLowerCase())) {
    return true
  }
  const lowerName = file.name.toLowerCase()
  return ALLOWED_PHOTO_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

const getFileExtension = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase()
  const index = normalized.lastIndexOf('.')
  return index >= 0 ? normalized.slice(index) : ''
}

const getFileNameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    const fromPath = parsed.pathname.split('/').pop()?.trim()
    return fromPath || 'Вложение'
  } catch {
    const fallback = url.split('/').pop()?.split('?')[0]?.trim()
    return fallback || 'Вложение'
  }
}

const resolveAttachmentPreviewKind = (mimeType: string, fileName: string): AttachmentPreviewKind => {
  const normalizedMime = mimeType.toLowerCase()
  const extension = getFileExtension(fileName)
  if (normalizedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (normalizedMime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (normalizedMime.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (normalizedMime === 'application/pdf' || extension === '.pdf') return 'pdf'
  if (normalizedMime.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) return 'text'
  return 'unsupported'
}

const getAttachmentPreviewIcon = (kind: AttachmentPreviewKind): string => {
  switch (kind) {
    case 'image': return 'image'
    case 'video': return 'movie'
    case 'audio': return 'audiotrack'
    case 'pdf': return 'picture_as_pdf'
    case 'text': return 'description'
    default: return 'insert_drive_file'
  }
}

/** Generate consistent avatar color from name */
const getAvatarColor = (name: string): string => {
  const colors = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#06B6D4', '#6366F1',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

interface BoardCommentsSectionProps {
  selectedTask: BoardTask | null
  comments: BoardCommentViewModel[]
  isLoading: boolean
  isSubmitting: boolean
  showContainer?: boolean
  showHeader?: boolean
  className?: string
  onCreateComment: (payload: { content: string }) => Promise<void>
  onCreatePhotoComment: (payload: { file: File; content?: string }) => Promise<void>
  onLoadAttachment: (url: string) => Promise<Blob>
  onOpenAttachment: (url: string) => Promise<void>
  onUpdateComment: (commentId: string, content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}

export default function BoardCommentsSection({
  selectedTask,
  comments,
  isLoading,
  isSubmitting,
  showContainer = true,
  showHeader = true,
  className = '',
  onCreateComment,
  onCreatePhotoComment,
  onLoadAttachment,
  onOpenAttachment,
  onUpdateComment,
  onDeleteComment,
}: BoardCommentsSectionProps) {
  const [text, setText] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingText, setEditingText] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleOpenCommentAttachment = (url: string) => {
    setAttachmentError('')
    void onOpenAttachment(url).catch((error) => {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Не удалось открыть вложение'
      setAttachmentError(message)
    })
  }

  const handleSend = () => {
    if (!text.trim()) return
    void onCreateComment({ content: text.trim() }).then(() => {
      setText('')
      setIsFocused(false)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const content = (
    <>
      {/* Header */}
      {showHeader && (
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EEF4FF]">
            <MaterialSymbol name="chat" size={14} color="#3B82F6" />
          </div>
          <h4 className="text-sm font-semibold text-[#0A1628]">
            Комментарии
            {comments.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#3B82F6] px-1 text-[10px] font-bold text-white">
                {comments.length}
              </span>
            )}
          </h4>
        </div>
      )}

      {/* Composer */}
      <div
        className={`rounded-xl border bg-white transition-all duration-150 ${
          isFocused
            ? 'border-[#3B82F6] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
            : 'border-[#DDE6F2]'
        } ${!selectedTask ? 'opacity-60' : ''}`}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { if (!text.trim()) setIsFocused(false) }}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedTask
              ? 'Напишите комментарий… (Ctrl+Enter для отправки)'
              : 'Сначала выберите задачу'
          }
          disabled={!selectedTask || isSubmitting}
          rows={isFocused || text ? 3 : 1}
          className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2 text-sm text-[#0A1628] placeholder:text-[#A0ADBF] outline-none disabled:cursor-not-allowed"
          style={{ transition: 'height 0.15s ease' }}
        />

        {(isFocused || text) && (
          <div className="flex items-center justify-between border-t border-[#EEF3FB] px-2.5 py-1.5">
            {/* Attach photo */}
            <label
              className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#7186A7] transition hover:bg-[#EEF3FB] hover:text-[#3B82F6] ${
                !selectedTask || isSubmitting ? 'cursor-not-allowed opacity-50' : ''
              }`}
              title="Прикрепить фото"
            >
              <MaterialSymbol name="image" size={16} color="currentColor" />
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="hidden"
                disabled={!selectedTask || isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file && selectedTask) {
                    if (!isSupportedCommentPhoto(file)) {
                      setPhotoError('Допустимы только изображения JPG и PNG.')
                      event.target.value = ''
                      return
                    }
                    setPhotoError('')
                    void onCreatePhotoComment({ file, content: text.trim() || undefined })
                    event.target.value = ''
                    setText('')
                    setIsFocused(false)
                  }
                }}
              />
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setText(''); setIsFocused(false) }}
                className="h-7 rounded-lg px-2.5 text-xs font-medium text-[#7186A7] transition hover:bg-[#F4F6FA] hover:text-[#0A1628]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!selectedTask || isSubmitting || !text.trim()}
                onClick={handleSend}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-xs font-semibold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <MaterialSymbol name="send" size={12} color="currentColor" />
                )}
                Отправить
              </button>
            </div>
          </div>
        )}
      </div>

      {photoError && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-[#EF4444]">
          <MaterialSymbol name="error" size={12} color="currentColor" />
          {photoError}
        </p>
      )}

      {/* Comment list */}
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#EEF3FB]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-full bg-[#EEF3FB]" />
                <div className="h-10 animate-pulse rounded-xl bg-[#EEF3FB]" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length ? (
        <div className="mt-4 divide-y divide-[#F0F4FB]">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isEditing={editingId === comment.id}
              editingText={editingText}
              isSubmitting={isSubmitting}
              onEditStart={() => {
                setEditingId(comment.id)
                setEditingText(comment.content)
              }}
              onEditChange={setEditingText}
              onEditSave={() => {
                if (!editingText.trim()) return
                void onUpdateComment(comment.id, editingText.trim()).then(() => {
                  setEditingId('')
                  setEditingText('')
                })
              }}
              onEditCancel={() => {
                setEditingId('')
                setEditingText('')
              }}
              onDelete={() => setDeletingId(comment.id)}
              onLoadAttachment={onLoadAttachment}
              onOpenAttachment={() => handleOpenCommentAttachment(comment.attachmentUrl)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#DDE6F2] py-6 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F5FF]">
            <MaterialSymbol name="chat_bubble_outline" size={18} color="#93B4D8" />
          </div>
          <p className="text-xs font-medium text-[#8497B4]">Комментариев пока нет</p>
          <p className="text-[11px] text-[#B0C0D8]">Будьте первым, кто оставит комментарий</p>
        </div>
      )}

      {attachmentError && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-[#EF4444]">
          <MaterialSymbol name="error" size={12} color="currentColor" />
          {attachmentError}
        </p>
      )}

      <AppConfirmDialog
        open={Boolean(deletingId)}
        title="Удаление комментария"
        message="Удалить комментарий?"
        confirmText="Удалить"
        isLoading={isSubmitting}
        onCancel={() => setDeletingId('')}
        onConfirm={() => {
          if (!deletingId) return
          void onDeleteComment(deletingId).finally(() => setDeletingId(''))
        }}
      />
    </>
  )

  if (!showContainer) {
    return <div className={className}>{content}</div>
  }

  return (
    <section className={`rounded-xl border border-[#E2EAF5] bg-white p-3 ${className}`}>
      {content}
    </section>
  )
}

/* ─── CommentItem ─── */
function CommentItem({
  comment,
  isEditing,
  editingText,
  isSubmitting,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  onLoadAttachment,
  onOpenAttachment,
}: {
  comment: BoardCommentViewModel
  isEditing: boolean
  editingText: string
  isSubmitting: boolean
  onEditStart: () => void
  onEditChange: (v: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: () => void
  onLoadAttachment: (url: string) => Promise<Blob>
  onOpenAttachment: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const avatarColor = getAvatarColor(comment.authorName)
  const initials = getInitials(comment.authorName)

  return (
    <div
      className="group relative flex gap-3 px-1 py-3 transition-colors duration-100 hover:bg-[#F8FBFF] first:pt-3 last:pb-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
        style={{ background: avatarColor }}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pr-16">
        {/* Author + time */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#0A1628]">{comment.authorName}</span>
          <span className="text-[11px] text-[#B0BFCF]">{comment.createdAtLabel}</span>
        </div>

        {isEditing ? (
          <div className="mt-2">
            <div className="overflow-hidden rounded-xl border border-[#3B82F6] bg-white shadow-[0_0_0_3px_rgba(59,130,246,0.10)]">
              <textarea
                value={editingText}
                autoFocus
                onChange={(e) => {
                  onEditChange(e.target.value)
                  // auto-grow
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    onEditSave()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    onEditCancel()
                  }
                }}
                rows={4}
                className="w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-[#0A1628] outline-none placeholder:text-[#A0ADBF]"
                style={{ minHeight: '90px' }}
              />
              <div className="flex items-center justify-between border-t border-[#EEF3FB] px-3 py-2">
                <span className="text-[11px] text-[#B0BFCF]">
                  Ctrl+Enter — сохранить · Esc — отмена
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onEditCancel}
                    className="h-7 rounded-lg border border-[#DDE6F2] bg-white px-3 text-xs font-medium text-[#5A7399] transition hover:bg-[#F4F6FA] hover:text-[#0A1628]"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={onEditSave}
                    disabled={isSubmitting || !editingText.trim()}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-xs font-semibold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {comment.content && (
              <p className="mt-1 break-words whitespace-pre-wrap text-[13px] leading-[1.55] text-[#344A64]">
                {comment.content}
              </p>
            )}
            {comment.attachmentUrl && (
              <CommentAttachmentPreview
                attachmentUrl={comment.attachmentUrl}
                disabled={isSubmitting}
                onLoadAttachment={onLoadAttachment}
                onOpen={onOpenAttachment}
                onDelete={onDelete}
              />
            )}
          </>
        )}
      </div>

      {/* Hover actions — top-right corner */}
      {!isEditing && (
        <div
          className={`absolute right-1 top-2.5 flex items-center gap-0.5 rounded-lg border border-[#E2EAF5] bg-white p-0.5 shadow-md transition-all duration-150 ${
            hovered ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-1'
          }`}
        >
          <button
            type="button"
            onClick={onEditStart}
            title="Редактировать"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#7186A7] transition hover:bg-[#EEF3FB] hover:text-[#3B82F6]"
          >
            <MaterialSymbol name="edit" size={13} color="currentColor" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Удалить"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#7186A7] transition hover:bg-[#FEF2F2] hover:text-[#EF4444]"
          >
            <MaterialSymbol name="delete" size={13} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── CommentAttachmentPreview ─── */
function CommentAttachmentPreview({
  attachmentUrl,
  disabled,
  onLoadAttachment,
  onOpen,
  onDelete,
}: {
  attachmentUrl: string
  disabled: boolean
  onLoadAttachment: (url: string) => Promise<Blob>
  onOpen: () => void
  onDelete: () => void
}) {
  const fileName = getFileNameFromUrl(attachmentUrl)
  const initialKind = resolveAttachmentPreviewKind('', fileName)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [resolvedKind, setResolvedKind] = useState<AttachmentPreviewKind>(initialKind)

  useEffect(() => {
    let cancelled = false
    let localObjectUrl = ''

    void onLoadAttachment(attachmentUrl)
      .then((blob) => {
        if (cancelled) return
        const nextKind = resolveAttachmentPreviewKind(blob.type || '', fileName)
        setResolvedKind(nextKind)
        if (nextKind === 'image' || nextKind === 'video') {
          localObjectUrl = URL.createObjectURL(blob)
          setPreviewUrl(localObjectUrl)
        } else {
          setPreviewUrl('')
        }
      })
      .catch(() => {
        if (cancelled) return
        setPreviewFailed(true)
      })
      .finally(() => {
        if (cancelled) return
        setPreviewLoading(false)
      })

    return () => {
      cancelled = true
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl)
    }
  }, [attachmentUrl, fileName, onLoadAttachment])

  return (
    <div className="mt-1.5 inline-block max-w-[180px] overflow-hidden rounded-lg border border-[#DDE6F2] bg-white shadow-sm">
      <div className="group/card relative">
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
        >
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-b from-[#F8FBFF] to-[#EEF3FB]">
            {(resolvedKind === 'image' || resolvedKind === 'video') && previewUrl ? (
              resolvedKind === 'image' ? (
                <img
                  src={previewUrl}
                  alt={fileName}
                  className="h-full w-full object-cover transition duration-200 group-hover/card:scale-[1.04]"
                />
              ) : (
                <>
                  <video src={previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 to-black/25" />
                  <div className="pointer-events-none absolute flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1A3F73] shadow-md">
                    <MaterialSymbol name="play_arrow" size={20} color="currentColor" />
                  </div>
                </>
              )
            ) : previewLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#3A5D8F] shadow-sm">
                <MaterialSymbol name={getAttachmentPreviewIcon(resolvedKind)} size={20} color="currentColor" />
              </div>
            )}
          </div>
          <div className="px-2 py-1.5">
            <p className="truncate text-[11px] font-medium text-[#334E73]">{fileName}</p>
            {previewFailed && <p className="text-[10px] text-[#8497B4]">Миниатюра не загрузилась</p>}
          </div>
        </button>

        {/* Overlay actions */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100">
          <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 disabled:cursor-not-allowed"
            aria-label="Открыть"
          >
            <MaterialSymbol name="zoom_in" size={13} color="currentColor" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition hover:bg-[#DC2626]/90 disabled:cursor-not-allowed"
            aria-label="Удалить"
          >
            <MaterialSymbol name="delete" size={13} color="currentColor" />
          </button>
        </div>
      </div>
    </div>
  )
}
