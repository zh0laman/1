import type { MeetingAiAnalyzeJobActionItem, MeetingAiAnalyzeJobResult } from '../alemai/meeting-ai/types'

export interface NormalizedMeetingResult {
  summaryText: string
  transcriptText: string
  actionItems: Array<string | MeetingAiAnalyzeJobActionItem>
  topics: string[]
  openQuestions: string[]
  risks: string[]
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const asList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object' && 'text' in item) {
        return asText((item as { text?: unknown }).text)
      }
      return ''
    })
    .filter(Boolean)
}

const asActionItems = (value: unknown): Array<string | MeetingAiAnalyzeJobActionItem> => {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string | MeetingAiAnalyzeJobActionItem =>
      typeof item === 'string' || (typeof item === 'object' && item !== null),
  )
}

export const normalizeMeetingJobResult = (raw: MeetingAiAnalyzeJobResult | null | undefined): NormalizedMeetingResult | null => {
  if (!raw || typeof raw !== 'object') return null

  const payload = raw as Record<string, unknown>
  let transcriptText = asText(payload.transcript)
  if (!transcriptText && payload.transcription && typeof payload.transcription === 'object') {
    const transcription = payload.transcription as Record<string, unknown>
    transcriptText =
      asText(transcription.text) || asText(transcription.corrected_text) || asText(transcription.raw_text)
  }

  let summaryText = ''
  let topics: string[] = []
  let openQuestions: string[] = []
  let risks: string[] = []
  let actionItems = asActionItems(payload.action_items)

  const summaryRaw = payload.summary
  if (typeof summaryRaw === 'string') {
    summaryText = summaryRaw
  } else if (summaryRaw && typeof summaryRaw === 'object') {
    const summary = summaryRaw as Record<string, unknown>
    const shortSummary = asText(summary.short_summary) || asText(summary.summary)
    const detailedSummary = asText(summary.detailed_summary)
    summaryText = [shortSummary, detailedSummary].filter(Boolean).join('\n\n')
    topics = asList(summary.topics)
    openQuestions = asList(summary.open_questions)
    risks = asList(summary.risks)
    if (!actionItems.length) {
      actionItems = asActionItems(summary.action_items)
    }
  }

  if (!summaryText && !transcriptText && !actionItems.length && !topics.length) {
    return null
  }

  return {
    summaryText,
    transcriptText,
    actionItems,
    topics,
    openQuestions,
    risks,
  }
}
