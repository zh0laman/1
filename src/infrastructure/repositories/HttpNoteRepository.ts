import type {
  AttachmentPresignInput,
  AttachmentPresignResult,
  CreateFolderInput,
  CreateNoteInput,
  MoveNoteInput,
  Note,
  NoteAttachment,
  NoteChecklistItem,
  NoteContentDoc,
  NoteFolder,
  NotesListParams,
  NotesListResult,
  NoteVersionPayload,
  UpdateFolderInput,
  UpdateNoteInput,
} from '../../domain/entities/Note'
import { NoteVersionConflictError } from '../../domain/entities/Note'
import type { NoteRepository } from '../../domain/repositories/NoteRepository'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { authorizedFetch } from '../http/authorizedFetch'
import { HttpError, parseHttpError } from '../http/HttpError'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'

interface NoteDto {
  id: string
  user_id?: number
  folder_id?: string | null
  title?: string
  content?: string
  content_doc?: NoteContentDoc | null
  content_text?: string | null
  type?: string
  checklist_items?: NoteChecklistItem[]
  is_pinned?: boolean
  is_archived?: boolean
  is_deleted?: boolean
  deleted_at?: string | null
  created_at?: string
  updated_at?: string
  version?: number
  attachments?: NoteAttachmentDto[]
}

interface NoteAttachmentDto {
  file_id?: string
  id?: string
  real_name?: string
  mime_type?: string
  size?: number
  download_url?: string | null
  status?: string
  width?: number | null
  height?: number | null
  created_at?: string | null
}

interface NotesListResponseDto {
  data?: NoteDto[] | { items?: NoteDto[]; notes?: NoteDto[]; next_cursor?: string | null }
  next_cursor?: string | null
  nextCursor?: string | null
}

interface FolderDto {
  id: string
  user_id?: number
  name: string
  sort_order?: number
  created_at?: string
  updated_at?: string
}

interface PresignResponseDto {
  attachment_id: string
  upload_url: string
  storage_key: string
  expires_at: string
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await parseHttpError(response)
  }
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

const unwrapNote = (payload: unknown): NoteDto => {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError('Некорректный ответ сервера', 500)
  }
  const obj = payload as Record<string, unknown>
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const inner = obj.data as Record<string, unknown>
    if (inner.note && typeof inner.note === 'object') {
      return inner.note as unknown as NoteDto
    }
    return inner as unknown as NoteDto
  }
  if (obj.note && typeof obj.note === 'object') {
    return obj.note as unknown as NoteDto
  }
  return obj as unknown as NoteDto
}

const mapAttachment = (dto: NoteAttachmentDto): NoteAttachment => {
  const fileId = dto.file_id ?? dto.id ?? ''
  const downloadUrl = normalizeBackendAssetUrl(dto.download_url) ?? dto.download_url ?? null
  return {
    file_id: fileId,
    id: fileId,
    real_name: dto.real_name ?? '',
    mime_type: dto.mime_type ?? 'application/octet-stream',
    size: dto.size ?? 0,
    download_url: downloadUrl,
    status: dto.status ?? 'ready',
    width: dto.width ?? null,
    height: dto.height ?? null,
    created_at: dto.created_at ?? null,
  }
}

const mapNote = (dto: NoteDto): Note => ({
  id: dto.id,
  user_id: dto.user_id,
  folder_id: dto.folder_id ?? null,
  title: dto.title ?? '',
  content: dto.content ?? '',
  content_doc: dto.content_doc ?? null,
  content_text: dto.content_text ?? null,
  type: (dto.type === 'checklist' || dto.type === 'rich' ? dto.type : 'text') as Note['type'],
  checklist_items: (dto.checklist_items ?? []).map((item) => ({
    ...item,
    is_done: Boolean(item.is_done ?? item.checked),
    checked: Boolean(item.checked ?? item.is_done),
  })),
  is_pinned: Boolean(dto.is_pinned),
  is_archived: Boolean(dto.is_archived),
  is_deleted: Boolean(dto.is_deleted),
  deleted_at: dto.deleted_at ?? null,
  created_at: dto.created_at ?? new Date().toISOString(),
  updated_at: dto.updated_at ?? new Date().toISOString(),
  version: dto.version ?? 1,
  attachments: (dto.attachments ?? []).map(mapAttachment),
})

const mapFolder = (dto: FolderDto): NoteFolder => ({
  id: dto.id,
  user_id: dto.user_id,
  name: dto.name,
  sort_order: dto.sort_order ?? 0,
  created_at: dto.created_at,
  updated_at: dto.updated_at,
})

const parseNotesList = (payload: NotesListResponseDto): NotesListResult => {
  let items: NoteDto[] = []
  let nextCursor: string | null = null

  if (Array.isArray(payload.data)) {
    items = payload.data
    nextCursor = payload.next_cursor ?? payload.nextCursor ?? null
  } else if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as { items?: NoteDto[]; notes?: NoteDto[]; next_cursor?: string | null }
    items = nested.items ?? nested.notes ?? []
    nextCursor = nested.next_cursor ?? payload.next_cursor ?? payload.nextCursor ?? null
  }

  return {
    items: items.map(mapNote),
    nextCursor: nextCursor || null,
  }
}

