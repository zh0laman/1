/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Note, NoteFolder } from '../../../domain/entities/Note'
import { NoteVersionConflictError } from '../../../domain/entities/Note'
import { HttpAlemAiRepository } from '../../../infrastructure/repositories/HttpAlemAiRepository'
import { authorizedFetch } from '../../../infrastructure/http/authorizedFetch'
import { HttpNoteRepository } from '../../../infrastructure/repositories/HttpNoteRepository'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import { normalizeBackendAssetUrl } from '../../../infrastructure/http/normalizeBackendAssetUrl'
import ChatPickerModal from '../../../presentation/components/messenger/ChatPickerModal'
import AppToast from '../../../shared/ui/AppToast'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import AppModal from '../../../shared/ui/AppModal'
import AppButton from '../../../shared/ui/AppButton'
import {
  bid,
  buildAbsoluteNoteUrl,
  buildNotesUrl,
  docOf,
  draftKey,
  emptyDoc,
  hasRich,
  isChecklistOnly,
  isNoteNotFoundError,
  textOf,
  titleOf,
  type NoteBlock,
  type NoteDoc,
} from './noteDocumentUtils'
import NotesMeetingAiPanel from './NotesMeetingAiPanel'

type Mode = 'notes' | 'meeting-ai' | 'archive' | 'trash'
type Block = NoteBlock
type Doc = NoteDoc
type Folder = NoteFolder

const c = {
  bg: '#FFFFFF',
  panel: '#FFFFFF',
  glass: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#DDE3EE',
  borderHover: '#EAEFF8',
  text: '#0A1628',
  muted: '#8497B4',
  accent: '#0A1628',
  primary: '#1E88E5',
  brand: '#1E88E5',
  danger: '#DC2626',
  success: '#15803D',
  indigo: '#4F46E5',
}
const dateOf = (v?: string) => {
  const d = new Date(v || '')
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const sameMarks = (a?: string[], b?: string[]) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort())
const colorMark = (marks?: string[]) => (marks ?? []).find((m) => m.startsWith('color:')) ?? ''
const stripColorMarks = (marks?: string[]) => (marks ?? []).filter((m) => !m.startsWith('color:'))
const toggleMarkInRuns = (runs: { text: string; marks?: string[] }[], start: number, end: number, markName: string) => {
  const textLength = runs.reduce((sum, run) => sum + run.text.length, 0)
  const from = Math.max(0, Math.min(start, end, textLength))
  const to = Math.max(0, Math.min(Math.max(start, end), textLength))
  if (from === to) return runs
  let pos = 0
  const selected = runs.filter((run) => { const s = pos; const e = pos + run.text.length; pos = e; return e > from && s < to })
  const shouldAdd = selected.some((run) => !(run.marks ?? []).includes(markName))
  pos = 0
  const next: { text: string; marks?: string[] }[] = []
  for (const run of runs) {
    const runStart = pos
    const runEnd = pos + run.text.length
    pos = runEnd
    if (runEnd <= from || runStart >= to) { next.push(run); continue }
    const localFrom = Math.max(0, from - runStart)
    const localTo = Math.min(run.text.length, to - runStart)
    if (localFrom > 0) next.push({ text: run.text.slice(0, localFrom), marks: run.marks })
    const marks = new Set(run.marks ?? [])
    shouldAdd ? marks.add(markName) : marks.delete(markName)
    next.push({ text: run.text.slice(localFrom, localTo), marks: [...marks] })
    if (localTo < run.text.length) next.push({ text: run.text.slice(localTo), marks: run.marks })
  }
  return next.filter((run) => run.text).reduce((merged, run) => {
    const prev = merged[merged.length - 1]
    if (prev && sameMarks(prev.marks, run.marks)) prev.text += run.text
    else merged.push({ text: run.text, marks: run.marks ?? [] })
    return merged
  }, [] as { text: string; marks?: string[] }[])
}

