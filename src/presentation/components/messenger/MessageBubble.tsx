import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChatReaction } from '../../../domain/entities/Chat'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import EmojiGlyph from './EmojiGlyph'
import type { MessageView } from './types'
import { formatRecordingDuration, hasVoiceMarker, getFileExtension, iconByExtension } from './utils'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import { authorizedFetch } from '../../../infrastructure/http/authorizedFetch'
import { SmartAgentWidgetRenderer } from './SmartAgentWidgetRenderer'
import type { SmartAgentWidget } from '../../pages/alemai/smart-agent/types'

const authSessionStore = new LocalStorageAuthSessionStore()

const isFallbackCaption = (text: string | null | undefined, type: string): boolean => {
  if (!text) return true
  const trimmed = text.trim()
  if (type === 'image' && trimmed === 'Изображение') return true
  if (type === 'video' && trimmed === 'Видео') return true
  if (type === 'file' && trimmed === 'Файл') return true
  if (type === 'audio' && trimmed === 'Аудиосообщение') return true
  if (type === 'voice' && trimmed === 'Голосовое сообщение') return true
  if (type === 'video_message' && trimmed === 'Видеосообщение') return true
  return false
}

const CHAT_FONT_STACK = '"Roboto", sans-serif'
const IOS_BUBBLE_RADIUS_OUTGOING = '22px 22px 6px 22px'
const IOS_BUBBLE_RADIUS_INCOMING = '22px 22px 22px 6px'
const IOS_INCOMING_BG = '#F2F2F7'
const IOS_INCOMING_BORDER = '#E5E7EF'
const EMOJI_TOKEN_SOURCE = String.raw`\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?)*)`
const EMOJI_SPLIT_REGEX = new RegExp(`(${EMOJI_TOKEN_SOURCE})`, 'gu')
const EMOJI_EXACT_REGEX = new RegExp(`^${EMOJI_TOKEN_SOURCE}$`, 'u')

function QuotedMessage({ replyTo, isMe, outgoingPalette }: { replyTo: NonNullable<MessageView['replyTo']>; isMe: boolean; outgoingPalette: ReturnType<typeof buildOutgoingPalette> }) {
  return (
    <div
      style={{
        marginBottom: 6,
        padding: '5px 9px',
        borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.6)' : C.blue}`,
        borderRadius: 6,
        background: isMe ? 'rgba(255,255,255,0.14)' : 'rgba(44,140,255,0.08)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: isMe ? outgoingPalette.accent : C.blue,
          marginBottom: 2,
          fontFamily: CHAT_FONT_STACK,
        }}
      >
        {replyTo.senderFullName}
      </div>
      <div
        style={{
          fontSize: 12,
          color: isMe ? outgoingPalette.textMuted : C.inkMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 220,
          fontFamily: CHAT_FONT_STACK,
        }}
      >
        {replyTo.attachmentUrl ? `📎 ${replyTo.attachmentType ?? 'Файл'}` : replyTo.content}
      </div>
    </div>
  )
}

interface MessageBubbleTheme {
  outgoingColorHex?: string | null
}

interface MessageReactionsProps {
  reactions: ChatReaction[]
  isMe: boolean
  onReact: (emoji: string) => void
  onUnreact: (emoji: string) => void
  outgoingPalette: ReturnType<typeof buildOutgoingPalette>
}