const parseFolders = (payload: unknown): NoteFolder[] => {
  if (Array.isArray(payload)) {
    return payload.map((item) => mapFolder(item as FolderDto))
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: FolderDto[]; items?: FolderDto[]; folders?: FolderDto[] }
    const list = obj.data ?? obj.items ?? obj.folders ?? []
    if (Array.isArray(list)) {
      return list.map(mapFolder)
    }
  }
  return []
}

export class HttpNoteRepository implements NoteRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await authorizedFetch(this.sessionStore, path, init)
    return parseJson<T>(response)
  }

  private async requestNote(path: string, init: RequestInit = {}): Promise<Note> {
    try {
      const payload = await this.request<unknown>(path, init)
      return mapNote(unwrapNote(payload))
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        throw new NoteVersionConflictError(error.message)
      }
      throw error
    }
  }

  async listNotes(params: NotesListParams = {}): Promise<NotesListResult> {
    const search = new URLSearchParams()
    const limit = params.limit ?? 20
    search.set('limit', String(limit))
    if (params.folderId) search.set('folderId', params.folderId)
    if (params.isDeleted !== undefined) search.set('isDeleted', String(params.isDeleted))
    if (params.isArchived !== undefined) search.set('isArchived', String(params.isArchived))
    if (params.q?.trim()) search.set('q', params.q.trim())
    if (params.cursor) search.set('cursor', params.cursor)

    const payload = await this.request<NotesListResponseDto>(`/api/v1/notes?${search}`)
    return parseNotesList(payload)
  }

  getNote(id: string): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${id}`)
  }

  createNote(input: CreateNoteInput): Promise<Note> {
    return this.requestNote('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  pinNote(id: string, payload: NoteVersionPayload): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${id}/pin`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  unpinNote(id: string, payload: NoteVersionPayload): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${id}/unpin`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  moveNote(id: string, input: MoveNoteInput): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${id}/move`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async deleteNote(id: string, payload: NoteVersionPayload): Promise<void> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/notes/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw await parseHttpError(response)
    }
  }

  restoreNote(id: string, payload: NoteVersionPayload): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async hardDeleteNote(id: string, payload: NoteVersionPayload): Promise<void> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/notes/${id}/hard`, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw await parseHttpError(response)
    }
  }

  async listFolders(): Promise<NoteFolder[]> {
    const payload = await this.request<unknown>('/api/v1/notes/folders')
    return parseFolders(payload).sort((a, b) => a.sort_order - b.sort_order)
  }

  async createFolder(input: CreateFolderInput): Promise<NoteFolder> {
    const payload = await this.request<FolderDto>('/api/v1/notes/folders', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return mapFolder(payload)
  }

  async updateFolder(id: string, input: UpdateFolderInput): Promise<NoteFolder> {
    const payload = await this.request<FolderDto>(`/api/v1/notes/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return mapFolder(payload)
  }

  async deleteFolder(id: string): Promise<void> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/notes/folders/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw await parseHttpError(response)
    }
  }

  async presignAttachment(noteId: string, input: AttachmentPresignInput): Promise<AttachmentPresignResult> {
    return this.request<PresignResponseDto>(`/api/v1/notes/${noteId}/attachments/presign`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  completeAttachment(noteId: string, attachmentId: string): Promise<Note> {
    return this.requestNote(`/api/v1/notes/${noteId}/attachments/${attachmentId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async deleteAttachment(noteId: string, fileId: string): Promise<void> {
    const response = await authorizedFetch(
      this.sessionStore,
      `/api/v1/notes/${noteId}/attachments/${fileId}`,
      { method: 'DELETE' },
    )
    if (!response.ok) {
      throw await parseHttpError(response)
    }
  }

  async uploadAttachmentFile(uploadUrl: string, file: File, mimeType: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: file,
    })
    if (!response.ok) {
      throw new HttpError('Не удалось загрузить файл в хранилище', response.status)
    }
  }

  async deleteTableColumn(noteId: string, blockId: string, colIndex: number): Promise<void> {
    const paths = [
      `/api/v1/notes/${noteId}/tables/${blockId}/columns/${colIndex}`,
      `/api/v1/notes/${noteId}/table/${blockId}/columns/${colIndex}`,
    ]
    let lastError: HttpError | null = null
    for (const path of paths) {
      const response = await authorizedFetch(this.sessionStore, path, { method: 'DELETE' })
      if (response.ok) return
      lastError = await parseHttpError(response)
      if (response.status !== 404) break
    }
    if (lastError) throw lastError
  }

  async clearTableCell(noteId: string, blockId: string, rowIndex: number, colIndex: number): Promise<void> {
    const paths = [
      `/api/v1/notes/${noteId}/tables/${blockId}/cells/${rowIndex}/${colIndex}`,
      `/api/v1/notes/${noteId}/table/${blockId}/cells/${rowIndex}/${colIndex}`,
    ]
    let lastError: HttpError | null = null
    for (const path of paths) {
      const response = await authorizedFetch(this.sessionStore, path, { method: 'DELETE' })
      if (response.ok) return
      lastError = await parseHttpError(response)
      if (response.status !== 404) break
    }
    if (lastError) throw lastError
  }
}
