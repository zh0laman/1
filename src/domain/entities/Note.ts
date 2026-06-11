export type NoteType = 'text' | 'checklist' | 'rich'

export interface NoteChecklistItem {
  id: string
  text: string
  is_done: boolean
  position?: number
  checked?: boolean
}

export interface NoteContentRun {
  text: string
  marks?: string[]
}

export interface NoteContentBlock {
  id: string
  type: 'paragraph' | 'checklist' | 'table' | 'image'
  runs?: NoteContentRun[]
  items?: NoteChecklistItem[]
  rows?: { text: string; html?: string }[][]
  attachmentId?: string
  alt?: string
}

export interface NoteContentDoc {
  type: 'doc'
  version: number
  blocks: NoteContentBlock[]
}

export interface NoteAttachment {
  file_id: string
  id?: string
  real_name: string
  mime_type: string
  size: number
  download_url: string | null
  status: string
  width?: number | null
  height?: number | null
  created_at?: string | null
}

export interface Note {
  id: string
  user_id?: number
  folder_id: string | null
  title: string
  content: string
  content_doc: NoteContentDoc | null
  content_text?: string | null
  type: NoteType
  checklist_items: NoteChecklistItem[]
  is_pinned: boolean
  is_archived: boolean
  is_deleted: boolean
  deleted_at?: string | null
  created_at: string
  updated_at: string
  version: number
  attachments: NoteAttachment[]
}

export interface NoteFolder {
  id: string
  user_id?: number
  name: string
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface NotesListParams {
  folderId?: string | null
  isDeleted?: boolean
  isArchived?: boolean
  q?: string
  limit?: number
  cursor?: string | null
}

export interface NotesListResult {
  items: Note[]
  nextCursor: string | null
}

export interface CreateNoteInput {
  title: string
  content: string
  type: NoteType
  folder_id?: string | null
  content_doc?: NoteContentDoc | null
  checklist_items?: NoteChecklistItem[]
  is_pinned?: boolean
  is_archived?: boolean
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  content_doc?: NoteContentDoc | null
  type?: NoteType
  checklist_items?: NoteChecklistItem[]
  folder_id?: string | null
  is_pinned?: boolean
  is_archived?: boolean
  version: number
}

export interface NoteVersionPayload {
  version: number
}

export interface MoveNoteInput extends NoteVersionPayload {
  folder_id: string | null
}

export interface CreateFolderInput {
  name: string
  sort_order?: number
}

export interface UpdateFolderInput {
  name?: string
  sort_order?: number
}

export interface AttachmentPresignInput {
  mime_type: string
  size_bytes: number
}

export interface AttachmentPresignResult {
  attachment_id: string
  upload_url: string
  storage_key: string
  expires_at: string
}

export class NoteVersionConflictError extends Error {
  readonly code = 'NOTE_VERSION_CONFLICT'

  constructor(message = 'Заметка была изменена в другой сессии') {
    super(message)
    this.name = 'NoteVersionConflictError'
  }
}
