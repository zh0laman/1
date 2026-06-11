import type {
  AttachmentPresignInput,
  AttachmentPresignResult,
  CreateFolderInput,
  CreateNoteInput,
  MoveNoteInput,
  Note,
  NoteFolder,
  NotesListParams,
  NotesListResult,
  NoteVersionPayload,
  UpdateFolderInput,
  UpdateNoteInput,
} from '../entities/Note'

export interface NoteRepository {
  listNotes(params?: NotesListParams): Promise<NotesListResult>
  getNote(id: string): Promise<Note>
  createNote(input: CreateNoteInput): Promise<Note>
  updateNote(id: string, input: UpdateNoteInput): Promise<Note>
  pinNote(id: string, payload: NoteVersionPayload): Promise<Note>
  unpinNote(id: string, payload: NoteVersionPayload): Promise<Note>
  moveNote(id: string, input: MoveNoteInput): Promise<Note>
  deleteNote(id: string, payload: NoteVersionPayload): Promise<void>
  restoreNote(id: string, payload: NoteVersionPayload): Promise<Note>
  hardDeleteNote(id: string, payload: NoteVersionPayload): Promise<void>

  listFolders(): Promise<NoteFolder[]>
  createFolder(input: CreateFolderInput): Promise<NoteFolder>
  updateFolder(id: string, input: UpdateFolderInput): Promise<NoteFolder>
  deleteFolder(id: string): Promise<void>

  presignAttachment(noteId: string, input: AttachmentPresignInput): Promise<AttachmentPresignResult>
  completeAttachment(noteId: string, attachmentId: string): Promise<Note>
  deleteAttachment(noteId: string, fileId: string): Promise<void>
  uploadAttachmentFile(uploadUrl: string, file: File, mimeType: string): Promise<void>

  deleteTableColumn(noteId: string, blockId: string, colIndex: number): Promise<void>
  clearTableCell(noteId: string, blockId: string, rowIndex: number, colIndex: number): Promise<void>
}
