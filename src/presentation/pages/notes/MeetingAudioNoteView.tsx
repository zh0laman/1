import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HttpAlemAiRepository } from '../../../infrastructure/repositories/HttpAlemAiRepository'
import type { MeetingAiAnalyzeJob, MeetingAiAnalyzeJobActionItem } from '../alemai/meeting-ai/types'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { NormalizedMeetingResult } from './meetingAiResultUtils'

type DetailTab = 'summary' | 'transcript' | 'chat'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const accent = '#1E88E5'
const accentLight = '#EBF4FE'

const c = {
  border: '#E5E7EB',
  text: '#111827',
  muted: '#9CA3AF',
  surface: '#F9FAFB',
}

const formatNoteDate = (v?: string) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
}

const actionItemText = (item: string | MeetingAiAnalyzeJobActionItem) => {
  if (typeof item === 'string') return item
  return [item.task, item.owner ? `(${item.owner})` : '', item.deadline ? `by ${item.deadline}` : '']
    .filter(Boolean)
    .join(' ')
}

function SegmentedTabs({
  tab,
  onChange,
}: {
  tab: DetailTab
  onChange: (t: DetailTab) => void
}) {
  const items: { id: DetailTab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'chat', label: 'AI-Chat' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        background: c.surface,
        borderRadius: 999,
        border: `1px solid ${c.border}`,
      }}
    >
      {items.map((item) => {
        const active = tab === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              flex: 1,
              border: 0,
              borderRadius: 999,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: active ? accent : 'transparent',
              color: active ? '#fff' : c.text,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function SummaryContent({ result }: { result: NormalizedMeetingResult }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {result.summaryText ? (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: c.text }}>Overview</h4>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap' }}>
            {result.summaryText}
          </p>
        </div>
      ) : null}

      {result.topics.length > 0 ? (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: c.text }}>Key Themes</h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {result.topics.map((t, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: '#374151' }}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.actionItems.length > 0 ? (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: c.text }}>Action Items</h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {result.actionItems.map((item, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: '#374151' }}>{actionItemText(item)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.openQuestions.length > 0 ? (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: c.text }}>Open Questions</h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {result.openQuestions.map((t, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: '#374151' }}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.risks.length > 0 ? (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: c.text }}>Risks</h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {result.risks.map((t, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: '#374151' }}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!result.summaryText && !result.topics.length && !result.actionItems.length ? (
        <p style={{ margin: 0, color: c.muted, fontSize: 14 }}>No summary available.</p>
      ) : null}
    </div>
  )
}

interface MeetingAudioNoteViewProps {
  job: MeetingAiAnalyzeJob
  result: NormalizedMeetingResult
  repository: HttpAlemAiRepository
  onCreateNote: () => void
  creatingNote: boolean
}

export default function MeetingAudioNoteView({
  job,
  result,
  repository,
  onCreateNote,
  creatingNote,
}: MeetingAudioNoteViewProps) {
  const [tab, setTab] = useState<DetailTab>('summary')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatIdRef = useRef<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const title = job.filename?.replace(/\.[^.]+$/, '') || 'Audio Note'
  const metaDate = formatNoteDate(job.created_at || job.updated_at)

  const meetingContext = useMemo(
    () =>
      [
        result.summaryText && `Summary:\n${result.summaryText}`,
        result.transcriptText && `Transcript:\n${result.transcriptText.slice(0, 14000)}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    [result],
  )

  useEffect(() => {
    setTab('summary')
    setChatInput('')
    setChatMessages([])
    chatIdRef.current = null
  }, [job.job_id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const downloadNote = useCallback(() => {
    const body = [
      `# ${title}`,
      metaDate ? `Date: ${metaDate}` : '',
      '',
      '## Summary',
      result.summaryText || '—',
      '',
      '## Transcript',
      result.transcriptText || '—',
    ].join('\n')
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [metaDate, result, title])

  const sendChat = async () => {
    const question = chatInput.trim()
    if (!question || chatLoading || !meetingContext) return

    const nextUser: ChatMessage = { role: 'user', content: question }
    const history = [...chatMessages]
    setChatMessages([...history, nextUser])
    setChatInput('')
    setChatLoading(true)

    try {
      const prompt = [
        'You are an AI assistant for an audio meeting note. Answer only based on the meeting context below.',
        'If the answer is not in the context, say so briefly.',
        '',
        meetingContext,
        '',
        `User question: ${question}`,
      ].join('\n')

      const res = await repository.askQuestion({
        question: prompt,
        conv_id: chatIdRef.current ?? undefined,
        conversation_history: history.map((m) => ({ role: m.role, content: m.content })),
      })

      chatIdRef.current = res.convId
      const assistantText = res.answer?.trim() || 'No response.'
      setChatMessages((prev) => [...prev, { role: 'assistant', content: assistantText }])
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Failed to get a response' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <MaterialSymbol name="graphic_eq" size={22} color={accent} />
          <span style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Audio Note</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={onCreateNote}
            disabled={creatingNote}
            title="Create note"
            style={{
              border: `1px solid ${accent}`,
              background: accentLight,
              color: accent,
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: creatingNote ? 'not-allowed' : 'pointer',
              opacity: creatingNote ? 0.7 : 1,
            }}
          >
            {creatingNote ? '...' : 'Save note'}
          </button>
          <button
            type="button"
            onClick={downloadNote}
            title="Download"
            style={{
              width: 36,
              height: 36,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.text,
            }}
          >
            <MaterialSymbol name="download" size={22} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: c.text, lineHeight: 1.2 }}>{title}</h1>
        {metaDate ? (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: c.muted }}>{metaDate}</p>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <SegmentedTabs tab={tab} onChange={setTab} />
        </div>

        <div style={{ marginTop: 22, paddingBottom: 16 }}>
          {tab === 'summary' && <SummaryContent result={result} />}

          {tab === 'transcript' && (
            result.transcriptText ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#374151', whiteSpace: 'pre-wrap' }}>
                {result.transcriptText}
              </p>
            ) : (
              <p style={{ margin: 0, color: c.muted, fontSize: 14 }}>No transcript available.</p>
            )
          )}

          {tab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 280 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {chatMessages.length === 0 && !chatLoading ? (
                  <div
                    style={{
                      padding: 24,
                      borderRadius: 16,
                      background: accentLight,
                      textAlign: 'center',
                    }}
                  >
                    <MaterialSymbol name="smart_toy" size={32} color={accent} />
                    <p style={{ margin: '12px 0 0', fontSize: 14, color: '#4B5563', lineHeight: 1.5 }}>
                      Ask anything about this meeting — summary, decisions, or details from the transcript.
                    </p>
                  </div>
                ) : null}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: msg.role === 'user' ? accent : '#F3F4F6',
                      color: msg.role === 'user' ? '#fff' : c.text,
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                  </div>
                ))}
                {chatLoading ? (
                  <div style={{ fontSize: 13, color: c.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Thinking...
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendChat()
                    }
                  }}
                  placeholder="Ask about this meeting..."
                  rows={2}
                  disabled={chatLoading || !meetingContext}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: `1px solid ${c.border}`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: 14,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={() => void sendChat()}
                  disabled={chatLoading || !chatInput.trim() || !meetingContext}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: 0,
                    background: accent,
                    color: '#fff',
                    cursor: chatLoading ? 'not-allowed' : 'pointer',
                    opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MaterialSymbol name="send" size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