export default function NotesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useMemo(() => new LocalStorageAuthSessionStore(), [])
  const notesRepo = useMemo(() => new HttpNoteRepository(session), [session])
  const fileRef = useRef<HTMLInputElement | null>(null)
  const isDeleting = useRef(false)
  const hydrating = useRef(false)
  const openingNoteId = useRef('')
  const openNoteRequest = useRef(0)
  const lastDeletedNoteId = useRef<string | null>(null)
  const deletedIds = useRef<Set<string>>(new Set())
  const saveTimer = useRef<number | null>(null)
  const savedDraft = useRef('')
  const selectedText = useRef<{ blockId: string; start: number; end: number } | null>(null)
  const [mode, setMode] = useState<Mode>('notes')
  const [folders, setFolders] = useState<Folder[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderName, setFolderName] = useState('')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Note[]>([])
  const itemsRef = useRef<Note[]>([])
  useEffect(() => { itemsRef.current = items }, [items])
  const [cursor, setCursor] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [doc, setDoc] = useState<Doc>(emptyDoc)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const [err, setErr] = useState('')
  const [folderMenu, setFolderMenu] = useState<{ folder: Folder; x: number; y: number } | null>(null)
  const [renameFolderModal, setRenameFolderModal] = useState<Folder | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [activeMarks, setActiveMarks] = useState<string[]>([])
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [shareToast, setShareToast] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null)
  const showError = useCallback((msg: string) => setShareToast({ message: msg, variant: 'error' }), [])
  const showSuccess = useCallback((msg: string) => setShareToast({ message: msg, variant: 'success' }), [])
  const [isMobile, setIsMobile] = useState(false)
  const [view, setView] = useState<'folders' | 'list' | 'note'>('list')
  const [isChatPickerOpen, setIsChatPickerOpen] = useState(false)
  const [tablePicker, setTablePicker] = useState<{ x: number, y: number } | null>(null)
  const [isProofreading, setIsProofreading] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [aiSelection, setAiSelection] = useState<{ blockId: string; start: number; end: number; originalText: string } | null>(null)
  const [aiResult, setAiResult] = useState<{ type: 'proofread' | 'summarize', data: any } | null>(null)
  const alemAiRepository = useMemo(() => new HttpAlemAiRepository(session), [session])
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedNoteId = searchParams.get('noteId')?.trim() || ''

  const chatApi = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const response = await authorizedFetch(session, path, init)
      const text = await response.text()
      return text ? JSON.parse(text) : null
    },
    [session],
  )
  const syncNotesUrl = useCallback((noteId?: string) => {
    const nextUrl = buildNotesUrl(noteId)
    const currentUrl = `${location.pathname}${location.search}`

    if (currentUrl !== nextUrl) {
      navigate(nextUrl, { replace: true })
    }
  }, [location.pathname, location.search, navigate])
  const upsert = (n: Note) => setItems((prev) => (prev.some((x) => x.id === n.id) ? prev.map((x) => x.id === n.id ? n : x) : [n, ...prev]).sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()))
  const loadFolders = useCallback(async () => {
    try {
      setFolders(await notesRepo.listFolders())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить папки')
    }
  }, [notesRepo])

  const loadNotes = useCallback(async (reset = true) => {
    if (mode === 'meeting-ai') return
    setLoading(reset)
    setErr('')
    try {
      const result = await notesRepo.listNotes({
        limit: 20,
        isDeleted: mode === 'trash',
        isArchived: mode === 'archive',
        folderId: folderId && mode === 'notes' ? folderId : undefined,
        q: q.trim() || undefined,
        cursor: !reset && cursor ? cursor : undefined,
      })
      setItems((old) => (reset ? result.items : [...old, ...result.items]))
      setCursor(result.nextCursor ?? '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить заметки')
    } finally {
      setLoading(false)
    }
  }, [cursor, folderId, mode, notesRepo, q])
  const openNote = useCallback(async (id: string) => {
    if (id && deletedIds.current.has(id)) {
      if (requestedNoteId === id) syncNotesUrl()
      return
    }

    if (isActionPending || openingNoteId.current === id) return

    const requestId = openNoteRequest.current + 1
    openNoteRequest.current = requestId
    openingNoteId.current = id
    setIsActionPending(true)
    syncNotesUrl(id)

    try {
      const cachedNote = itemsRef.current.find((item) => item.id === id)
      if (cachedNote && note?.id !== id) {
        const cachedDoc = docOf(cachedNote)
        hydrating.current = true
        savedDraft.current = draftKey(cachedNote.title || '', cachedDoc)
        setNote(cachedNote)
        setTitle(cachedNote.title || '')
        setDoc(cachedDoc)
        window.setTimeout(() => {
          if (openNoteRequest.current === requestId) hydrating.current = false
        }, 0)
      }

      if (mode === 'trash' && cachedNote) {
        // Just load from cache and don't fetch full details to avoid 404 if backend hides deleted notes
        const cachedDoc = docOf(cachedNote)
        hydrating.current = true
        savedDraft.current = draftKey(cachedNote.title || '', cachedDoc)
        setNote(cachedNote)
        setTitle(cachedNote.title || '')
        setDoc(cachedDoc)
        window.setTimeout(() => {
          if (openNoteRequest.current === requestId) hydrating.current = false
        }, 0)
        return
      }

      const n = await notesRepo.getNote(id)
      if (openNoteRequest.current !== requestId) return

      const initialDoc = docOf(n)
      hydrating.current = true; savedDraft.current = draftKey(n.title || '', initialDoc); setNote(n); setTitle(n.title || ''); setDoc(initialDoc)
      setErr('') // Clear error on success
      if (n.id && n.id !== id) syncNotesUrl(n.id)
      window.setTimeout(() => { hydrating.current = false }, 0)
    } catch (e) {
      if (openNoteRequest.current === requestId) {
        const errorMsg = e instanceof Error ? e.message : 'Не удалось открыть заметку'
        showError(errorMsg)
        
        // If the note is not found, clear the URL and current note state to prevent infinite loops
        if (isNoteNotFoundError(e)) {
          deletedIds.current.add(id)
          setItems((old) => old.filter((item) => item.id !== id))
          setNote(null)
          syncNotesUrl()
        }
      }
    } finally {
      if (openNoteRequest.current === requestId) {
        openingNoteId.current = ''
        setIsActionPending(false)
      }
    }
  }, [mode, note?.id, notesRepo, syncNotesUrl, isActionPending])

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (!mobile) setView('list') // Reset to default on desktop
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (note && isMobile && view !== 'note') {
      setView('note')
    }
  }, [note, isMobile])

  useEffect(() => { const t = window.setTimeout(() => setQ(query), 450); return () => window.clearTimeout(t) }, [query])
  useEffect(() => { void loadFolders() }, [loadFolders])
  useEffect(() => { 
    setCursor(''); 
    deletedIds.current.clear();
    lastDeletedNoteId.current = null;
    void loadNotes(true) 
  }, [mode, folderId, q, loadNotes])
  useEffect(() => {
    if (!requestedNoteId || note?.id === requestedNoteId) return
    if (openingNoteId.current || isDeleting.current || requestedNoteId === lastDeletedNoteId.current || deletedIds.current.has(requestedNoteId)) return
    void openNote(requestedNoteId)
  }, [note?.id, openNote, requestedNoteId])
  useEffect(() => {
    const close = () => setFolderMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [])
  useEffect(() => {
    if (!note || hydrating.current || mode === 'trash' || mode === 'archive') return
    const currentDraft = draftKey(title, doc)
    if (currentDraft === savedDraft.current) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      const checklist = isChecklistOnly(doc)
      const body = {
        version: note.version,
        title,
        content: checklist ? '' : textOf(doc),
        content_doc: checklist ? null : doc,
        type: checklist ? 'checklist' : hasRich(doc) ? 'rich' : 'text',
        checklist_items: checklist ? doc.blocks[0].items : [],
      }
      setSaving(true)
      try {
        const n = await notesRepo.updateNote(note.id, body)
        savedDraft.current = currentDraft
        setNote(n)
        upsert(n)
      } catch (e) {
        if (e instanceof NoteVersionConflictError) {
          try {
            const fresh = await notesRepo.getNote(note.id)
            const mergedDoc = docOf(fresh)
            const retry = await notesRepo.updateNote(note.id, {
              ...body,
              version: fresh.version,
              content_doc: checklist ? null : mergedDoc,
            })
            savedDraft.current = draftKey(retry.title, docOf(retry))
            setNote(retry)
            setDoc(docOf(retry))
            upsert(retry)
            showError('Заметка была изменена в другой вкладке — изменения сохранены поверх актуальной версии')
          } catch (retryError) {
            setErr(retryError instanceof Error ? retryError.message : 'Конфликт версий при сохранении')
          }
        } else {
          setErr(e instanceof Error ? e.message : 'Не удалось сохранить заметку')
        }
      } finally {
        setSaving(false)
      }
    }, 700)
    return () => saveTimer.current && window.clearTimeout(saveTimer.current)
  }, [doc, mode, note, notesRepo, showError, title])

  const titleRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (note && titleRef.current) {
      const t = titleRef.current
      t.style.height = 'auto'
      t.style.height = `${t.scrollHeight}px`
    }
  }, [note, title])

  const createNote = async () => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const n = await notesRepo.createNote({
        folder_id: folderId,
        title: '',
        content: '',
        content_doc: emptyDoc(),
        type: 'text',
        checklist_items: [],
      })
      upsert(n)
      void openNote(n.id)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось создать заметку')
      setIsActionPending(false)
    }
  }
  const createFolder = async () => {
    if (!folderName.trim()) return
    await notesRepo.createFolder({ name: folderName.trim(), sort_order: folders.length })
    setFolderName('')
    await loadFolders()
  }
  const openRenameFolderModal = (folder: Folder) => {
    setRenameFolderModal(folder)
    setRenameFolderName(folder.name)
  }
  const renameFolder = async () => {
    if (!renameFolderModal) return
    const folder = renameFolderModal
    const name = renameFolderName.trim()
    if (!name || name === folder.name) return
    await notesRepo.updateFolder(folder.id, { name })
    setRenameFolderModal(null)
    setRenameFolderName('')
    await loadFolders()
  }
  const deleteFolder = async (folder: Folder) => {
    if (!window.confirm(`Удалить папку "${folder.name}"? Заметки останутся без папки.`)) return
    await notesRepo.deleteFolder(folder.id)
    if (folderId === folder.id) setFolderId(null)
    if (note?.folder_id === folder.id) setNote({ ...note, folder_id: null })
    await loadFolders()
  }
  const openFolderMenu = (event: React.MouseEvent, folder: Folder) => {
    event.preventDefault()
    event.stopPropagation()
    setFolderMenu({ folder, x: event.clientX, y: event.clientY })
  }
  const pin = async (n = note) => {
    if (!n) return
    const next = n.is_pinned
      ? await notesRepo.unpinNote(n.id, { version: n.version })
      : await notesRepo.pinNote(n.id, { version: n.version })
    if (note?.id === next.id) setNote(next)
    upsert(next)
  }
  const move = async (nextFolderId: string | null) => {
    if (!note) return
    const n = await notesRepo.moveNote(note.id, { folder_id: nextFolderId, version: note.version })
    setNote(n)
    upsert(n)
  }
  const del = async (n = note) => { 
    if (!n || isActionPending) return; 
    isDeleting.current = true;
    setIsActionPending(true)
    lastDeletedNoteId.current = n.id;
    deletedIds.current.add(n.id);
    try {
      await notesRepo.deleteNote(n.id, { version: n.version }) 
      setItems((old) => old.filter((x) => x.id !== n.id)); 
      if (note?.id === n.id) { setNote(null); syncNotesUrl() } 
      showSuccess('Заметка удалена в корзину')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось удалить заметку')
      deletedIds.current.delete(n.id)
    } finally {
      isDeleting.current = false;
      setIsActionPending(false)
      // Clear after a short delay to allow URL to sync
      window.setTimeout(() => { 
        if (lastDeletedNoteId.current === n.id) lastDeletedNoteId.current = null 
      }, 800)
    }
  }
  const restore = async () => { 
    if (!note || isActionPending) return; 
    isDeleting.current = true;
    setIsActionPending(true)
    if (note) deletedIds.current.add(note.id);
    try {
      await notesRepo.restoreNote(note.id, { version: note.version }) 
      setItems((old) => old.filter((x) => x.id !== note.id)); 
      setNote(null); 
      syncNotesUrl() 
      showSuccess('Заметка восстановлена')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось восстановить заметку')
      if (note) deletedIds.current.delete(note.id)
    } finally {
      isDeleting.current = false;
      setIsActionPending(false)
    }
  }
  const unarchive = async () => {
    if (!note || isActionPending) return
    setIsActionPending(true)
    try {
      await notesRepo.updateNote(note.id, { is_archived: false, version: note.version })
      setItems((old) => old.filter((x) => x.id !== note.id))
      setNote(null)
      syncNotesUrl()
      showSuccess('Заметка возвращена из архива')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось вернуть заметку из архива')
    } finally {
      setIsActionPending(false)
    }
  }
  const archiveNote = async () => {
    if (!note || isActionPending) return
    setIsActionPending(true)
    try {
      await notesRepo.updateNote(note.id, { is_archived: true, version: note.version })
      setItems((old) => old.filter((x) => x.id !== note.id))
      setNote(null)
      syncNotesUrl()
      showSuccess('Заметка отправлена в архив')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось отправить в архив')
    } finally {
      setIsActionPending(false)
    }
  }
  const onTableDeleteColumn = useCallback(async (blockId: string, colIndex: number) => {
    if (!note) return
    await notesRepo.deleteTableColumn(note.id, blockId, colIndex)
  }, [note, notesRepo])
  const onTableClearCell = useCallback(async (blockId: string, rowIndex: number, colIndex: number) => {
    if (!note) return
    await notesRepo.clearTableCell(note.id, blockId, rowIndex, colIndex)
  }, [note, notesRepo])
  const hardDelete = async () => { 
    if (!note || isActionPending) return; 
    console.log('Starting hard delete for note:', note.id);
    isDeleting.current = true;
    setIsActionPending(true)
    const noteId = note.id;
    deletedIds.current.add(noteId);
    try {
      await notesRepo.hardDeleteNote(noteId, { version: note.version }) 
      setItems((old) => old.filter((x) => x.id !== noteId)); 
      setNote(null); 
      syncNotesUrl() 
      showSuccess('Заметка удалена навсегда')
    } catch (e) {
      if (isNoteNotFoundError(e)) {
        setItems((old) => old.filter((x) => x.id !== noteId))
        setNote(null)
        syncNotesUrl()
      } else {
        showError('Ошибка при удалении заметки')
        deletedIds.current.delete(noteId)
        console.error('Hard delete error:', e);
      }
    } finally {
      isDeleting.current = false;
      setIsActionPending(false)
    }
  }
  const copyShareText = async (value: string) => {
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
    if (!copied) throw new Error('Не удалось скопировать заметку')
  }
  const shareNote = async () => {
    if (!note) return

    const shareTitle = titleOf({ ...note, title, content_doc: doc })
    const shareUrl = buildAbsoluteNoteUrl(note.id)

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl })
        return
      }

      await copyShareText(shareUrl)
      setShareToast({ message: 'Ссылка на заметку скопирована', variant: 'success' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      try {
        await copyShareText(shareUrl)
        setShareToast({ message: 'Ссылка на заметку скопирована', variant: 'success' })
      } catch {
        setShareToast({ message: 'Не удалось скопировать ссылку на заметку', variant: 'error' })
      }
    }
  }

  const handleShareToChat = async (chat: any) => {
    if (!note) return
    setIsChatPickerOpen(false)
    
    const shareTitle = titleOf({ ...note, title, content_doc: doc })
    const shareUrl = buildAbsoluteNoteUrl(note.id)
    
    const metadata = JSON.stringify({
      type: 'note',
      note_id: note.id,
      note_title: shareTitle,
      note_url: shareUrl,
      note_summary: (note.content_text || note.content || textOf(note.content_doc)).slice(0, 100)
    })

    const endpoint = chat.type === 'group' || chat.type === 'channel' 
      ? `/api/v1/${chat.type === 'group' ? 'groups' : 'channels'}/${chat.id}/messages`
      : `/api/v1/conversations/${chat.id}/messages`

    try {
      await chatApi(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          content: `Поделился заметкой: ${shareTitle}\n${shareUrl}`,
          type: 'text',
          metadata
        })
      })
      setShareToast({ message: 'Заметка отправлена в чат', variant: 'success' })
    } catch (e) {
      setShareToast({ message: 'Не удалось отправить заметку', variant: 'error' })
    }
  }
  const patchBlock = (id: string, next: Block) => setDoc((d) => ({ ...d, blocks: d.blocks.map((b) => b.id === id ? next : b) }))
  const removeBlock = (id: string) => setDoc((d) => {
    const nextBlocks = d.blocks.filter((b) => b.id !== id)
    if (nextBlocks.length === 0) {
      return { ...d, blocks: [{ id: bid('p'), type: 'paragraph', runs: [{ text: '' }] }] }
    }
    return { ...d, blocks: nextBlocks }
  })
  const addBlock = (b: Block) => { setDoc((d) => ({ ...d, blocks: [...d.blocks, b] })); setActiveMarks([]) }
  const insertBlockAfter = (afterId: string, b: Block) => {
    setDoc((d) => {
      const idx = d.blocks.findIndex((x) => x.id === afterId)
      if (idx < 0) return { ...d, blocks: [...d.blocks, b] }
      const blocks = [...d.blocks]
      blocks.splice(idx + 1, 0, b)
      return { ...d, blocks }
    })
    setActiveMarks([])
  }
  const mark = (m: string) => {
    const command = m === 'bold' ? 'bold' : m === 'italic' ? 'italic' : 'strikeThrough'
    document.execCommand(command, false)
    setActiveMarks((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])
    // Синхронизация произойдет через onInput
  }
  const setTextColor = (color: string) => {
    document.execCommand('foreColor', false, color)
    setActiveMarks((prev) => [...stripColorMarks(prev), `color:${color}`])
  }
  const upload = async (file: File) => {
    if (!note) return
    setSaving(true)
    try {
      const mimeType = file.type || 'application/octet-stream'
      const presign = await notesRepo.presignAttachment(note.id, {
        mime_type: mimeType,
        size_bytes: file.size,
      })
      await notesRepo.uploadAttachmentFile(presign.upload_url, file, mimeType)
      const n = await notesRepo.completeAttachment(note.id, presign.attachment_id)
      setNote(n)
      upsert(n)
      addBlock({ id: bid('img'), type: 'image', attachmentId: presign.attachment_id, alt: file.name })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось прикрепить изображение')
    } finally {
      setSaving(false)
    }
  }

  const handleAiProofread = async () => {
    if (!note || isProofreading) return
    
    const sel = selectedText.current
    if (!sel || sel.start === sel.end) {
      setErr('Пожалуйста, выделите текст для исправления через ИИ')
      return
    }

    const block = doc.blocks.find(b => b.id === sel.blockId)
    if (!block || block.type !== 'paragraph') {
      setErr('Выделенный блок не поддерживает исправление ИИ')
      return
    }

    const fullText = block.runs.map(r => r.text).join('')
    const content = fullText.slice(sel.start, sel.end)

    if (!content.trim()) {
      setErr('Выделенный фрагмент пуст')
      return
    }
    
    setIsProofreading(true)
    setAiSelection({ ...sel, originalText: content })
    try {
      const res = await alemAiRepository.proofreadNote({ content })
      setAiResult({ type: 'proofread', data: res })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка ИИ')
    } finally {
      setIsProofreading(false)
    }
  }

  const handleAiSummarize = async () => {
    if (!note || isSummarizing) return
    setIsSummarizing(true)
    try {
      const content = textOf(doc)
      if (!content.trim()) return
      const res = await alemAiRepository.summarizeNote({ content })
      setAiResult({ type: 'summarize', data: res })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка ИИ')
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleMeetingNoteCreated = useCallback((created: Note) => {
    upsert(created)
    setMode('notes')
    setNote(null)
    void openNote(created.id)
  }, [openNote])

  const applyAiResult = () => {
    if (!aiResult || aiResult.type !== 'proofread') return
    const correctedText = aiResult.data.corrected_text
    if (!correctedText) return
    
    if (aiSelection) {
      const { blockId, start, end } = aiSelection
      const block = doc.blocks.find(b => b.id === blockId)
      if (block && block.type === 'paragraph') {
        const fullText = block.runs.map(r => r.text).join('')
        const before = fullText.slice(0, start)
        const after = fullText.slice(end)
        const newFullText = before + correctedText + after
        
        patchBlock(blockId, { 
          ...block, 
          runs: [{ text: newFullText }]
        })
      }
    } else {
      setDoc({
        type: 'doc',
        version: doc.version,
        blocks: correctedText.split('\n').map((line, i) => ({
          id: bid('p'),
          type: 'paragraph',
          runs: [{ text: line }]
        }))
      })
    }
    setAiResult(null)
    setAiSelection(null)
  }

  return (
    <>
      <style>{`
        .studio-ui * { box-sizing: border-box; }
        .studio-ui ::-webkit-scrollbar { width: 8px; height: 8px; }
        .studio-ui ::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.16); border-radius: 999px; }
        .studio-ui .primary-btn { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; background: #1E88E5; color: #fff; font-weight: 600; border: none; cursor: pointer; }
        .studio-ui .primary-btn:hover { background: #1976D2; }
        .studio-ui .search-input { width: 100%; padding: 10px 14px 10px 38px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; font-size: 14px; outline: none; }
        .studio-ui .search-input:focus { border-color: #1E88E5; box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.18); }
        .studio-ui .folder-pill { padding: 4px 10px; border-radius: 8px; background: #f3f4f6; font-size: 11px; font-weight: 600; color: #475569; border: 1px solid #e5e7eb; display: inline-flex; align-items: center; gap: 4px; }
        .studio-ui .action-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #64748b; border: none; background: transparent; cursor: pointer; }
        .studio-ui .action-icon:hover { background: #f1f5f9; color: #0f172a; }
        .studio-ui .editor-block { position: relative; padding: 12px 0; border-radius: 8px; background: transparent; }
        .studio-ui .block-wrapper { border-radius: 8px; padding: 4px 8px; border: 1px dashed transparent; }
        .studio-ui .block-wrapper:focus-within { background: #fafafa; border-color: #d6d3d1; }
        .studio-ui .editor-input { border: none; background: transparent; outline: none; width: 100%; font-size: 16px; font-weight: 400; color: #111827; resize: none; overflow: hidden; }
        .studio-ui .editor-btn { border: 1px solid #e2e8f0; background: #fff; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: #475569; }
        .studio-ui .editor-btn:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
        .studio-ui .editor-input:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; font-style: italic; }
      `}</style>
      <div
        className="studio-ui"
        style={{
          height: 'calc(100vh - 56px)',
          overflow: 'hidden',
          background: c.bg,
          color: '#111827',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : mode === 'meeting-ai' ? '240px 1fr' : '240px 320px 1fr'
        }}>
          {(!isMobile || view === 'folders') && (
            <aside style={{ padding: 16, overflowY: 'auto', background: '#FFFFFF', borderRight: isMobile ? 'none' : `1px solid ${c.border}` }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: c.text }}>AlemNotes</h1>
            <div style={{ color: c.muted, marginTop: 4, fontSize: 12 }}>
              {loading ? 'Синхронизация...' : `${items.length} записей`}
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 4 }}>
              {(['notes', 'meeting-ai', 'archive', 'trash'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setNote(null); syncNotesUrl(); if (m === 'meeting-ai' && isMobile) setView('note') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    border: 0,
                    background: mode === m ? '#EBF4FE' : 'transparent',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    color: c.text,
                    fontSize: 14,
                    textAlign: 'left',
                  }}
                >
                  <MaterialSymbol name={m === 'notes' ? 'description' : m === 'meeting-ai' ? 'mic' : m === 'archive' ? 'inventory_2' : 'delete'} size={18} />
                  {m === 'notes' ? 'Мои заметки' : m === 'meeting-ai' ? 'Совещания' : m === 'archive' ? 'Архив' : 'Корзина'}
                </button>
              ))}
            </div>

            {mode === 'notes' && <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>
                Папки
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <button
                  onClick={() => { setFolderId(null); if (isMobile) setView('list') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    border: 0,
                    background: !folderId ? '#EBF4FE' : 'transparent',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    color: c.text,
                    fontSize: 14,
                    textAlign: 'left',
                  }}
                >
                  <MaterialSymbol name="grid_view" size={18} />
                  Все
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setFolderId(f.id); if (isMobile) setView('list') }}
                    onContextMenu={(e) => openFolderMenu(e, f)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      border: 0,
                      background: folderId === f.id ? '#EBF4FE' : 'transparent',
                      borderRadius: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      color: c.text,
                      fontSize: 14,
                      textAlign: 'left',
                    }}
                  >
                    <MaterialSymbol name="folder" size={18} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void createFolder()}
                  placeholder="Новая папка"
                  style={{
                    flex: 1,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 13,
                    outline: 'none',
                    background: '#fff',
                  }}
                />
                <button onClick={() => void createFolder()} className="action-icon" style={{ width: 32, height: 32 }}>
                  <MaterialSymbol name="add" size={18} />
                </button>
              </div>
            </div>}

            {folderMenu && <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: folderMenu.x, top: folderMenu.y, zIndex: 1000, minWidth: 200, padding: 8, background: '#fff', border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: '0 10px 24px rgba(0,0,0,0.12)' }}>
              <button onClick={() => { const f = folderMenu.folder; setFolderMenu(null); openRenameFolderModal(f) }} style={menuBtn}><MaterialSymbol name="edit" size={18} />Переименовать</button>
              <div style={{ height: 1, background: c.border, margin: '6px 0' }} />
              <button onClick={() => { const f = folderMenu.folder; setFolderMenu(null); void deleteFolder(f) }} style={{ ...menuBtn, color: '#EF4444' }}><MaterialSymbol name="delete" size={18} />Удалить навсегда</button>
            </div>}
            </aside>
          )}

          {mode !== 'meeting-ai' && (!isMobile || view === 'list') && (
            <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: isMobile ? 'none' : `1px solid ${c.border}` }}>
            <div style={{ padding: 14 }}>
              {isMobile && (
                <button
                  onClick={() => setView('folders')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 12,
                    background: 'none',
                    border: 'none',
                    color: c.brand,
                    fontSize: 14,
                    fontWeight: 600,
                    padding: 0,
                    cursor: 'pointer'
                  }}
                >
                  <MaterialSymbol name="chevron_left" size={20} />
                  Папки
                </button>
              )}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <MaterialSymbol name="search" size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 9 }} />
                <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск..." disabled={loading} />
              </div>
              {mode === 'notes' && (
                <button 
                  className="primary-btn" 
                  onClick={createNote} 
                  disabled={isActionPending || loading}
                  style={{ width: '100%', justifyContent: 'center', opacity: (isActionPending || loading) ? 0.7 : 1 }}
                >
                  {isActionPending ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <MaterialSymbol name="add" size={18} />
                  )}
                  Новая заметка
                </button>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.length ? items.map((n) => {
                const isActive = note?.id === n.id
                return (
                  <button
                    key={n.id}
                    onClick={() => void openNote(n.id)}
                    disabled={isActionPending}
                    style={{
                      width: '100%',
                      border: `1px solid ${isActive ? '#1E88E5' : '#E2E8F0'}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                      background: isActive ? '#F0F7FF' : '#FFFFFF',
                      cursor: isActionPending ? 'default' : 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isActive ? '0 4px 14px -2px rgba(30, 136, 229, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 14, lineHeight: '20px', color: c.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {titleOf(n)}
                      </div>
                      {n.is_pinned ? <MaterialSymbol name="push_pin" size={15} color={c.muted} /> : null}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, lineHeight: '17px', color: c.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {n.content_text || n.content || textOf(n.content_doc) || 'Пустая заметка'}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="folder-pill">
                        <MaterialSymbol name="schedule" size={13} />
                        {dateOf(n.updated_at)}
                      </span>
                      {n.folder_id ? (
                        <span className="folder-pill">
                          <MaterialSymbol name="folder" size={13} />
                          {folders.find((f) => f.id === n.folder_id)?.name}
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              }) : (
                <div style={{ textAlign: 'center', color: c.muted, fontSize: 13, padding: '24px 10px' }}>Нет заметок</div>
              )}
              {cursor && <button className="editor-btn" onClick={() => void loadNotes(false)}>Загрузить еще</button>}
            </div>
          </section>
          )}

          {((!isMobile || view === 'note') || mode === 'meeting-ai') && (
            <main style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
            {mode === 'meeting-ai' ? (
              <NotesMeetingAiPanel
                repository={alemAiRepository}
                notesRepo={notesRepo}
                onNoteCreated={handleMeetingNoteCreated}
                showError={showError}
                showSuccess={showSuccess}
              />
            ) : note ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${c.border}` }}>
                  {isMobile && (
                    <button
                      onClick={() => setView('list')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#f1f5f9',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      <MaterialSymbol name="chevron_left" size={24} />
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: c.muted, flex: 1 }}>{saving ? 'Сохранение...' : 'Сохранено'}</div>
                  {mode === 'trash' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="editor-btn" onClick={() => void restore()} disabled={isActionPending} style={{ cursor: isActionPending ? 'not-allowed' : 'pointer' }}>Восстановить</button>
                      <button className="editor-btn" onClick={() => void hardDelete()} disabled={isActionPending} style={{ color: c.danger, cursor: isActionPending ? 'not-allowed' : 'pointer' }}>Удалить навсегда</button>
                    </div>
                  ) : mode === 'archive' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="editor-btn" onClick={() => void unarchive()} disabled={isActionPending} style={{ cursor: isActionPending ? 'not-allowed' : 'pointer' }}>Вернуть из архива</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="action-icon" title="Отправить в чат" onClick={() => setIsChatPickerOpen(true)} disabled={isActionPending}><MaterialSymbol name="send" size={18} color={c.muted} /></button>
                      <button className="action-icon" title="Поделиться ссылкой" onClick={() => void shareNote()} disabled={isActionPending}><MaterialSymbol name="share" size={18} color={c.muted} /></button>
                      <button className="action-icon" title="В архив" onClick={() => void archiveNote()} disabled={isActionPending}><MaterialSymbol name="inventory_2" size={18} color={c.muted} /></button>
                      <button className="action-icon" onClick={() => void pin()} disabled={isActionPending}><MaterialSymbol name={note.is_pinned ? 'push_pin' : 'keep'} size={18} color={note.is_pinned ? c.brand : c.muted} /></button>
                      <select
                        value={note.folder_id || ''}
                        disabled={isActionPending}
                        onChange={(e) => void move(e.target.value || null)}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}
                      >
                        <option value="">Без папки</option>
                        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <button className="action-icon" onClick={() => void del()} disabled={isActionPending}><MaterialSymbol name="delete" size={18} /></button>
                    </div>
                  )}
                </div>
                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '28px 44px 24px' }}>
                  <textarea
                    ref={titleRef}
                    value={title}
                    onChange={(e) => mode === 'notes' && setTitle(e.target.value)}
                    readOnly={mode !== 'notes'}
                    placeholder="Без названия"
                    rows={1}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontSize: 40,
                      lineHeight: 1.25,
                      fontWeight: 700,
                      color: c.text,
                      marginBottom: 18,
                      padding: 0,
                    }}
                  />
                  <div style={{ display: 'grid', gap: 2 }}>
                    {doc.blocks.map((b) => (
                      <BlockEditor
                        key={b.id}
                        block={b}
                        readOnly={mode !== 'notes'}
                        activeMarks={activeMarks}
                        noteId={note.id}
                        onTableDeleteColumn={onTableDeleteColumn}
                        onTableClearCell={onTableClearCell}
                        attachment={note.attachments?.find((a) => a.id === (b as any).attachmentId || a.file_id === (b as any).attachmentId)}
                        onChange={(next) => mode === 'notes' && patchBlock(b.id, next)}
                        onInsertAfter={(nextBlock) => insertBlockAfter(b.id, nextBlock)}
                        onImageClick={setPreviewImageUrl}
                        onTextSelect={(range) => {
                          selectedText.current = range
                          if (range && range.start !== range.end && b.type === 'paragraph') {
                            const run = b.runs.find((_, i, arr) => {
                              let pos = 0
                              for (let j = 0; j < i; j++) pos += arr[j].text.length
                              return range.start >= pos && range.start < pos + arr[i].text.length
                            })
                            if (run) setActiveMarks(run.marks || [])
                          }
                        }}
                        onRemove={() => removeBlock(b.id)}
                      />
                    ))}
                  </div>
                </div>
                {mode === 'notes' && (
                  <footer style={{ borderTop: `1px solid ${c.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button onMouseDown={(e) => { e.preventDefault(); mark('bold') }} style={{ ...toolBtn, width: 34, height: 34, color: activeMarks.includes('bold') ? c.brand : '#94A3B8' }}><MaterialSymbol name="format_bold" size={18} /></button>
                    <button onMouseDown={(e) => { e.preventDefault(); mark('italic') }} style={{ ...toolBtn, width: 34, height: 34, color: activeMarks.includes('italic') ? c.brand : '#94A3B8' }}><MaterialSymbol name="format_italic" size={18} /></button>
                    <button onMouseDown={(e) => { e.preventDefault(); mark('strike') }} title="Зачеркнутый (Cmd/Ctrl+Shift+X)" style={{ ...toolBtn, width: 34, height: 34, color: activeMarks.includes('strike') ? c.brand : '#94A3B8', fontSize: 14, fontWeight: 700 }}><span style={{ textDecoration: 'line-through' }}>S</span></button>
                    
                    <div style={{ width: 1, height: 20, background: c.border, margin: '0 8px' }} />
                    
                    <button 
                      onClick={handleAiProofread} 
                      disabled={isProofreading || isSummarizing}
                      title={isProofreading ? 'Выполняется анализ...' : 'Исправить текст (ИИ)'}
                      style={{ ...toolBtn, width: 34, height: 34, color: c.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isProofreading ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <MaterialSymbol name="auto_fix" size={18} />
                      )}
                    </button>

                    <button 
                      onClick={handleAiSummarize} 
                      disabled={isProofreading || isSummarizing}
                      title={isSummarizing ? 'Создание резюме...' : 'Создать резюме (ИИ)'}
                      style={{ ...toolBtn, width: 34, height: 34, color: c.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isSummarizing ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <MaterialSymbol name="summarize" size={18} />
                      )}
                    </button>

                    <div style={{ width: 1, height: 20, background: c.border, margin: '0 8px' }} />

                    {['#37352F', '#2563EB', '#DC2626', '#16A34A'].map((color) => (
                      <button
                        key={color}
                        onMouseDown={(e) => { e.preventDefault(); setTextColor(color) }}
                        title={`Цвет ${color}`}
                        style={{
                          ...toolBtn,
                          width: 28,
                          height: 28,
                          borderRadius: '999px',
                          border: colorMark(activeMarks) === `color:${color}` ? '2px solid #1F2937' : '1px solid #D1D5DB',
                        }}
                      >
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'block' }} />
                      </button>
                    ))}
                    <button onClick={() => addBlock({ id: bid('p'), type: 'paragraph', runs: [{ text: '' }] })} style={{ ...toolBtn, width: 34, height: 34 }}><MaterialSymbol name="notes" size={18} /></button>
                    <button onClick={() => addBlock({ id: bid('c'), type: 'checklist', items: [{ id: bid('i'), text: '', checked: false }] })} style={{ ...toolBtn, width: 34, height: 34 }}><MaterialSymbol name="checklist" size={18} /></button>
                    <button 
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTablePicker({ x: rect.left, y: rect.top })
                      }} 
                      style={{ ...toolBtn, width: 34, height: 34 }}
                    >
                      <MaterialSymbol name="table_chart" size={18} />
                    </button>
                    <button onClick={() => fileRef.current?.click()} style={{ ...toolBtn, width: 34, height: 34 }}><MaterialSymbol name="image" size={18} /></button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
                  </footer>
                )}
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: c.muted }}>
                <MaterialSymbol name="description" size={40} color="#c4c4c2" />
                <div style={{ marginTop: 10, fontSize: 14 }}>Выберите заметку слева или создайте новую</div>
              </div>
            )}
          </main>
          )}
        </div>

        {renameFolderModal && <div style={modalOverlay} onClick={() => setRenameFolderModal(null)}>
          <div style={{ ...modalPanel, padding: 24, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Переименовать папку</h3>
            <p style={{ margin: '0 0 16px', color: c.muted, fontSize: 13 }}>Новое имя будет применено ко всем связанным заметкам.</p>
            <input value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)} autoFocus className="search-input" style={{ background: '#fff' }} />
            <div style={{ ...row('flex-end', 10), marginTop: 18 }}>
              <button onClick={() => setRenameFolderModal(null)} style={{ border: 'none', background: 'transparent', color: c.muted, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Отмена</button>
              <button className="primary-btn" onClick={() => void renameFolder()} style={{ borderRadius: 10, padding: '8px 12px' }}>Сохранить</button>
            </div>
          </div>
        </div>}
        {shareToast ? (
          <AppToast
            message={shareToast.message}
            variant={shareToast.variant}
            onClose={() => setShareToast(null)}
          />
        ) : null}
        {aiResult && (
          <AppModal 
            title={aiResult.type === 'proofread' ? 'Предложение ИИ' : 'Резюме заметки'} 
            onClose={() => { setAiResult(null); setAiSelection(null); }}
            maxWidth={600}
          >
            {aiResult.type === 'proofread' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Оригинал</div>
                  <div style={{ color: '#1E293B', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {aiSelection ? aiSelection.originalText : 'Весь текст заметки'}
                  </div>
                </div>
                
                <div style={{ padding: '16px', background: '#F0F9FF', borderRadius: '12px', border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369A1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Предложение ИИ</div>
                  <div style={{ color: '#0C4A6E', lineHeight: '1.6', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                    {aiResult.data.corrected_text}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <AppButton 
                    onClick={applyAiResult} 
                    style={{ flex: 1, height: '44px' }}
                  >
                    Применить изменения
                  </AppButton>
                  <AppButton 
                    variant="secondary" 
                    onClick={() => { setAiResult(null); setAiSelection(null); }}
                    style={{ flex: 1, height: '44px' }}
                  >
                    Оставить как есть
                  </AppButton>
                </div>
              </div>
            )}
            
            {aiResult.type === 'summarize' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ 
                  background: '#F8FAFC', 
                  padding: 16, 
                  borderRadius: 12, 
                  fontSize: 14, 
                  lineHeight: 1.6,
                  color: '#334155',
                  maxHeight: 400,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {aiResult.data.summary}
                </div>
                {aiResult.data.bullets?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Ключевые моменты:</div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {aiResult.data.bullets.map((b: string, i: number) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  <AppButton variant="secondary" onClick={() => setAiResult(null)}>Закрыть</AppButton>
                </div>
              </div>
            )}
          </AppModal>
        )}
        <ChatPickerModal 
          isOpen={isChatPickerOpen} 
          onClose={() => setIsChatPickerOpen(false)} 
          onSelect={handleShareToChat}
          title="Отправить заметку в чат"
        />
        {tablePicker && (
          <TableDimensionPicker
            x={tablePicker.x}
            y={tablePicker.y}
            onClose={() => setTablePicker(null)}
            onSelect={(r, c) => {
              const rows = Array.from({ length: r }, () => 
                Array.from({ length: c }, () => ({ text: '' }))
              )
              addBlock({ id: bid('t'), type: 'table', rows })
              setTablePicker(null)
            }}
          />
        )}

        {/* Fullscreen premium image preview/lightbox */}
        {previewImageUrl && (
          <div 
            onClick={() => setPreviewImageUrl(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div 
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                zIndex: 10000,
                display: 'flex',
                gap: 12
              }}
            >
              <a
                href={previewImageUrl}
                download
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  textDecoration: 'none'
                }}
                title="Скачать изображение"
              >
                <MaterialSymbol name="download" size={24} />
              </a>

              <button
                onClick={() => setPreviewImageUrl(null)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                title="Закрыть"
              >
                <MaterialSymbol name="close" size={24} />
              </button>
            </div>
            
            <img 
              src={previewImageUrl} 
              alt="Увеличенное изображение" 
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: 16,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                cursor: 'default',
                userSelect: 'none'
              }} 
            />
          </div>
        )}
      </div>
    </>
  )
}

function BlockEditor({ block, readOnly, activeMarks, attachment, noteId, onTableDeleteColumn, onTableClearCell, onChange, onInsertAfter, onTextSelect, onRemove, onImageClick }: any) {
  if (block.type === 'paragraph') return <ParagraphEditor block={block} readOnly={readOnly} activeMarks={activeMarks} onChange={onChange} onTextSelect={onTextSelect} onRemove={onRemove} />
  
  if (block.type === 'checklist') return (
    <div className="editor-block" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        {block.items.map((it: any, i: number) => (
          <div key={it.id} style={{ display: 'flex', gap: 14, alignItems: 'center', group: 'true' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                type="checkbox" 
                disabled={readOnly}
                checked={Boolean(it.checked || it.is_done)} 
                onChange={(e) => onChange({ ...block, items: block.items.map((x: any, ix: number) => ix === i ? { ...x, checked: e.target.checked, is_done: e.target.checked } : x) })} 
                style={{ appearance: 'none', width: 22, height: 22, borderRadius: 6, border: `2px solid ${Boolean(it.checked || it.is_done) ? c.brand : c.border}`, background: Boolean(it.checked || it.is_done) ? c.brand : 'transparent', cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.2s' }} 
              />
              {Boolean(it.checked || it.is_done) && <MaterialSymbol name="check" size={14} color="white" style={{ position: 'absolute', pointerEvents: 'none' }} />}
            </div>
            <input 
              className="editor-input" 
              value={it.text} 
              readOnly={readOnly}
              onChange={(e) => onChange({ ...block, items: block.items.map((x: any, ix: number) => ix === i ? { ...x, text: e.target.value } : x) })} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!it.text.trim()) {
                    const restItems = block.items.filter((_: any, ix: number) => ix !== i)
                    if (restItems.length) onChange({ ...block, items: restItems })
                    else onRemove()
                    onInsertAfter?.({ id: bid('p'), type: 'paragraph', runs: [{ text: '' }] })
                    return
                  }
                  const nextItems = [...block.items]
                  nextItems.splice(i + 1, 0, { id: bid('i'), text: '', checked: false })
                  onChange({ ...block, items: nextItems })
                  return
                }
                if (e.key === 'Backspace' && !it.text && block.items.length > 1) {
                  e.preventDefault()
                  onChange({ ...block, items: block.items.filter((_: any, ix: number) => ix !== i) })
                }
              }}
              placeholder="Пункт списка..." 
              style={{ 
                fontSize: 17, 
                textDecoration: Boolean(it.checked || it.is_done) ? 'line-through' : 'none',
                opacity: Boolean(it.checked || it.is_done) ? 0.5 : 1,
                fontWeight: 500,
                padding: '6px 8px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.03)',
              }}
            />
            {!readOnly && (
              <button className="action-icon" onClick={() => onChange({ ...block, items: block.items.length > 1 ? block.items.filter((_: any, ix: number) => ix !== i) : [{ id: bid('i'), text: '', checked: false }] })} style={{ opacity: 0.4 }}>
                <MaterialSymbol name="close" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ ...row('flex-start', 16), marginTop: 24, paddingTop: 16 }}>
          <button className="editor-btn" onClick={() => onChange({ ...block, items: [...block.items, { id: bid('i'), text: '', checked: false }] })} style={{ background: 'transparent', border: 'none', color: c.brand, padding: 0 }}>+ Добавить пункт</button>
          <button className="editor-btn" onClick={onRemove} style={{ color: c.danger, borderColor: 'transparent', marginLeft: 'auto', padding: 0 }}>Удалить блок</button>
        </div>
      )}
    </div>
  )

  if (block.type === 'table') {
    return (
      <TableEditor
        block={block}
        readOnly={readOnly}
        noteId={noteId}
        onDeleteColumn={onTableDeleteColumn}
        onClearCell={onTableClearCell}
        onChange={onChange}
        onRemove={onRemove}
      />
    )
  }

  const url = normalizeBackendAssetUrl(attachment?.download_url)
  return (
    <div className="editor-block">
      {url ? (
        <div 
          onClick={() => onImageClick?.(url)}
          style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#f8fafc', marginBottom: 16, cursor: 'zoom-in' }}
          title="Нажмите, чтобы увеличить"
        >
          <img src={url} alt={block.alt || attachment?.real_name} style={{ display: 'block', width: '100%', maxHeight: 500, objectFit: 'contain', transition: 'transform 0.2s' }} />
        </div>
      ) : <div style={{ padding: 40, textAlign: 'center', color: c.muted, fontWeight: 600 }}>[ Изображение загружается... ]</div>}
      {!readOnly && <button className="editor-btn" onClick={onRemove} style={{ color: c.danger, borderColor: 'transparent' }}>Удалить изображение</button>}
    </div>
  )
}

function TableEditor({ block, readOnly, noteId, onDeleteColumn, onClearCell, onChange, onRemove }: any) {
  const [menu, setMenu] = useState<{ type: 'row' | 'col'; index: number; x: number; y: number } | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)
  const [hoveredLine, setHoveredLine] = useState<{ type: 'row' | 'col'; index: number } | null>(null)
  const colCount = block.rows[0]?.length || 0

  const updateCell = (ri: number, ci: number, nextCell: { text: string; html?: string }) => {
    onChange({
      ...block,
      rows: block.rows.map((r: any[], rix: number) =>
        r.map((x, cix) => (rix === ri && cix === ci ? { ...x, ...nextCell } : x)),
      ),
    })
  }

  const insertRow = (index: number) => {
    const nextRow = new Array(colCount || 2).fill(null).map(() => ({ text: '' }))
    const nextRows = [...block.rows]
    nextRows.splice(index, 0, nextRow)
    onChange({ ...block, rows: nextRows })
  }

  const removeRow = (index: number) => {
    if (block.rows.length <= 1) return
    onChange({ ...block, rows: block.rows.filter((_: any, ri: number) => ri !== index) })
  }

  const insertColumn = (index: number) => {
    onChange({
      ...block,
      rows: block.rows.map((r: any[]) => {
        const next = [...r]
        next.splice(index, 0, { text: '' })
        return next
      }),
    })
  }

  const removeColumn = (index: number) => {
    if (colCount <= 1) return
    void (async () => {
      if (noteId && block.id && onDeleteColumn) {
        try {
          await onDeleteColumn(block.id, index)
        } catch {
          return
        }
      }
      onChange({
        ...block,
        rows: block.rows.map((r: any[]) => r.filter((_: any, ci: number) => ci !== index)),
      })
    })()
  }

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  return (
    <div className="editor-block" style={{ overflowX: 'visible', padding: '32px 64px 48px' }}>
      <div 
        style={{ position: 'relative', width: '100%', userSelect: 'none' }}
        onMouseLeave={() => { setHoveredRow(null); setHoveredCol(null); setHoveredLine(null) }}
      >
        {/* Column Handles */}
        {!readOnly && <div style={{ position: 'absolute', top: -18, left: 0, right: 0, display: 'flex', height: 18 }}>
          {Array.from({ length: colCount }).map((_, ci) => (
            <div
              key={`col-h-${ci}`}
              onMouseEnter={() => setHoveredCol(ci)}
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <div 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  removeColumn(ci)
                }}
                style={{
                  ...tableHandle,
                  width: 32,
                  height: 14,
                  top: 2,
                  opacity: hoveredCol === ci ? 1 : 0,
                  transform: hoveredCol === ci ? 'translateY(0)' : 'translateY(4px)',
                  background: '#FEF2F2',
                  color: '#EF4444'
                }}
                title="Удалить колонку"
              >
                <MaterialSymbol name="delete" size={12} />
              </div>

              {/* Column Insertion Line */}
              <div 
                onMouseEnter={() => setHoveredLine({ type: 'col', index: ci + 1 })}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 0,
                  bottom: 0,
                  width: 20,
                  zIndex: 60,
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  ...tableInsertionLine,
                  right: 9,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  opacity: hoveredLine?.type === 'col' && hoveredLine.index === ci + 1 ? 1 : 0
                }}>
                  <div 
                    onClick={() => insertColumn(ci + 1)}
                    style={{ ...tableActionBtn, width: 18, height: 18, color: '#3B82F6', border: '1px solid #3B82F6' }}
                  >
                    <MaterialSymbol name="add" size={14} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>}

        {/* Row Handles */}
        {!readOnly && <div style={{ position: 'absolute', left: -18, top: 0, bottom: 0, width: 18, display: 'flex', flexDirection: 'column' }}>
          {block.rows.map((_: any, ri: number) => (
            <div
              key={`row-h-${ri}`}
              onMouseEnter={() => setHoveredRow(ri)}
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <div 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  removeRow(ri)
                }}
                style={{
                  ...tableHandle,
                  width: 14,
                  height: 32,
                  left: 2,
                  opacity: hoveredRow === ri ? 1 : 0,
                  transform: hoveredRow === ri ? 'translateX(0)' : 'translateX(4px)',
                  background: '#FEF2F2',
                  color: '#EF4444'
                }}
                title="Удалить строку"
              >
                <MaterialSymbol name="delete" size={12} />
              </div>

              {/* Row Insertion Line */}
              <div 
                onMouseEnter={() => setHoveredLine({ type: 'row', index: ri + 1 })}
                style={{
                  position: 'absolute',
                  bottom: -10,
                  left: 0,
                  right: 0,
                  height: 20,
                  zIndex: 60,
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  ...tableInsertionLine,
                  bottom: 9,
                  left: 0,
                  right: 0,
                  height: 2,
                  opacity: hoveredLine?.type === 'row' && hoveredLine.index === ri + 1 ? 1 : 0
                }}>
                  <div 
                    onClick={() => insertRow(ri + 1)}
                    style={{ ...tableActionBtn, width: 18, height: 18, color: '#3B82F6', border: '1px solid #3B82F6' }}
                  >
                    <MaterialSymbol name="add" size={14} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>}

        <table 
          style={{ 
            borderCollapse: 'collapse', 
            tableLayout: 'fixed',
            width: '100%',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            background: '#fff',
            boxShadow: '0 4px 12px rgba(15,23,42,0.03)'
          }}
        >
          <tbody>
            {block.rows.map((rowArr: any[], ri: number) => (
              <tr key={ri} style={{ background: hoveredRow === ri ? '#F8FAFC' : 'transparent' }}>
                {rowArr.map((cell, ci) => (
                  <td
                    key={`${ri}-${ci}`}
                    onMouseEnter={() => { setHoveredRow(ri); setHoveredCol(ci) }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMenu({ type: 'row', index: ri, x: e.clientX, y: e.clientY })
                    }}
                    style={{ 
                      border: '1px solid #E2E8F0',
                      padding: 0,
                      verticalAlign: 'top',
                      background: hoveredCol === ci ? '#F8FAFC' : 'transparent',
                      transition: 'background 0.1s'
                    }}
                  >
                    <div style={{ padding: '10px 12px', minHeight: 40, wordBreak: 'break-word' }}>
                      <TableCellEditor
                        cell={cell}
                        readOnly={readOnly}
                        onChange={(next) => {
                          updateCell(ri, ci, next)
                          const empty = !(next.text || '').trim() && !(next.html || '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').trim()
                          if (empty && noteId && block.id && onClearCell) {
                            void onClearCell(block.id, ri, ci).catch(() => {})
                          }
                        }}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Global Delete Button (Close to table) */}
        {!readOnly && <div style={{ position: 'absolute', top: 0, right: -48, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onRemove}
            style={{
              ...tableActionBtn,
              position: 'relative',
              width: 32,
              height: 32,
              borderRadius: 8,
              color: '#EF4444',
              background: '#FEF2F2',
              border: '1px solid #FEE2E2'
            }}
            title="Удалить таблицу"
          >
            <MaterialSymbol name="delete" size={18} />
          </button>
        </div>}
      </div>

      {/* Premium Context Menu */}
      {menu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 300),
            zIndex: 1000,
            width: 180,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            padding: 6,
            animation: 'fadeIn 0.1s ease-out'
          }}
        >
          <div style={{ padding: '4px 8px 8px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
            {menu.type === 'row' ? 'Управление строкой' : 'Управление колонкой'}
          </div>
          <button style={tableMenuBtn} onClick={() => { menu.type === 'row' ? insertRow(menu.index) : insertColumn(menu.index); setMenu(null) }}>
            <MaterialSymbol name="keyboard_arrow_up" size={16} /> Вставить {menu.type === 'row' ? 'выше' : 'слева'}
          </button>
          <button style={tableMenuBtn} onClick={() => { menu.type === 'row' ? insertRow(menu.index + 1) : insertColumn(menu.index + 1); setMenu(null) }}>
            <MaterialSymbol name="keyboard_arrow_down" size={16} /> Вставить {menu.type === 'row' ? 'ниже' : 'справа'}
          </button>
          <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />
          <button 
            style={{ ...tableMenuBtn, color: '#EF4444' }} 
            onClick={() => { menu.type === 'row' ? removeRow(menu.index) : removeColumn(menu.index); setMenu(null) }}
          >
            <MaterialSymbol name="delete" size={16} /> Удалить {menu.type === 'row' ? 'строку' : 'колонку'}
          </button>
        </div>
      )}
    </div>
  )
}

function TableCellEditor({ cell, readOnly, onChange }: any) {
  const ref = useRef<HTMLDivElement | null>(null)
  const isTyping = useRef(false)

  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

  const normalizeStoredHtml = (value: string) => {
    if (!value) return ''
    let html = value
    // Some backends return escaped HTML entities; decode once.
    if (html.includes('&lt;') || html.includes('&gt;') || html.includes('&#')) {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = html
      html = textarea.value
    }
    // Accept only actual HTML payloads, otherwise fallback to plain text.
    return /<([a-z][^>\s]*)(?:\s[^>]*)?>/i.test(html) ? html : ''
  }

  useEffect(() => {
    if (!ref.current || isTyping.current) return
    const restoredHtml = normalizeStoredHtml(cell?.html || '')
    const nextHtml = restoredHtml || escapeHtml(cell?.text || '').replace(/\n/g, '<br/>')
    if (ref.current.innerHTML !== nextHtml) {
      ref.current.innerHTML = nextHtml
    }
  }, [cell?.html, cell?.text])

  return (
    <div
      ref={ref}
      className="editor-input"
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
      onKeyDown={(e) => {
        const isMod = e.metaKey || e.ctrlKey
        const key = e.key.toLowerCase()
        if (isMod && key === 'b') {
          e.preventDefault()
          document.execCommand('bold', false)
          return
        }
        if (isMod && key === 'i') {
          e.preventDefault()
          document.execCommand('italic', false)
          return
        }
        if (isMod && e.shiftKey && key === 'x') {
          e.preventDefault()
          document.execCommand('strikeThrough', false)
        }
      }}
      onInput={(e) => {
        isTyping.current = true
        const el = e.currentTarget
        onChange({ text: el.innerText || '', html: el.innerHTML || '' })
        setTimeout(() => { isTyping.current = false }, 10)
      }}
      style={{
        fontSize: 14,
        minHeight: 30,
        lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: '2px 0',
      }}
    />
  )
}

function ParagraphEditor({ block, readOnly, activeMarks, onChange, onTextSelect, onRemove }: any) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const isTyping = useRef(false)
  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

  const runsToHtml = (runs: any[]) => {
    return runs.map(run => {
      const cMark = colorMark(run.marks)
      const cValue = cMark ? cMark.replace('color:', '') : ''
      const safeText = escapeHtml(run.text || '').replace(/\n/g, '<br/>')
      let node = `<span style="${cValue ? `color:${cValue};` : ''}">${safeText}</span>`
      if (run.marks?.includes('bold')) node = `<b>${node}</b>`
      if (run.marks?.includes('italic')) node = `<i>${node}</i>`
      if (run.marks?.includes('strike')) node = `<s>${node}</s>`
      return node
    }).join('') || ''
  }

  useEffect(() => {
    if (!rootRef.current || isTyping.current) return
    const html = runsToHtml(block.runs)
    if (rootRef.current.innerHTML !== html) {
      rootRef.current.innerHTML = html
    }
  }, [block.runs])

  const serialize = (el: HTMLElement) => {
    const runs: any[] = []
    const walk = (node: Node, marks: string[]) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) runs.push({ text: node.textContent, marks: [...marks] })
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName
        if (tag === 'BR') {
          runs.push({ text: '\n', marks: [...marks] })
          return
        }
        const nextMarks = [...marks]
        if (tag === 'B' || tag === 'STRONG' || (node as HTMLElement).style.fontWeight === 'bold') nextMarks.push('bold')
        if (tag === 'I' || tag === 'EM' || (node as HTMLElement).style.fontStyle === 'italic') nextMarks.push('italic')
        const textDecoration = (node as HTMLElement).style.textDecoration || ''
        if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || textDecoration.includes('line-through')) nextMarks.push('strike')
        const styleColor = (node as HTMLElement).style.color
        const fontColor = tag === 'FONT' ? (node as HTMLElement).getAttribute('color') : ''
        const pickedColor = styleColor || fontColor || ''
        if (pickedColor) {
          const noColor = nextMarks.filter((m) => !m.startsWith('color:'))
          nextMarks.length = 0
          nextMarks.push(...noColor, `color:${pickedColor}`)
        }
        node.childNodes.forEach(child => walk(child, nextMarks))
      }
    }
    el.childNodes.forEach(child => walk(child, []))
    return runs.length ? runs : [{ text: '', marks: [] }]
  }

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    isTyping.current = true
    onChange({ ...block, runs: serialize(e.currentTarget) })
    setTimeout(() => { isTyping.current = false }, 10)
  }

  const rememberSelection = () => {
    const root = rootRef.current
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return
    
    const beforeRange = range.cloneRange()
    beforeRange.selectNodeContents(root)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const start = beforeRange.toString().length
    
    const endRange = range.cloneRange()
    endRange.selectNodeContents(root)
    endRange.setEnd(range.endContainer, range.endOffset)
    const end = endRange.toString().length

    onTextSelect?.({ blockId: block.id, start, end })
  }

  return (
    <div className="block-wrapper" style={{ position: 'relative' }}>
      <div className="block-controls">
        <button 
          className="action-icon" 
          onClick={(e) => { e.stopPropagation(); onRemove() }} 
          style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.8)', border: `1px solid ${c.border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <MaterialSymbol name="close" size={14} />
        </button>
      </div>
      <div
        ref={rootRef}
        className="editor-input"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
        onMouseUp={rememberSelection}
        onKeyDown={(e) => {
          const isMod = e.metaKey || e.ctrlKey
          const key = e.key.toLowerCase()
          if (isMod && key === 'b') {
            e.preventDefault()
            document.execCommand('bold', false)
            return
          }
          if (isMod && key === 'i') {
            e.preventDefault()
            document.execCommand('italic', false)
            return
          }
          if (isMod && e.shiftKey && key === 'x') {
            e.preventDefault()
            document.execCommand('strikeThrough', false)
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            document.execCommand('insertLineBreak')
          }
        }}
        onKeyUp={(e) => {
          rememberSelection()
        }}
        onInput={onInput}
        style={{ 
          minHeight: 28, 
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.03)',
          lineHeight: 1.65, 
          fontSize: 16, 
          color: '#37352F',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        data-placeholder="Начните писать..."
      />
    </div>
  )
}

const row = (justify = 'flex-start', gap = 8): React.CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: justify, gap, flexWrap: 'wrap' })
const sidebarBtn = (active: boolean): React.CSSProperties => ({ 
  display: 'flex', 
  alignItems: 'center', 
  gap: 14, 
  width: '100%', 
  padding: '10px 16px', 
  borderRadius: 14, 
  cursor: 'pointer', 
  fontSize: 14, 
  fontWeight: 600, 
  transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
  background: active ? 'rgba(255, 255, 255, 0.7)' : 'transparent',
  border: active ? '1px solid rgba(255, 255, 255, 0.5)' : '1px solid transparent',
  backdropFilter: active ? 'blur(10px)' : 'none',
  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.03)' : 'none',
  color: active ? '#0F172A' : '#64748B'
})
const menuBtn: React.CSSProperties = { width: '100%', border: 0, borderRadius: 12, background: 'transparent', color: c.text, padding: '12px 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }
const iconBtn: React.CSSProperties = { border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted }
const editor: React.CSSProperties = { position: 'relative', padding: 20, background: '#fff', border: `1px solid ${c.border}`, borderRadius: 20 }
const input: React.CSSProperties = { border: `1px solid ${c.border}`, borderRadius: 16, padding: '14px 20px', fontSize: 15, fontWeight: 500, outline: 'none', width: '100%' }
const btn = (bg: string, border: string, color = '#fff'): React.CSSProperties => ({ background: bg, border: `1px solid ${border}`, color, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s' })
const actionIconBtn: React.CSSProperties = { border: 'none', background: 'transparent', width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const pill: React.CSSProperties = { background: 'rgba(0,0,0,0.04)', padding: '4px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }
const toolBtn: React.CSSProperties = { border: 'none', background: 'transparent', width: 44, height: 44, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }
const noteModalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(9, 9, 11, 0.4)', backdropFilter: 'blur(20px)', padding: 20 }
const noteModalPanel: React.CSSProperties = { background: '#fff', width: 'min(100%, 1100px)', height: 'min(100%, 92vh)', borderRadius: 32, overflow: 'auto', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.2)', position: 'relative' }
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(9, 9, 11, 0.6)', backdropFilter: 'blur(12px)', padding: 20 }
const modalPanel: React.CSSProperties = { background: '#fff', borderRadius: 32, width: 'min(100%, 480px)', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.2)' }
const tableMenuBtn: React.CSSProperties = { width: '100%', border: 0, borderRadius: 8, background: 'transparent', color: '#334155', padding: '9px 12px', fontSize: 13, fontWeight: 500, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }
const tableActionBtn: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 4,
  background: '#fff',
  border: '1px solid #E2E8F0',
  color: '#94A3B8',
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 100
}
const tableHandle: React.CSSProperties = {
  position: 'absolute',
  background: '#F1F5F9',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  color: '#94A3B8'
}
const tableInsertionLine: React.CSSProperties = {
  position: 'absolute',
  background: '#3B82F6',
  opacity: 0,
  transition: 'opacity 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60
}

function TableDimensionPicker({ x, y, onSelect, onClose }: { x: number, y: number, onSelect: (r: number, c: number) => void, onClose: () => void }) {
  const [hovered, setHovered] = useState({ r: 0, c: 0 })
  const grid = Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => ({ r: r + 1, c: c + 1 })))

  return (
    <div 
      style={{ 
        position: 'fixed', 
        left: Math.min(x, window.innerWidth - 220), 
        bottom: window.innerHeight - y + 10,
        zIndex: 1400, 
        background: '#fff', 
        border: '1px solid #E2E8F0', 
        borderRadius: 14, 
        boxShadow: '0 20px 50px rgba(15,23,42,0.2)', 
        padding: 12 
      }}
      onMouseLeave={() => setHovered({ r: 0, c: 0 })}
    >
      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'flex', justifyContent: 'space-between' }}>
        <span>Вставить таблицу</span>
        <span style={{ color: '#2563EB' }}>{hovered.r > 0 ? `${hovered.r} x ${hovered.c}` : 'Выберите размер'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {grid.flat().map((cell) => {
          const isSelected = cell.r <= hovered.r && cell.c <= hovered.c
          return (
            <div
              key={`${cell.r}-${cell.c}`}
              onMouseEnter={() => setHovered({ r: cell.r, c: cell.c })}
              onClick={() => onSelect(cell.r, cell.c)}
              style={{
                width: 18,
                height: 18,
                border: '1px solid #E2E8F0',
                borderRadius: 4,
                background: isSelected ? '#DBEAFE' : '#F8FAFC',
                borderColor: isSelected ? '#3B82F6' : '#E2E8F0',
                cursor: 'pointer',
                transition: 'all 0.1s'
              }}
            />
          )
        })}
      </div>
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: -1 }}
      />
    </div>
  )
}