function MessageReactions({ reactions, isMe, onReact, onUnreact, outgoingPalette }: MessageReactionsProps) {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null)
  if (!reactions || reactions.length === 0) return null

  return (
    <div
      data-no-message-select="true"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        paddingLeft: isMe ? 0 : 2,
        paddingRight: isMe ? 2 : 0,
      }}
    >
      {reactions.map((r) => {
        const isActive = r.reacted
        const isHovered = hoveredEmoji === r.reaction
        const tooltipNames = r.users.map((u) => u.fullName).filter(Boolean)
        const tooltipText =
          tooltipNames.length === 0
            ? `${r.count}`
            : tooltipNames.length <= 3
              ? tooltipNames.join(', ')
              : `${tooltipNames.slice(0, 3).join(', ')} и ещё ${r.count - 3}`

        return (
          <div key={r.reaction} style={{ position: 'relative' }}>
            {isHovered && tooltipText ? (
              <div
                style={{
                  position: 'absolute',
                  bottom: '110%',
                  [isMe ? 'right' : 'left']: 0,
                  background: 'rgba(20,28,42,0.92)',
                  color: '#F4F6FB',
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  borderRadius: 8,
                  padding: '5px 8px',
                  whiteSpace: 'nowrap',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pointerEvents: 'none',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
                  fontFamily: '"Roboto", sans-serif',
                }}
              >
                {tooltipText}
              </div>
            ) : null}
            <button
              type="button"
              onMouseEnter={() => setHoveredEmoji(r.reaction)}
              onMouseLeave={() => setHoveredEmoji(null)}
              onClick={() => {
                if (isActive) {
                  onUnreact(r.reaction)
                } else {
                  onReact(r.reaction)
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '3px 7px',
                borderRadius: 999,
                border: isActive
                  ? `1.5px solid ${isMe ? 'rgba(255,255,255,0.48)' : '#4C9EFF'}`
                  : `1.5px solid ${isMe ? 'rgba(255,255,255,0.18)' : 'rgba(10,22,40,0.12)'}`,
                background: isActive
                  ? isMe
                    ? 'rgba(255,255,255,0.22)'
                    : 'rgba(76,158,255,0.12)'
                  : isMe
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,255,255,0.72)',
                cursor: 'pointer',
                fontFamily: '"Roboto", sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? (isMe ? '#FFFFFF' : '#1F7BFF') : isMe ? outgoingPalette.textMuted : C.inkMuted,
                lineHeight: 1,
                transition: 'background 0.14s ease, border-color 0.14s ease, transform 0.1s ease',
                boxShadow: isActive ? '0 2px 8px rgba(76,158,255,0.18)' : 'none',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{r.reaction}</span>
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: r.count >= 10 ? 16 : 10 }}>{r.count}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

const normalizeHexColor = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  return null
}

const hexToRgb = (value: string): [number, number, number] | null => {
  const normalized = normalizeHexColor(value)
  if (!normalized) {
    return null
  }

  const parsed = Number.parseInt(normalized.slice(1), 16)
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255]
}

const withAlpha = (value: string, alpha: number): string => {
  const rgb = hexToRgb(value)
  if (!rgb) {
    return `rgba(46, 120, 246, ${alpha})`
  }

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

const mixHex = (value: string, target: string, ratio: number): string => {
  const fromRgb = hexToRgb(value)
  const toRgb = hexToRgb(target)

  if (!fromRgb || !toRgb) {
    return value
  }

  const mixed = fromRgb.map((channel, index) => Math.round(channel + (toRgb[index] - channel) * ratio))
  return `#${mixed.map((item) => item.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

const isDarkColor = (value: string): boolean => {
  const rgb = hexToRgb(value)
  if (!rgb) {
    return true
  }

  const [r, g, b] = rgb
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.58
}

interface MessagePalette {
  solid: string
  gradientStart: string
  soft: string
  softStrong: string
  border: string
  shadow: string
  text: string
  textMuted: string
  badgeBg: string
  badgeText: string
  accent: string
}

function buildOutgoingPalette(value?: string | null): MessagePalette {
  const themed = normalizeHexColor(value)
  const base = themed ?? '#0A84FF'
  const isDark = isDarkColor(base)

  return {
    solid: base,
    gradientStart: mixHex(base, '#FFFFFF', 0.08),
    soft: withAlpha(base, 0.14),
    softStrong: withAlpha(base, 0.18),
    border: withAlpha(base, 0.2),
    shadow: withAlpha(base, 0.26),
    text: isDark ? '#FFFFFF' : '#102033',
    textMuted: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(16,32,51,0.72)',
    badgeBg: isDark ? 'rgba(255,255,255,0.14)' : withAlpha(base, 0.14),
    badgeText: isDark ? '#FFFFFF' : base,
    accent: isDark ? '#FFFFFF' : base,
  }
}

const isEmojiToken = (value: string): boolean => EMOJI_EXACT_REGEX.test(value)

const isEmojiOnlyText = (value: string): boolean => {
  const compact = value.replace(/\s+/g, '')
  if (!compact) {
    return false
  }

  return compact.replace(new RegExp(EMOJI_TOKEN_SOURCE, 'gu'), '').length === 0
}

const renderTaggedText = (
  text: string,
  msgId: string,
  isMe: boolean,
  outgoingPalette: MessagePalette,
  emojiOnlyMessage = false,
) => {
  const emojiSize = emojiOnlyMessage ? 30 : 22
  const lines = text.split('\n')

  return lines.map((line, lineIndex) => {
    const parts = line.split(/(https?:\/\/[^\s]+|alem\.me\/[a-zA-Z0-9._-]+|@[a-zA-Z0-9._-]+)/g)

    return (
      <span key={`${msgId}-line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          if (!part) {
            return null
          }

          if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
            return (
              <Link
                key={`${msgId}-part-${lineIndex}-${partIndex}`}
                to={`/messenger/${part}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-block',
                  padding: '0 3px',
                  margin: '0 1px',
                  borderRadius: 5,
                  background: isMe ? outgoingPalette.badgeBg : 'rgba(76,158,255,0.12)',
                  color: isMe ? outgoingPalette.text : '#2C8CFF',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  textShadow: isMe ? '0 1px 0 rgba(10,22,40,0.08)' : 'none',
                  fontFamily: CHAT_FONT_STACK,
                  textDecoration: 'none',
                }}
              >
                {part}
              </Link>
            )
          }

          if (/^(https?:\/\/[^\s]+|alem\.me\/[a-zA-Z0-9._-]+)$/.test(part)) {
            const url = part.startsWith('alem.me/') ? `https://${part}` : part
            const isInternal =
              part.startsWith('alem.me/') || part.startsWith('https://alem.me/') || part.startsWith('http://alem.me/')

            if (isInternal) {
              const usernameParts = part.split('alem.me/')
              const username = usernameParts[1]?.replace(/\/$/, '')
              if (username) {
                return (
                  <Link
                    key={`${msgId}-part-${lineIndex}-${partIndex}`}
                    to={`/messenger/@${username}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: isMe ? outgoingPalette.text : '#2C8CFF',
                      textDecoration: 'underline',
                      wordBreak: 'break-all',
                    }}
                  >
                    {part}
                  </Link>
                )
              }
            }

            return (
              <a
                key={`${msgId}-part-${lineIndex}-${partIndex}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: isMe ? outgoingPalette.text : '#2C8CFF',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                }}
              >
                {part}
              </a>
            )
          }

          const emojiSegments = part.split(EMOJI_SPLIT_REGEX)

          return (
            <span key={`${msgId}-part-${lineIndex}-${partIndex}`}>
              {emojiSegments.map((segment, segmentIndex) => {
                if (!segment) {
                  return null
                }

                if (isEmojiToken(segment)) {
                  return (
                    <span
                      key={`${msgId}-emoji-${lineIndex}-${partIndex}-${segmentIndex}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        verticalAlign: emojiOnlyMessage ? '-0.16em' : '-0.24em',
                        margin: emojiOnlyMessage ? '0 1px' : '0 0.02em',
                      }}
                    >
                      <EmojiGlyph emoji={segment} size={emojiSize} />
                    </span>
                  )
                }

                return <span key={`${msgId}-text-${lineIndex}-${partIndex}-${segmentIndex}`}>{segment}</span>
              })}
            </span>
          )
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    )
  })
}

const formatAttachmentSize = (value?: number): string | null => {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return null
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`
}

const openAuthenticatedAttachment = async (url: string, filename: string) => {
  const response = await authorizedFetch(authSessionStore, url)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = filename || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

const resolveAttachmentIconName = (icon: NonNullable<MessageView['attachment']>['icon']): string => {
  switch (icon) {
    case 'image':
      return 'image'
    case 'video':
      return 'videocam'
    case 'audio':
      return 'audiotrack'
    case 'pdf':
      return 'picture_as_pdf'
    case 'word':
      return 'description'
    case 'excel':
      return 'table_chart'
    case 'presentation':
      return 'slideshow'
    case 'text':
      return 'notes'
    case 'archive':
      return 'folder_zip'
    default:
      return 'insert_drive_file'
  }
}

const parseJsonRecord = (value: string | null | undefined): Record<string, unknown> | null => {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const readFirstString = (records: Array<Record<string, unknown> | null>, keys: string[]): string | null => {
  for (const record of records) {
    if (!record) {
      continue
    }

    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return null
}

const readFirstNumber = (records: Array<Record<string, unknown> | null>, keys: string[]): number | null => {
  for (const record of records) {
    if (!record) {
      continue
    }

    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value
      }

      if (typeof value === 'string') {
        const normalized = Number(value)
        if (Number.isFinite(normalized) && normalized >= 0) {
          return normalized
        }
      }
    }
  }

  return null
}

const normalizeCallDirection = (value: string | null | undefined): 'incoming' | 'outgoing' | null => {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (
    normalized.includes('outgoing') ||
    normalized.includes('outbound') ||
    normalized.includes('исход') ||
    normalized === 'out'
  ) {
    return 'outgoing'
  }

  if (
    normalized.includes('incoming') ||
    normalized.includes('inbound') ||
    normalized.includes('вход') ||
    normalized === 'in'
  ) {
    return 'incoming'
  }

  return null
}

const normalizeCallStatus = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

const formatCallDurationLabel = (totalSeconds: number): string => {
  if (totalSeconds < 60) {
    return `${totalSeconds} сек`
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return seconds > 0 ? `${hours} ч ${minutes} мин ${seconds} сек` : `${hours} ч ${minutes} мин`
  }

  if (seconds > 0) {
    return `${minutes} мин ${seconds} сек`
  }

  return `${minutes} мин`
}

function CallSummaryBubble({ msg, showSenderLabel, theme, onReact, onUnreact }: { msg: MessageView; showSenderLabel: boolean; theme?: MessageBubbleTheme; onReact?: (messageId: string, emoji: string) => void; onUnreact?: (messageId: string, emoji: string) => void }) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const payloads = [parseJsonRecord(msg.raw.metadata), parseJsonRecord(msg.raw.content)]
  const rawBlob = `${msg.raw.metadata ?? ''} ${msg.raw.content ?? ''} ${msg.text}`.toLowerCase()
  const durationMatch = rawBlob.match(/(\d+)\s*(сек|секунд|sec|secs|second|seconds|с)\b/)
  const inferredDirection =
    normalizeCallDirection(readFirstString(payloads, ['direction', 'call_direction', 'callDirection', 'kind'])) ??
    normalizeCallDirection(rawBlob) ??
    (isMe ? 'outgoing' : 'incoming')
  const normalizedStatus = normalizeCallStatus(readFirstString(payloads, ['status', 'call_status', 'callStatus', 'state'])) ?? normalizeCallStatus(rawBlob)
  const durationSeconds =
    readFirstNumber(payloads, ['duration_seconds', 'durationSeconds', 'call_duration', 'callDuration', 'duration', 'seconds']) ??
    (durationMatch ? Number(durationMatch[1]) : null) ??
    null

  const isMissed =
    normalizedStatus !== null &&
    ['missed', 'no_answer', 'declined', 'busy', 'canceled', 'cancelled', 'пропущ', 'без ответа', 'отклон', 'занят', 'отмен'].some((marker) =>
      normalizedStatus.includes(marker),
    )
  const statusLabel =
    normalizedStatus?.includes('missed') || normalizedStatus?.includes('пропущ')
      ? 'пропущен'
      : normalizedStatus?.includes('no_answer') || normalizedStatus?.includes('без ответа')
        ? 'без ответа'
        : normalizedStatus?.includes('declined') || normalizedStatus?.includes('отклон')
          ? 'отклонён'
          : normalizedStatus?.includes('busy') || normalizedStatus?.includes('занят')
            ? 'занято'
            : normalizedStatus?.includes('canceled') || normalizedStatus?.includes('cancelled') || normalizedStatus?.includes('отмен')
              ? 'отменён'
              : null

  const title = isMissed
    ? inferredDirection === 'incoming'
      ? 'Пропущенный видеозвонок'
      : 'Несостоявшийся видеозвонок'
    : inferredDirection === 'outgoing'
      ? 'Исходящий видеозвонок'
      : 'Входящий видеозвонок'

  const detailParts = [msg.time]
  if (durationSeconds !== null && durationSeconds > 0) {
    detailParts.push(formatCallDurationLabel(durationSeconds))
  } else if (statusLabel) {
    detailParts.push(statusLabel)
  }

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div
          style={{
            width: 'fit-content',
            minWidth: 220,
            maxWidth: 'min(320px, 100%)',
            background: isMe ? outgoingPalette.solid : IOS_INCOMING_BG,
            color: isMe ? outgoingPalette.text : C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: '14px 16px 12px',
            boxShadow: isMe ? `0 8px 20px ${withAlpha(outgoingPalette.solid, 0.2)}` : '0 2px 8px rgba(10,22,40,0.06)',
            border: `1px solid ${isMe ? withAlpha(outgoingPalette.solid, 0.18) : IOS_INCOMING_BORDER}`,
            fontFamily: CHAT_FONT_STACK,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.22,
                  letterSpacing: '-0.01em',
                  color: isMe ? outgoingPalette.text : C.ink,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: isMe ? outgoingPalette.textMuted : '#6D7F99',
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <MS
                  name="arrow_upward"
                  size={14}
                  color={isMe ? outgoingPalette.textMuted : '#7B8EA8'}
                  style={{ transform: inferredDirection === 'outgoing' ? 'rotate(45deg)' : 'rotate(-135deg)' }}
                />
                <span>{detailParts.join(', ')}</span>
              </div>
            </div>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isMe ? outgoingPalette.badgeBg : 'rgba(123,142,168,0.12)',
                flexShrink: 0,
              }}
            >
              <MS name="videocam" size={18} color={isMe ? outgoingPalette.text : '#6D7F99'} />
            </div>
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function VoiceMessagePlayer({ msg, showSenderLabel, theme, onReact, onUnreact }: { msg: MessageView; showSenderLabel: boolean; theme?: MessageBubbleTheme; onReact?: (messageId: string, emoji: string) => void; onUnreact?: (messageId: string, emoji: string) => void }) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [waveform, setWaveform] = useState([6, 10, 14, 18, 13, 9, 16, 22, 12, 8, 14, 20, 26, 15, 9, 18, 24, 13, 10, 16, 21, 12, 7, 15, 19, 11, 8, 14])
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    stopAnimation()

    const tick = () => {
      setCurrentTime(audio.currentTime)

      if (!audio.paused && !audio.ended) {
        animationFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick)
  }, [stopAnimation])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }

    const handleEnded = () => {
      stopAnimation()
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handlePause = () => {
      stopAnimation()
      setIsPlaying(false)
      setCurrentTime(audio.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      startAnimation()
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      stopAnimation()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [startAnimation, stopAnimation])

  useEffect(() => {
    if (!msg.audioUrl) {
      return
    }

    const audioUrl = msg.audioUrl
    if (!audioUrl) return

    let cancelled = false
    let currentBlobUrl: string | null = null

    const buildWaveform = async () => {
      try {
        const response = await authorizedFetch(authSessionStore, audioUrl)
        const blob = await response.blob()
        
        if (cancelled) return

        currentBlobUrl = URL.createObjectURL(blob)
        setBlobUrl(currentBlobUrl)

        const arrayBuffer = await blob.arrayBuffer()
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

        if (!AudioContextCtor) {
          return
        }

        const audioContext = new AudioContextCtor()
        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
          const channelData = audioBuffer.getChannelData(0)
          const barsCount = 28
          const blockSize = Math.max(1, Math.floor(channelData.length / barsCount))
          const nextWaveform = Array.from({ length: barsCount }, (_, index) => {
            const start = index * blockSize
            const end = Math.min(channelData.length, start + blockSize)
            let peak = 0

            for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
              const amplitude = Math.abs(channelData[sampleIndex])
              if (amplitude > peak) {
                peak = amplitude
              }
            }

            return Math.max(6, Math.round(peak * 24))
          })

          if (!cancelled) {
            setWaveform(nextWaveform)
          }
        } finally {
          void audioContext.close().catch(() => undefined)
        }
      } catch (error) {
        console.error('[VoiceMessagePlayer] Failed to load authenticated audio:', error)
      }
    }

    void buildWaveform()

    return () => {
      cancelled = true
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [msg.audioUrl])

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.paused) {
      void audio.play()
      return
    }

    audio.pause()
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div
          style={{
            background: isMe ? mixHex(outgoingPalette.solid, '#FFFFFF', 0.82) : IOS_INCOMING_BG,
            color: C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: '10px 12px 8px',
            boxShadow: isMe ? `0 3px 14px ${withAlpha(outgoingPalette.solid, 0.16)}` : '0 1px 4px rgba(10,22,40,0.07)',
            border: `1px solid ${isMe ? withAlpha(outgoingPalette.solid, 0.18) : IOS_INCOMING_BORDER}`,
            opacity: msg.unavailable ? 0.78 : 1,
            maxWidth: '100%',
            minWidth: 250,
            fontFamily: CHAT_FONT_STACK,
          }}
        >
          {blobUrl ? <audio ref={audioRef} preload="metadata" src={blobUrl} /> : <audio ref={audioRef} preload="metadata" />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={togglePlayback}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                border: 'none',
                background: isMe ? '#FFFFFF' : `${C.blue}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(10,22,40,0.08)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <MS name={isPlaying ? 'pause' : 'play_arrow'} size={20} color={isMe ? outgoingPalette.solid : C.blue} style={{ marginLeft: isPlaying ? 0 : 2 }} />
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${waveform.length}, 1fr)`,
                  alignItems: 'center',
                  gap: 3,
                  height: 28,
                }}
              >
                {waveform.map((height, index) => {
                  const threshold = (index + 1) / waveform.length
                  const active = progress >= threshold

                  return (
                    <div
                      key={`${msg.raw.id}-bar-${index}`}
                      style={{
                        height: active ? height + 2 : height,
                        borderRadius: 999,
                        background: active ? (isMe ? outgoingPalette.solid : C.blue) : isMe ? mixHex(outgoingPalette.solid, '#FFFFFF', 0.52) : '#C9D7EA',
                        opacity: active ? 1 : 0.72,
                        transition: 'background 0.12s ease, height 0.12s ease, opacity 0.12s ease',
                      }}
                    />
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: isMe ? outgoingPalette.solid : C.blue, letterSpacing: '-0.004em' }}>
                  {formatRecordingDuration(Math.floor(currentTime))}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.inkMuted }}>
                  <span style={{ fontSize: 11, fontWeight: 400 }}>{duration > 0 ? formatRecordingDuration(Math.floor(duration)) : '--:--'}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
                  {isMe ? <MS name={msg.status === 'read' ? 'done_all' : 'done'} size={13} color={outgoingPalette.solid} /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function VideoMessagePlayer({ msg, showSenderLabel, theme, onReact, onUnreact }: { msg: MessageView; showSenderLabel: boolean; theme?: MessageBubbleTheme; onReact?: (messageId: string, emoji: string) => void; onUnreact?: (messageId: string, emoji: string) => void }) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const ringSize = 236
  const ringStroke = 4
  const ringRadius = ringSize / 2 - ringStroke / 2
  const ringCircumference = 2 * Math.PI * ringRadius
  const playbackProgress = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const ringOffset = ringCircumference * (1 - playbackProgress)

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    stopAnimation()

    const tick = () => {
      setCurrentTime(video.currentTime)

      if (!video.paused && !video.ended) {
        animationFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick)
  }, [stopAnimation])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      startAnimation()
    }
    const handlePause = () => {
      stopAnimation()
      setIsPlaying(false)
      setCurrentTime(video.currentTime)
    }
    const handleEnded = () => {
      stopAnimation()
      setIsPlaying(false)
      setCurrentTime(video.duration || 0)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    let cancelled = false
    let currentBlobUrl: string | null = null

    const videoSource = msg.videoUrl
    const loadVideo = async () => {
      if (!videoSource) return
      try {
        const response = await authorizedFetch(authSessionStore, videoSource)
        const blob = await response.blob()
        
        if (cancelled) return

        currentBlobUrl = URL.createObjectURL(blob)
        setBlobUrl(currentBlobUrl)
      } catch (error) {
        console.error('[VideoMessagePlayer] Failed to load authenticated video:', error)
      }
    }

    void loadVideo()

    return () => {
      cancelled = true
      stopAnimation()
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [startAnimation, stopAnimation, msg.videoUrl])

  const togglePlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (video.paused) {
      void video.play()
      return
    }

    video.pause()
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 10, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 6 }}>
          <button
            type="button"
            onClick={togglePlayback}
            style={{
              position: 'relative',
              width: 236,
              height: 236,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `3px solid ${isMe ? mixHex(outgoingPalette.solid, '#FFFFFF', 0.58) : '#E5EDF9'}`,
              background: isMe ? mixHex(outgoingPalette.solid, '#FFFFFF', 0.68) : '#F4F7FC',
              boxShadow: isMe ? `0 10px 22px ${withAlpha(outgoingPalette.solid, 0.18)}` : '0 8px 22px rgba(10,22,40,0.1)',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <video
              ref={videoRef}
              src={blobUrl || undefined}
              preload="metadata"
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                background: '#C8D7EE',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isPlaying
                  ? 'linear-gradient(180deg, rgba(10,22,40,0.02) 0%, rgba(10,22,40,0.06) 52%, rgba(10,22,40,0.14) 100%)'
                  : 'linear-gradient(180deg, rgba(10,22,40,0.01) 0%, rgba(10,22,40,0.04) 52%, rgba(10,22,40,0.1) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: isPlaying ? 'rgba(10,22,40,0.24)' : 'rgba(255,255,255,0.86)',
                  color: isPlaying ? '#FFFFFF' : (isMe ? outgoingPalette.solid : C.blue),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isPlaying ? '0 10px 24px rgba(10,22,40,0.18)' : '0 10px 24px rgba(10,22,40,0.12)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <MS name={isPlaying ? 'pause' : 'play_arrow'} size={28} color={isPlaying ? '#FFFFFF' : (isMe ? outgoingPalette.solid : C.blue)} style={{ marginLeft: isPlaying ? 0 : 3 }} />
              </div>
            </div>
            <svg
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transform: 'rotate(-90deg)',
                pointerEvents: 'none',
              }}
            >
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={isMe ? withAlpha(outgoingPalette.solid, 0.24) : 'rgba(229,237,249,0.92)'}
                strokeWidth={ringStroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={isMe ? outgoingPalette.solid : '#1F7BFF'}
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                style={{
                  transition: isPlaying ? 'none' : 'stroke-dashoffset 0.22s ease, opacity 0.18s ease',
                  opacity: playbackProgress > 0 ? 1 : 0.45,
                }}
              />
            </svg>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: C.inkFaint,
              justifyContent: isMe ? 'flex-end' : 'flex-start',
              width: '100%',
              padding: isMe ? '0 6px 0 0' : '0 0 0 6px',
              fontFamily: CHAT_FONT_STACK,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
            {isMe && <MS name={msg.status === 'read' ? 'done_all' : 'done'} size={13} color={C.blue} />}
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function VideoAttachmentBubble({
  msg,
  showSenderLabel,
  onOpenVideo,
  theme,
  onReact,
  onUnreact,
}: {
  msg: MessageView
  showSenderLabel: boolean
  onOpenVideo?: (message: MessageView) => void
  theme?: MessageBubbleTheme
  onReact?: (messageId: string, emoji: string) => void
  onUnreact?: (messageId: string, emoji: string) => void
}) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div
          style={{
            position: 'relative',
            background: isMe ? outgoingPalette.solid : IOS_INCOMING_BG,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: 8,
            boxShadow: isMe ? `0 8px 24px ${withAlpha(outgoingPalette.solid, 0.16)}` : '0 8px 24px rgba(10,22,40,0.08)',
            border: isMe ? `1px solid ${withAlpha(outgoingPalette.solid, 0.14)}` : `1px solid ${IOS_INCOMING_BORDER}`,
            opacity: msg.unavailable ? 0.78 : 1,
            fontFamily: CHAT_FONT_STACK,
          }}
        >
          <video
            controls
            preload="metadata"
            playsInline
            src={msg.videoUrl || undefined}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 360,
              maxHeight: 420,
              borderRadius: 16,
              background: '#DCE6F8',
            }}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenVideo?.(msg)
            }}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 34,
              height: 34,
              borderRadius: 17,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(15,23,42,0.54)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(10,22,40,0.18)',
            }}
            title="Открыть видео"
            aria-label="Открыть видео"
          >
            <MS name="zoom_in" size={18} color="currentColor" />
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              marginTop: 8,
              color: isMe ? outgoingPalette.textMuted : C.inkFaint,
              padding: '0 4px 2px',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
            {isMe ? (
              <MS
                name={msg.status === 'read' ? 'done_all' : 'done'}
                size={13}
                color={msg.status === 'read' ? outgoingPalette.text : outgoingPalette.textMuted}
              />
            ) : null}
          </div>
          {msg.text && !isFallbackCaption(msg.text, msg.kind) && (
            <div
              style={{
                padding: '10px 6px 2px',
                fontSize: 15,
                lineHeight: 1.38,
                fontWeight: 400,
                color: isMe ? outgoingPalette.text : C.ink,
                textAlign: 'left',
                letterSpacing: '-0.008em',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {renderTaggedText(msg.text, msg.raw.id, isMe, outgoingPalette)}
            </div>
          )}
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function FileAttachmentBubble({ msg, showSenderLabel, theme, onReact, onUnreact }: { msg: MessageView; showSenderLabel: boolean; theme?: MessageBubbleTheme; onReact?: (messageId: string, emoji: string) => void; onUnreact?: (messageId: string, emoji: string) => void }) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const attachment = msg.attachment
  const [isOpeningAttachment, setIsOpeningAttachment] = useState(false)

  const handleOpenAttachment = useCallback(async () => {
    if (!attachment?.url || isOpeningAttachment) {
      return
    }

    setIsOpeningAttachment(true)
    try {
      await openAuthenticatedAttachment(attachment.url, attachment.filename)
    } catch (error) {
      console.error('[FileAttachmentBubble] Failed to open authenticated attachment:', error)
    } finally {
      setIsOpeningAttachment(false)
    }
  }, [attachment?.filename, attachment?.url, isOpeningAttachment])

  if (!attachment) {
    return null
  }

  const metaParts = [attachment.ext ? attachment.ext.replace('.', '').toUpperCase() : null, formatAttachmentSize(attachment.size)].filter(Boolean)
  const captionText = msg.text?.trim() === attachment.url ? '' : msg.text

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div
          role="button"
          tabIndex={0}
          onClick={() => void handleOpenAttachment()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              void handleOpenAttachment()
            }
          }}
          aria-label={`Открыть файл ${attachment.filename}`}
          style={{
            display: 'block',
            minWidth: 260,
            maxWidth: 360,
            background: isMe ? outgoingPalette.solid : IOS_INCOMING_BG,
            color: isMe ? outgoingPalette.text : C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: 14,
            boxShadow: isMe ? `0 12px 30px ${outgoingPalette.shadow}` : '0 8px 22px rgba(10,22,40,0.08)',
            border: `1px solid ${isMe ? outgoingPalette.border : IOS_INCOMING_BORDER}`,
            opacity: msg.unavailable ? 0.78 : 1,
            fontFamily: CHAT_FONT_STACK,
            textDecoration: 'none',
            cursor: attachment.url && !isOpeningAttachment ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: isMe ? outgoingPalette.badgeBg : '#EEF5FF',
                color: isMe ? outgoingPalette.text : C.blue,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MS name={resolveAttachmentIconName(attachment.icon)} size={22} color={isMe ? outgoingPalette.text : C.blue} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                title={attachment.filename}
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 1.28,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {attachment.filename}
              </div>
              {metaParts.length > 0 ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    lineHeight: 1.2,
                    color: isMe ? outgoingPalette.textMuted : C.inkFaint,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {metaParts.join(' • ')}
                </div>
              ) : null}
              {isOpeningAttachment ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    lineHeight: 1.2,
                    color: isMe ? outgoingPalette.textMuted : C.inkFaint,
                  }}
                >
                  Открывается...
                </div>
              ) : null}
            </div>
          </div>
          {captionText && !isFallbackCaption(captionText, msg.kind) && (
            <div
              style={{
                marginTop: 12,
                padding: '0 2px',
                fontSize: 15,
                lineHeight: 1.38,
                fontWeight: 400,
                color: isMe ? outgoingPalette.text : C.ink,
                textAlign: 'left',
                letterSpacing: '-0.008em',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {renderTaggedText(captionText, msg.raw.id, isMe, outgoingPalette)}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              marginTop: 10,
              color: isMe ? outgoingPalette.textMuted : C.inkFaint,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
            {isMe ? (
              <MS
                name={msg.status === 'read' ? 'done_all' : 'done'}
                size={13}
                color={isMe ? (msg.status === 'read' ? outgoingPalette.text : outgoingPalette.textMuted) : C.blue}
              />
            ) : null}
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

type DriveFileBubbleMetadata = {
  type: string
  fileName?: string
  fileSize?: number
  fileId: string
  fileMime?: string
  fileDownloadUrl?: string
}

function DriveFileBubble({ msg, onOpenDriveFile, theme, onReact, onUnreact }: { msg: MessageView; onOpenDriveFile?: (file: DriveFileBubbleMetadata) => void; theme?: MessageBubbleTheme; onReact?: (messageId: string, emoji: string) => void; onUnreact?: (messageId: string, emoji: string) => void }) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const metadata = parseJsonRecord(msg.raw.metadata) as DriveFileBubbleMetadata | null

  if (!metadata || metadata.type !== 'drive_file') return null

  const fileName = metadata.fileName || 'Документ'
  const fileSize = metadata.fileSize ? formatAttachmentSize(metadata.fileSize) : null

  const extension = getFileExtension(fileName)
  const iconType = iconByExtension(extension)
  const iconName = resolveAttachmentIconName(iconType)

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        <div
          role="button"
          onClick={() => onOpenDriveFile?.(metadata)}
          style={{
            display: 'block',
            minWidth: 260,
            maxWidth: 360,
            background: isMe ? `linear-gradient(135deg, ${outgoingPalette.solid} 0%, ${mixHex(outgoingPalette.solid, '#000000', 0.1)} 100%)` : '#FFFFFF',
            color: isMe ? '#FFFFFF' : C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: '16px',
            boxShadow: '0 12px 30px rgba(10,22,40,0.08)',
            border: isMe ? 'none' : `1px solid ${C.borderLight}`,
            cursor: 'pointer',
            fontFamily: CHAT_FONT_STACK,
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: isMe ? 'rgba(255,255,255,0.18)' : '#F0F7FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MS name={iconName} size={28} color={isMe ? '#FFFFFF' : C.blue} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, marginBottom: 2 }}>Alem Drive</div>
              <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
              {fileSize && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{fileSize}</div>}
            </div>
          </div>
          
          <div style={{ 
            marginTop: 16, 
            padding: '8px 12px', 
            background: isMe ? 'rgba(255,255,255,0.12)' : '#F8FAFC', 
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
            <MS name="open_in_new" size={16} />
            Открыть в приложении
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontSize: 11, opacity: 0.6 }}>
            {msg.time}
            {isMe && <MS name={msg.status === 'read' ? 'done_all' : 'done'} size={12} style={{ marginLeft: 4 }} />}
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function NoteBubble({ msg, onOpenNote, theme, onReact, onUnreact }: { msg: MessageView; onOpenNote?: (noteId: string) => void; theme?: MessageBubbleTheme; onReact?: (messageId: string, emoji: string) => void; onUnreact?: (messageId: string, emoji: string) => void }) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const metadata = parseJsonRecord(msg.raw.metadata) as { type: string; note_title?: string; note_summary?: string; note_url?: string; note_id?: string; noteId?: string } | null
  
  if (!metadata || metadata.type !== 'note') return null

  const noteTitle = metadata.note_title || 'Заметка'
  const noteSummary = metadata.note_summary || ''
  const noteUrl = metadata.note_url || '#'

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>}
        <div
          role="button"
          onClick={() => {
            const noteId = metadata.note_id || metadata.noteId;
            if (noteId && onOpenNote) {
              onOpenNote(noteId);
            } else {
              window.open(noteUrl, '_blank');
            }
          }}
          style={{
            display: 'block',
            minWidth: 260,
            maxWidth: 360,
            background: isMe ? `linear-gradient(135deg, ${outgoingPalette.solid} 0%, ${mixHex(outgoingPalette.solid, '#000000', 0.1)} 100%)` : '#FFFFFF',
            color: isMe ? '#FFFFFF' : C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: '16px',
            boxShadow: '0 12px 30px rgba(10,22,40,0.08)',
            border: isMe ? 'none' : `1px solid ${C.borderLight}`,
            cursor: 'pointer',
            fontFamily: CHAT_FONT_STACK,
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: isMe ? 'rgba(255,255,255,0.18)' : '#FFF9DB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MS name="description" size={28} color={isMe ? '#FFFFFF' : '#F59E0B'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, marginBottom: 2 }}>Alem Notes</div>
              <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noteTitle}</div>
              {noteSummary && (
                <div style={{ 
                  fontSize: 12, 
                  opacity: 0.7, 
                  marginTop: 4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {noteSummary}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ 
            marginTop: 16, 
            padding: '8px 12px', 
            background: isMe ? 'rgba(255,255,255,0.12)' : '#FFFBEB', 
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
            <MS name="open_in_new" size={16} />
            Открыть заметку
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontSize: 11, opacity: 0.6 }}>
            {msg.time}
            {isMe && <MS name={msg.status === 'read' ? 'done_all' : 'done'} size={12} style={{ marginLeft: 4 }} />}
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function TaskBubble({
  msg,
  theme,
  onReact,
  onUnreact,
}: {
  msg: MessageView
  theme?: MessageBubbleTheme
  onReact?: (messageId: string, emoji: string) => void
  onUnreact?: (messageId: string, emoji: string) => void
}) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const metadata = parseJsonRecord(msg.raw.metadata) as {
    kind?: string
    task_id?: string
    taskId?: string
    title?: string
    board_id?: string
  } | null

  if (!metadata) return null

  const taskId = metadata.task_id || metadata.taskId || ''
  const taskTitle = metadata.title || 'Задача'
  const taskUrl = `/kanban?task=${encodeURIComponent(taskId)}`

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>
            {msg.senderLabel}
          </div>
        )}
        <Link
          to={taskUrl}
          style={{
            display: 'block',
            minWidth: 260,
            maxWidth: 360,
            background: isMe
              ? `linear-gradient(135deg, ${outgoingPalette.solid} 0%, ${mixHex(outgoingPalette.solid, '#000000', 0.1)} 100%)`
              : '#FFFFFF',
            color: isMe ? '#FFFFFF' : C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: '16px',
            boxShadow: '0 12px 30px rgba(10,22,40,0.08)',
            border: isMe ? 'none' : `1px solid ${C.borderLight}`,
            cursor: 'pointer',
            fontFamily: CHAT_FONT_STACK,
            textDecoration: 'none',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: isMe ? 'rgba(255,255,255,0.18)' : '#E8F0FE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MS name="assignment" size={28} color={isMe ? '#FFFFFF' : '#1A73E8'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, marginBottom: 2 }}>Alem Kanban</div>
              <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {taskTitle}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: '8px 12px',
              background: isMe ? 'rgba(255,255,255,0.12)' : '#F1F3F4',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: isMe ? '#FFFFFF' : '#3C4043',
            }}
          >
            <MS name="open_in_new" size={16} />
            Открыть задачу
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontSize: 11, opacity: 0.6, color: isMe ? '#FFFFFF' : C.inkFaint }}>
            {msg.time}
            {isMe && <MS name={msg.status === 'read' ? 'done_all' : 'done'} size={12} style={{ marginLeft: 4 }} />}
          </div>
        </Link>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

function EventBubble({
  msg,
  theme,
  onReact,
  onUnreact,
}: {
  msg: MessageView
  theme?: MessageBubbleTheme
  onReact?: (messageId: string, emoji: string) => void
  onUnreact?: (messageId: string, emoji: string) => void
}) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const metadata = parseJsonRecord(msg.raw.metadata) as {
    kind?: string
    event_id?: string
    eventId?: string
    title?: string
    start_time?: string
    end_time?: string
    location?: string
  } | null

  if (!metadata) return null

  const eventId = metadata.event_id || metadata.eventId || ''
  const eventTitle = metadata.title || 'Событие'
  const eventUrl = `/calendar?event=${encodeURIComponent(eventId)}`

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>
            {msg.senderLabel}
          </div>
        )}
        <Link
          to={eventUrl}
          style={{
            display: 'block',
            minWidth: 260,
            maxWidth: 360,
            background: isMe
              ? `linear-gradient(135deg, ${outgoingPalette.solid} 0%, ${mixHex(outgoingPalette.solid, '#000000', 0.1)} 100%)`
              : '#FFFFFF',
            color: isMe ? '#FFFFFF' : C.ink,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: '16px',
            boxShadow: '0 12px 30px rgba(10,22,40,0.08)',
            border: isMe ? 'none' : `1px solid ${C.borderLight}`,
            cursor: 'pointer',
            fontFamily: CHAT_FONT_STACK,
            textDecoration: 'none',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: isMe ? 'rgba(255,255,255,0.18)' : '#FFF0F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MS name="calendar_month" size={28} color={isMe ? '#FFFFFF' : '#FF4B4B'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, marginBottom: 2 }}>Alem Calendar</div>
              <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {eventTitle}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: '8px 12px',
              background: isMe ? 'rgba(255,255,255,0.12)' : '#FFF5F5',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: isMe ? '#FFFFFF' : '#FF4B4B',
            }}
          >
            <MS name="open_in_new" size={16} />
            Открыть календарь
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontSize: 11, opacity: 0.6, color: isMe ? '#FFFFFF' : C.inkFaint }}>
            {msg.time}
            {isMe && <MS name={msg.status === 'read' ? 'done_all' : 'done'} size={12} style={{ marginLeft: 4 }} />}
          </div>
        </Link>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}

interface AlbumFile {
  url: string
  type: string
  size: number
  name: string
}

function AlbumBubble({
  msg,
  showSenderLabel,
  onOpenImage,
  theme,
  onReact,
  onUnreact,
}: {
  msg: MessageView
  showSenderLabel: boolean
  onOpenImage?: (message: MessageView) => void
  theme?: MessageBubbleTheme
  onReact?: (messageId: string, emoji: string) => void
  onUnreact?: (messageId: string, emoji: string) => void
}) {
  const isMe = msg.from === 'me'
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const metadata = parseJsonRecord(msg.raw.metadata) as { gallery?: AlbumFile[] } | null
  const files = metadata?.gallery || []

  if (files.length === 0) return null

  const handleOpenPhoto = (file: AlbumFile, index: number) => {
    const pseudoMessage: MessageView = {
      ...msg,
      raw: {
        ...msg.raw,
        id: `${msg.raw.id}_album_${index}`,
      },
      mediaUrl: file.url,
    }
    onOpenImage?.(pseudoMessage)
  }

  const count = files.length
  let gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: 4,
    borderRadius: 14,
    overflow: 'hidden',
    maxWidth: 320,
    width: '100%',
  }

  if (count === 2) {
    gridStyle.gridTemplateColumns = '1fr 1fr'
  } else if (count === 3) {
    gridStyle.gridTemplateColumns = '2fr 1fr'
    gridStyle.gridTemplateRows = '1fr 1fr'
  } else if (count >= 4) {
    gridStyle.gridTemplateColumns = '1fr 1fr'
    gridStyle.gridTemplateRows = '1fr 1fr'
  }

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
      <div style={{ maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div
          style={{
            position: 'relative',
            background: isMe ? outgoingPalette.solid : IOS_INCOMING_BG,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: 4,
            boxShadow: isMe ? `0 12px 32px ${withAlpha(outgoingPalette.solid, 0.22)}` : '0 10px 28px rgba(10,22,40,0.12)',
            border: isMe ? `1px solid ${withAlpha(outgoingPalette.solid, 0.16)}` : `1px solid ${IOS_INCOMING_BORDER}`,
            opacity: msg.unavailable ? 0.78 : 1,
            maxWidth: 330,
            width: '100%',
            fontFamily: CHAT_FONT_STACK,
          }}
        >
          <div style={gridStyle}>
            {files.slice(0, 4).map((file, idx) => {
              let itemStyle: React.CSSProperties = {
                position: 'relative',
                cursor: 'zoom-in',
                height: count === 1 ? 220 : count === 2 ? 150 : idx === 0 && count === 3 ? 154 : 75,
                background: '#DCE6F8',
              }

              if (idx === 0 && count === 3) {
                itemStyle.gridRow = 'span 2'
              }

              const isMoreThanFour = count > 4 && idx === 3

              return (
                <div
                  key={idx}
                  style={itemStyle}
                  onClick={() => handleOpenPhoto(file, idx)}
                >
                  <img
                    src={file.url}
                    alt={file.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {isMoreThanFour ? (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(15, 23, 42, 0.65)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontSize: 18,
                      fontWeight: 700,
                      backdropFilter: 'blur(4px)',
                    }}>
                      +{count - 3}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {msg.text && !isFallbackCaption(msg.text, msg.kind) && (
            <div
              style={{
                padding: '10px 10px 2px',
                fontSize: 15,
                lineHeight: 1.38,
                fontWeight: 400,
                color: isMe ? outgoingPalette.text : C.ink,
                textAlign: 'left',
                letterSpacing: '-0.008em',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {renderTaggedText(msg.text, msg.raw.id, isMe, outgoingPalette)}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              padding: '4px 6px 4px',
              color: isMe ? outgoingPalette.textMuted : C.inkFaint,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
            {isMe ? (
              <MS
                name={msg.status === 'read' ? 'done_all' : 'done'}
                size={13}
                color={msg.status === 'read' ? outgoingPalette.text : outgoingPalette.textMuted}
              />
            ) : null}
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
      </div>
    </div>
  )
}


interface MessageBubbleProps {
  msg: MessageView
  showSenderLabel: boolean
  onOpenImage?: (message: MessageView) => void
  onOpenVideo?: (message: MessageView) => void
  theme?: MessageBubbleTheme
  isSmartAgentSending?: boolean
  onReact?: (messageId: string, emoji: string) => void
  onUnreact?: (messageId: string, emoji: string) => void
  onReply?: () => void
  onConfirm?: () => void
  onCancel?: () => void
  onSelect?: (selectionValue: string, displayText: string) => void
  onOpenDriveFile?: (file: DriveFileBubbleMetadata) => void
  onOpenNote?: (noteId: string) => void
}

export default function MessageBubble({ msg, showSenderLabel, onOpenImage, onOpenVideo, theme, isSmartAgentSending = false, onReact, onUnreact, onReply, onConfirm, onCancel, onSelect, onOpenDriveFile, onOpenNote }: MessageBubbleProps) {
  if (msg.kind === 'service') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '10px 0',
          width: '100%',
          fontFamily: CHAT_FONT_STACK,
        }}
      >
        <div
          style={{
            background: 'rgba(10,22,40,0.06)',
            color: C.inkMuted,
            padding: '6px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.4,
            textAlign: 'center',
            maxWidth: '85%',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(10,22,40,0.04)',
          }}
        >
          {msg.text}
        </div>
      </div>
    )
  }

  const isMe = msg.from === 'me'
  const [isHovered, setIsHovered] = useState(false)
  const outgoingPalette = buildOutgoingPalette(theme?.outgoingColorHex)
  const emojiOnlyMessage = isEmojiOnlyText(msg.text)
  const unavailableLabel = 'Защищенное сообщение'
  const forcedVoiceUrl = hasVoiceMarker(msg.audioUrl, msg.videoUrl, msg.raw.attachmentUrl, msg.raw.content)
    ? msg.audioUrl ?? msg.videoUrl ?? msg.raw.attachmentUrl ?? undefined
    : undefined
  const unavailablePalette = msg.unavailable
    ? {
        background: '#FFF8EA',
        color: '#5F4B1D',
        border: '1px solid #F1D7A0',
        boxShadow: '0 4px 14px rgba(154, 120, 46, 0.08)',
        meta: '#907441',
      }
    : {
        background: isMe ? outgoingPalette.solid : IOS_INCOMING_BG,
        color: isMe ? outgoingPalette.text : C.ink,
        border: isMe ? `1px solid ${withAlpha(outgoingPalette.solid, 0.16)}` : `1px solid ${IOS_INCOMING_BORDER}`,
        boxShadow: isMe ? `0 6px 16px ${withAlpha(outgoingPalette.solid, 0.18)}` : '0 2px 8px rgba(10,22,40,0.06)',
        meta: isMe ? outgoingPalette.textMuted : C.inkFaint,
      }

  const metadata = parseJsonRecord(msg.raw.metadata)
  if (metadata && Array.isArray(metadata.gallery) && metadata.gallery.length > 0) {
    return <AlbumBubble msg={msg} showSenderLabel={showSenderLabel} onOpenImage={onOpenImage} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (metadata?.type === 'drive_file') {
    return <DriveFileBubble msg={msg} onOpenDriveFile={onOpenDriveFile} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }
  
  if (metadata?.type === 'note') {
    return <NoteBubble msg={msg} onOpenNote={onOpenNote} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (metadata?.kind === 'task' || metadata?.type === 'task') {
    return <TaskBubble msg={msg} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (metadata?.kind === 'event' || metadata?.type === 'event') {
    return <EventBubble msg={msg} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }


  if (forcedVoiceUrl) {
    return <VoiceMessagePlayer msg={{ ...msg, kind: 'voice', audioUrl: forcedVoiceUrl, videoUrl: undefined, isCall: false }} showSenderLabel={showSenderLabel} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (msg.kind === 'video_message' && msg.videoUrl) {
    return <VideoMessagePlayer msg={msg} showSenderLabel={showSenderLabel} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (msg.kind === 'video' && msg.videoUrl) {
    return <VideoAttachmentBubble msg={msg} showSenderLabel={showSenderLabel} onOpenVideo={onOpenVideo} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (msg.isCall) {
    return <CallSummaryBubble msg={msg} showSenderLabel={showSenderLabel} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (msg.kind === 'image' && msg.mediaUrl) {
    return (
      <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
        <div style={{ maxWidth: '68%' }}>
          {!isMe && showSenderLabel ? (
            <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenImage?.(msg)
            }}
            style={{
              position: 'relative',
              display: 'block',
              border: isMe ? `1px solid ${withAlpha(outgoingPalette.solid, 0.16)}` : `1px solid ${IOS_INCOMING_BORDER}`,
              background: isMe ? outgoingPalette.solid : IOS_INCOMING_BG,
              borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
              padding: 0,
              boxShadow: isMe ? `0 12px 32px ${withAlpha(outgoingPalette.solid, 0.22)}` : '0 10px 28px rgba(10,22,40,0.12)',
              opacity: msg.unavailable ? 0.78 : 1,
              maxWidth: '100%',
              fontFamily: CHAT_FONT_STACK,
              cursor: 'zoom-in',
              overflow: 'hidden',
            }}
          >
            <img
              src={msg.mediaUrl}
              alt="attachment"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: 420,
                objectFit: 'cover',
                background: '#DCE6F8',
              }}
            />
            {msg.text && !isFallbackCaption(msg.text, msg.kind) && (
              <div
                style={{
                  padding: '10px 14px 2px',
                  fontSize: 15,
                  lineHeight: 1.38,
                  fontWeight: 400,
                  color: isMe ? outgoingPalette.text : C.ink,
                  textAlign: 'left',
                  letterSpacing: '-0.008em',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {renderTaggedText(msg.text, msg.raw.id, isMe, outgoingPalette)}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
                padding: '4px 10px 8px',
                color: isMe ? outgoingPalette.textMuted : C.inkFaint,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
              {isMe ? (
                <MS
                  name={msg.status === 'read' ? 'done_all' : 'done'}
                  size={13}
                  color={msg.status === 'read' ? outgoingPalette.text : outgoingPalette.textMuted}
                />
              ) : null}
            </div>
          </button>
          <MessageReactions
            reactions={msg.raw.reactions ?? []}
            isMe={isMe}
            onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
            onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
            outgoingPalette={outgoingPalette}
          />
        </div>
      </div>
    )
  }

  if ((msg.kind === 'voice' || msg.kind === 'audio') && msg.audioUrl) {
    return <VoiceMessagePlayer msg={msg} showSenderLabel={showSenderLabel} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  if (msg.kind === 'file' && msg.attachment) {
    return <FileAttachmentBubble msg={msg} showSenderLabel={showSenderLabel} theme={theme} onReact={onReact} onUnreact={onUnreact} />
  }

  return (
    <div
      style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 6, alignItems: 'flex-end', gap: 8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ position: 'relative', maxWidth: '68%' }}>
        {!isMe && showSenderLabel ? (
          <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 4, paddingLeft: 2, letterSpacing: '-0.006em', fontFamily: CHAT_FONT_STACK }}>{msg.senderLabel}</div>
        ) : null}
        <div
          title={msg.unavailable ? msg.unavailableReason : undefined}
          style={{
            background: unavailablePalette.background,
            color: unavailablePalette.color,
            borderRadius: isMe ? IOS_BUBBLE_RADIUS_OUTGOING : IOS_BUBBLE_RADIUS_INCOMING,
            padding: emojiOnlyMessage ? '8px 12px 7px' : '9px 13px 8px',
            fontSize: emojiOnlyMessage ? 16 : 15,
            lineHeight: emojiOnlyMessage ? 1.22 : 1.38,
            fontWeight: 400,
            letterSpacing: '-0.008em',
            boxShadow: unavailablePalette.boxShadow,
            border: unavailablePalette.border,
            opacity: 1,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
            fontFamily: CHAT_FONT_STACK,
          }}
        >
          {msg.replyTo ? <QuotedMessage replyTo={msg.replyTo} isMe={isMe} outgoingPalette={outgoingPalette} /> : null}
          {msg.unavailable ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                fontSize: 12,
                lineHeight: 1.2,
                fontWeight: 600,
                color: '#9B7A2F',
              }}
            >
              <MS name="lock" size={14} color="#9B7A2F" />
              <span>{unavailableLabel}</span>
            </div>
          ) : null}
          <div style={{ minHeight: emojiOnlyMessage ? 32 : undefined }}>
            {renderTaggedText(msg.text, msg.raw.id, isMe, outgoingPalette, emojiOnlyMessage)}
          </div>
          {msg.raw.metadata && !isMe && (
            (() => {
              const widgetData = parseJsonRecord(msg.raw.metadata) as Record<string, unknown>
              if (widgetData && widgetData.type) {
                return (
                  <SmartAgentWidgetRenderer 
                    widget={widgetData as unknown as SmartAgentWidget} 
                    isSending={isSmartAgentSending}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    onSelect={onSelect}
                  />
                )
              }
              return null
            })()
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              marginTop: emojiOnlyMessage ? 3 : 4,
              minWidth: 56,
              color: unavailablePalette.meta,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{msg.time}</span>
            {isMe ? (
              <MS
                name={msg.status === 'read' ? 'done_all' : 'done'}
                size={13}
                color={
                  msg.unavailable
                    ? '#9B7A2F'
                    : msg.status === 'read'
                      ? outgoingPalette.text
                      : outgoingPalette.textMuted
                }
              />
            ) : null}
          </div>
        </div>
        <MessageReactions
          reactions={msg.raw.reactions ?? []}
          isMe={isMe}
          onReact={(emoji) => onReact?.(msg.raw.id, emoji)}
          onUnreact={(emoji) => onUnreact?.(msg.raw.id, emoji)}
          outgoingPalette={outgoingPalette}
        />
        {isHovered && onReply ? (
          <button
            type="button"
            onClick={onReply}
            title="Ответить"
            style={{
              position: 'absolute',
              [isMe ? 'left' : 'right']: -34,
              bottom: 4,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(10,22,40,0.08)',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
              zIndex: 2,
              boxShadow: '0 2px 8px rgba(10,22,40,0.12)',
            }}
          >
            <MS name="reply" size={16} color={C.inkMuted} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
