import { useEffect, useState } from 'react'
import type { BoardAttachment } from '../../../domain/entities/board/BoardModels'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

type AttachmentPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac'])
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.log', '.csv', '.xml', '.yaml', '.yml'])

const getFileExtension = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase()
  const index = normalized.lastIndexOf('.')
  return index >= 0 ? normalized.slice(index) : ''
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

const formatAttachmentSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getAttachmentPreviewIcon = (kind: AttachmentPreviewKind): string => {
  switch (kind) {
    case 'image':
      return 'image'
    case 'video':
      return 'movie'
    case 'audio':
      return 'audiotrack'
    case 'pdf':
      return 'picture_as_pdf'
    case 'text':
      return 'description'
    default:
      return 'insert_drive_file'
  }
}

const getAttachmentPreviewHint = (kind: AttachmentPreviewKind): string => {
  switch (kind) {
    case 'image':
      return 'Изображение можно увеличить по нажатию.'
    case 'video':
      return 'Видео откроется в увеличенном просмотре.'
    case 'audio':
      return 'Аудио откроется во встроенном плеере.'
    case 'pdf':
      return 'PDF откроется прямо в просмотрщике.'
    case 'text':
      return 'Текстовый файл откроется без скачивания.'
    default:
      return 'Нажмите, чтобы открыть вложение.'
  }
}

interface TaskAttachmentCardProps {
  attachment: BoardAttachment
  onLoadAttachment: (url: string) => Promise<Blob>
  onOpenAttachment: (input: { url: string; fileName?: string; mimeType?: string; blob?: Blob }) => Promise<void>
  onDelete?: () => void
  deleteDisabled?: boolean
}

export default function TaskAttachmentCard({
  attachment,
  onLoadAttachment,
  onOpenAttachment,
  onDelete,
  deleteDisabled = false,
}: TaskAttachmentCardProps) {
  const fileName = attachment.fileName || 'Файл без имени'
  const kind = resolveAttachmentPreviewKind(attachment.mimeType || '', fileName)
  const isInlinePreview = kind === 'image' || kind === 'video'
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(Boolean(attachment.downloadUrl && isInlinePreview))
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    if (!attachment.downloadUrl || !isInlinePreview) return

    let cancelled = false
    let localObjectUrl = ''

    void onLoadAttachment(attachment.downloadUrl)
      .then((blob) => {
        if (cancelled) return
        localObjectUrl = URL.createObjectURL(blob)
        setPreviewBlob(blob)
        setPreviewUrl(localObjectUrl)
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
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl)
      }
    }
  }, [attachment.downloadUrl, isInlinePreview, onLoadAttachment])

  const handleOpen = () => {
    if (!attachment.downloadUrl) return

    void onOpenAttachment({
      url: attachment.downloadUrl,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      blob: previewBlob ?? undefined,
    }).catch(() => {})
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#DDE6F2] bg-white shadow-[0_10px_24px_rgba(10,22,40,0.06)]">
      <button
        type="button"
        onClick={handleOpen}
        disabled={!attachment.downloadUrl}
        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF3FB_100%)]">
          {isInlinePreview && previewUrl ? (
            kind === 'image' ? (
              <img
                src={previewUrl}
                alt={fileName}
                className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
              />
            ) : (
              <>
                <video src={previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,31,0.06)_0%,rgba(7,17,31,0.28)_100%)]" />
                <div className="pointer-events-none absolute flex h-12 w-12 items-center justify-center rounded-full bg-white/92 text-[#1A3F73] shadow-[0_10px_20px_rgba(10,22,40,0.16)]">
                  <MaterialSymbol name="play_arrow" size={24} color="currentColor" />
                </div>
              </>
            )
          ) : previewLoading ? (
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#1E88E5] border-t-transparent" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#3A5D8F] shadow-[0_8px_20px_rgba(10,22,40,0.08)]">
                <MaterialSymbol name={getAttachmentPreviewIcon(kind)} size={24} color="currentColor" />
              </div>
              <p className="max-w-[180px] text-[11px] font-semibold text-[#58708F]">
                {previewFailed ? 'Миниатюра не загрузилась.' : getAttachmentPreviewHint(kind)}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[#E6ECF5] px-2.5 py-1.5">
          <p className="truncate text-sm font-semibold text-[#0A1628]">{fileName}</p>
          <p className="mt-1 text-xs text-[#8497B4]">{formatAttachmentSize(attachment.fileSize)}</p>
        </div>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        {attachment.downloadUrl ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-[#0F172A]/74 text-white shadow-[0_10px_24px_rgba(10,22,40,0.22)] transition hover:bg-[#163056]"
            aria-label="Открыть вложение"
          >
            <MaterialSymbol name="zoom_in" size={18} color="currentColor" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-[#0F172A]/74 text-white shadow-[0_10px_24px_rgba(10,22,40,0.22)] transition hover:bg-[#8D2433] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Удалить вложение"
          >
            <MaterialSymbol name="delete" size={18} color="currentColor" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
