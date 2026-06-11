import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../../../domain/entities/Note'
import { HttpError } from '../../../infrastructure/http/HttpError'
import { HttpAlemAiRepository } from '../../../infrastructure/repositories/HttpAlemAiRepository'
import { HttpNoteRepository } from '../../../infrastructure/repositories/HttpNoteRepository'
import type {
  MeetingAiAnalyzeJob,
  MeetingAiAnalyzeJobActionItem,
  MeetingAiLanguage,
} from '../alemai/meeting-ai/types'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { bid } from './noteDocumentUtils'
import { normalizeMeetingJobResult } from './meetingAiResultUtils'
import MeetingAudioNoteView from './MeetingAudioNoteView'

const c = {
  border: '#DDE3EE',
  text: '#0A1628',
  muted: '#8497B4',
  brand: '#1E88E5',
  danger: '#DC2626',
  success: '#15803D',
}

const POLL_MS = 2500
const ACTIVE = new Set(['queued', 'running'])

const statusLabel: Record<string, string> = {
  queued: 'В очереди',
  running: 'Обработка',
  completed: 'Готово',
  failed: 'Ошибка',
}

const formatDate = (v?: string) => {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const actionItemText = (item: string | MeetingAiAnalyzeJobActionItem) => {
  if (typeof item === 'string') return item
  const parts = [item.task, item.owner ? `(${item.owner})` : '', item.deadline ? `до ${item.deadline}` : ''].filter(Boolean)
  return parts.join(' ')
}

interface NotesMeetingAiPanelProps {
  repository: HttpAlemAiRepository
  notesRepo: HttpNoteRepository
  onNoteCreated: (note: Note) => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

export default function NotesMeetingAiPanel({
  repository,
  notesRepo,
  onNoteCreated,
  showError,
  showSuccess,
}: NotesMeetingAiPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [lang, setLang] = useState<MeetingAiLanguage>('ru')
  const [model, setModel] = useState('')
  const [jobs, setJobs] = useState<MeetingAiAnalyzeJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [creatingNote, setCreatingNote] = useState(false)
  const [isRec, setIsRec] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const mrRef = useRef<MediaRecorder | null>(null)
  const stRef = useRef<MediaStream | null>(null)
  const chRef = useRef<Blob[]>([])
  const tmRef = useRef<number | null>(null)

  const selectedJob = useMemo(
    () => jobs.find((j) => j.job_id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )

  const upsertJob = useCallback((job: MeetingAiAnalyzeJob) => {
    setJobs((prev) => {
      const next = prev.some((j) => j.job_id === job.job_id)
        ? prev.map((j) => (j.job_id === job.job_id ? { ...j, ...job } : j))
        : [job, ...prev]
      return next.sort(
        (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime(),
      )
    })
  }, [])

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      const list = await repository.listMeetingAnalyzeJobs()
      setJobs(list)
      setSelectedJobId((prev) => prev ?? list[0]?.job_id ?? null)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось загрузить задания')
    } finally {
      setLoadingJobs(false)
    }
  }, [repository, showError])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (!selectedJobId) return
    const job = jobs.find((j) => j.job_id === selectedJobId)
    if (!job || !ACTIVE.has(job.status)) return

    const tick = async () => {
      try {
        const fresh = await repository.getMeetingAnalyzeJob(selectedJobId)
        upsertJob(fresh)
      } catch {
        /* ignore transient poll errors */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    return () => window.clearInterval(id)
  }, [jobs, repository, selectedJobId, upsertJob])

  const clearRecTimer = () => {
    if (tmRef.current !== null) {
      window.clearInterval(tmRef.current)
      tmRef.current = null
    }
  }

  const stopStream = () => {
    stRef.current?.getTracks().forEach((t) => t.stop())
    stRef.current = null
  }

  const startAnalyze = async (targetFile?: File | null) => {
    const audio = targetFile ?? file
    if (!audio) {
      showError('Выберите или запишите аудиофайл')
      return
    }
    setSubmitting(true)
    try {
      const created = await repository.startMeetingAnalyzeAsync(audio, {
        reportLanguage: lang,
        model: model.trim() || undefined,
      })
      const job: MeetingAiAnalyzeJob = {
        job_id: created.job_id,
        status: created.status,
        created_at: created.created_at,
        updated_at: created.updated_at,
        filename: audio.name,
        result: null,
        error: null,
      }
      upsertJob(job)
      setSelectedJobId(job.job_id)
      showSuccess('Анализ запущен')
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        showError('Сессия истекла. Войдите снова.')
      } else {
        showError(e instanceof Error ? e.message : 'Не удалось запустить анализ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startRecording = async () => {
    if (isRec || submitting) return
    if (!('mediaDevices' in navigator) || !('MediaRecorder' in window)) {
      showError('Запись не поддерживается в этом браузере')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stRef.current = stream
      chRef.current = []
      setRecSec(0)
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mrRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chRef.current, { type: rec.mimeType || 'audio/webm' })
        const recorded = new File([blob], `meeting-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
        setFile(recorded)
        setIsRec(false)
        clearRecTimer()
        stopStream()
        void startAnalyze(recorded)
      }
      rec.start(1000)
      setIsRec(true)
      tmRef.current = window.setInterval(() => setRecSec((s) => s + 1), 1000)
    } catch {
      showError('Нет доступа к микрофону')
      setIsRec(false)
      clearRecTimer()
      stopStream()
    }
  }

  const stopRecording = () => {
    const rec = mrRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop()
      return
    }
    setIsRec(false)
    clearRecTimer()
    stopStream()
  }

  useEffect(() => () => {
    stopStream()
    clearRecTimer()
  }, [])

  const displayResult = useMemo(
    () => normalizeMeetingJobResult(selectedJob?.result),
    [selectedJob?.result],
  )

  const createNoteFromJob = async () => {
    if (!displayResult) return
    const { summaryText, transcriptText, actionItems } = displayResult
    const blocks: Array<{ id: string; type: 'paragraph'; runs: Array<{ text: string; marks?: string[] }> }> = []
    if (summaryText) {
      blocks.push({ id: bid('p'), type: 'paragraph', runs: [{ text: summaryText, marks: ['bold'] }] })
    }
    if (transcriptText) {
      blocks.push({ id: bid('p'), type: 'paragraph', runs: [{ text: transcriptText }] })
    }
    if (actionItems.length) {
      const lines = actionItems.map((item, i) => `${i + 1}. ${actionItemText(item)}`).join('\n')
      blocks.push({
        id: bid('p'),
        type: 'paragraph',
        runs: [{ text: `Следующие шаги:\n${lines}` }],
      })
    }
    if (!blocks.length) {
      showError('Нет текста для заметки')
      return
    }

    setCreatingNote(true)
    try {
      const titleBase = selectedJob?.filename?.replace(/\.[^.]+$/, '') || 'Совещание'
      const plain = [summaryText, transcriptText].filter(Boolean).join('\n\n')
      const note = await notesRepo.createNote({
        title: titleBase.slice(0, 120),
        content: plain,
        type: 'rich',
        content_doc: { type: 'doc', version: 1, blocks },
        folder_id: null,
        is_pinned: false,
        is_archived: false,
      })
      showSuccess('Заметка создана')
      onNoteCreated(note)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Не удалось создать заметку')
    } finally {
      setCreatingNote(false)
    }
  }

  const mm = Math.floor(recSec / 60).toString().padStart(2, '0')
  const ss = (recSec % 60).toString().padStart(2, '0')
  const showAudioNoteView = selectedJob?.status === 'completed' && displayResult

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <MaterialSymbol name="mic" size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: c.text }}>Анализ совещаний</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: c.muted }}>
              Загрузите запись — получите транскрипт, резюме и задачи
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr' }}>
        <aside style={{ borderRight: `1px solid ${c.border}`, padding: 16, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase', marginBottom: 10 }}>
            Новый анализ
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.wav,.ogg,.webm,.mp4,.m4a,audio/*"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileRef.current?.click()
              }
            }}
            style={{
              width: '100%',
              border: `2px dashed ${file ? '#BFDBFE' : c.border}`,
              borderRadius: 12,
              padding: '14px 12px',
              background: file ? '#EFF6FF' : '#fff',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <MaterialSymbol name={file ? 'audio_file' : 'upload'} size={22} color={file ? c.brand : c.muted} />
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: file ? c.brand : c.text }}>
              {file ? file.name : 'Загрузить аудио'}
            </div>
            {file ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    setFile(null)
                  }
                }}
                style={{ display: 'inline-block', marginTop: 4, color: c.muted, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Убрать файл
              </span>
            ) : (
              <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>mp3 · wav · webm · m4a</div>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              border: `2px dashed ${isRec ? '#FECACA' : c.border}`,
              borderRadius: 12,
              padding: '12px',
              textAlign: 'center',
              background: isRec ? '#FEF2F2' : '#fff',
            }}
          >
            <button
              type="button"
              onClick={() => (isRec ? stopRecording() : void startRecording())}
              disabled={submitting}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 0,
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: isRec ? '#EF4444' : '#F1F5F9',
                color: isRec ? '#fff' : c.muted,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialSymbol name={isRec ? 'stop' : 'mic'} size={22} />
            </button>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: isRec ? c.danger : c.text }}>
              {isRec ? `Запись ${mm}:${ss}` : 'Запись с микрофона'}
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase' }}>Язык отчёта</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as MeetingAiLanguage)}
              style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
            >
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
            </select>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Модель (необязательно)"
              style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
            />
          </div>

          <button
            type="button"
            className="primary-btn"
            disabled={!file || submitting || isRec}
            onClick={() => void startAnalyze()}
            style={{
              width: '100%',
              marginTop: 12,
              justifyContent: 'center',
              opacity: !file || submitting || isRec ? 0.6 : 1,
              cursor: !file || submitting || isRec ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Запуск...' : 'Запустить анализ'}
          </button>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase' }}>Задания</span>
            <button
              type="button"
              onClick={() => void loadJobs()}
              disabled={loadingJobs}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: c.brand, fontSize: 12, fontWeight: 600 }}
            >
              Обновить
            </button>
          </div>

          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {jobs.length ? jobs.map((job) => {
              const active = job.job_id === selectedJobId
              const statusColor =
                job.status === 'completed' ? c.success : job.status === 'failed' ? c.danger : c.brand
              return (
                <button
                  key={job.job_id}
                  type="button"
                  onClick={() => setSelectedJobId(job.job_id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: `1px solid ${active ? c.brand : c.border}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    background: active ? '#F0F7FF' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.filename || 'Аудио'}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel[job.status] ?? job.status}</span>
                    <span style={{ color: c.muted }}>{formatDate(job.updated_at || job.created_at)}</span>
                  </div>
                </button>
              )
            }) : (
              <div style={{ fontSize: 12, color: c.muted, padding: '8px 0' }}>
                {loadingJobs ? 'Загрузка...' : 'Пока нет заданий'}
              </div>
            )}
          </div>
        </aside>

        <section style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedJob ? (
            <div style={{ textAlign: 'center', color: c.muted, padding: '48px 16px' }}>
              <MaterialSymbol name="graphic_eq" size={40} />
              <p style={{ marginTop: 12, fontSize: 14 }}>Выберите задание или запустите новый анализ</p>
            </div>
          ) : showAudioNoteView ? (
            <MeetingAudioNoteView
              job={selectedJob}
              result={displayResult}
              repository={repository}
              onCreateNote={() => void createNoteFromJob()}
              creatingNote={creatingNote}
            />
          ) : (
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedJob.filename || 'Результат анализа'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: c.muted }}>
                  {statusLabel[selectedJob.status] ?? selectedJob.status}
                  {ACTIVE.has(selectedJob.status) ? ' — обновляем автоматически' : ''}
                </p>
              </div>

              {selectedJob.status === 'failed' && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#FEF2F2', color: c.danger, fontSize: 13 }}>
                  {selectedJob.error || 'Анализ завершился с ошибкой'}
                </div>
              )}

              {ACTIVE.has(selectedJob.status) && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#EFF6FF', color: c.brand, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Обрабатываем аудио. Это может занять несколько минут.
                </div>
              )}

              {selectedJob.status === 'completed' && !displayResult && (
                <div style={{ marginTop: 20, color: c.muted, fontSize: 13 }}>Анализ завершён, но результат пустой.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
