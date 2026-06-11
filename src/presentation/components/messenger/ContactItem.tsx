import type { MouseEvent as ReactMouseEvent } from 'react'
import { C } from '../../pages/dashboard/model/constants'
import type { ChatListItem } from './types'
import MS from '../../../shared/ui/MaterialSymbol'
import EmojiGlyph from './EmojiGlyph'
import MessengerAvatar from './MessengerAvatar'
import PinnedIcon from './PinnedIcon'

const EMOJI_TOKEN_SOURCE = String.raw`\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?)*)`
const EMOJI_SPLIT_REGEX = new RegExp(`(${EMOJI_TOKEN_SOURCE})`, 'gu')
const EMOJI_EXACT_REGEX = new RegExp(`^${EMOJI_TOKEN_SOURCE}$`, 'u')
const CHAT_META_WIDTH = 82

const isEmojiToken = (value: string): boolean => EMOJI_EXACT_REGEX.test(value)

function renderPreviewText(value: string) {
  const parts = value.split(EMOJI_SPLIT_REGEX)

  return parts.map((part, index) => {
    if (!part) {
      return null
    }

    if (isEmojiToken(part)) {
      return (
        <span
          key={`preview-emoji-${index}`}
          style={{
            display: 'inline-block',
            verticalAlign: '-0.2em',
            margin: '0 0.04em',
          }}
        >
          <EmojiGlyph emoji={part} size={18} />
        </span>
      )
    }

    return <span key={`preview-text-${index}`}>{part}</span>
  })
}

interface ContactItemProps {
  item: ChatListItem
  isActive: boolean
  typingLabel?: string
  onClick: () => void
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void
}

export default function ContactItem({ item, isActive, typingLabel, onClick, onContextMenu }: ContactItemProps) {
  const hasUnread = item.unread > 0

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: `52px minmax(0, 1fr) ${CHAT_META_WIDTH}px`,
        columnGap: 12,
        rowGap: 3,
        alignItems: 'center',
        margin: 0,
        padding: '9px 14px 10px',
        cursor: 'pointer',
        background: isActive ? '#EAF3FF' : '#FFFFFF',
        border: 'none',
        borderBottom: '1px solid #EDF1F6',
        borderRadius: 0,
        textAlign: 'left',
        position: 'relative',
        boxShadow: 'none',
        transition: 'background 0.14s ease',
        fontFamily: '"Roboto", sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {isActive ? (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            borderRadius: 999,
            background: '#4A9EFF',
            boxShadow: 'none',
          }}
        />
      ) : null}

      <div style={{ gridRow: '1 / span 2' }}>
        <MessengerAvatar initials={item.avatar} imageUrl={item.avatarUrl} size={52} seed={item.seed} online={item.online} />
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: hasUnread ? 600 : 500,
          color: C.ink,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: 0,
          lineHeight: 1.2,
        }}
      >
        {item.title}
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          width: CHAT_META_WIDTH,
          minWidth: CHAT_META_WIDTH,
          justifySelf: 'end',
          justifyContent: 'flex-end',
          whiteSpace: 'nowrap',
          alignSelf: 'start',
        }}
      >
        {item.chat.isPinned ? (
          <PinnedIcon
            size={13}
            color={isActive ? '#5C83B4' : C.inkMuted}
            style={{ opacity: isActive ? 0.96 : 0.88 }}
          />
        ) : null}
        {item.chat.isMuted ? (
          <span title="Уведомления выключены">
            <MS name="notifications_off" size={14} color="#94A3B8" />
          </span>
        ) : null}
        <div
          style={{
          fontSize: 12,
          color: hasUnread ? '#6E93BF' : '#9CAEC5',
          fontWeight: 500,
            letterSpacing: 0,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.time}
        </div>
      </div>
      <div
        style={{
          fontSize: 13,
          color: typingLabel ? '#4A9EFF' : '#94A3B8',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          fontStyle: 'normal',
          fontWeight: 400,
          lineHeight: 1.26,
          letterSpacing: 0,
        }}
      >
        {typingLabel ?? renderPreviewText(item.subtitle)}
      </div>
      {hasUnread || (item.chat.mentionCount ?? 0) > 0 ? (
        <span
          style={{
            justifySelf: 'end',
            alignSelf: 'center',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {(item.chat.mentionCount ?? 0) > 0 ? (
            <span
              title="Упоминания"
              style={{
                fontSize: 11,
                fontWeight: 800,
                lineHeight: '18px',
                background: '#EEF2FF',
                color: '#4338CA',
                borderRadius: 999,
                padding: '0 7px',
                minWidth: 20,
                textAlign: 'center',
              }}
            >
              @{item.chat.mentionCount > 99 ? '99+' : item.chat.mentionCount}
            </span>
          ) : null}
          {hasUnread ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                lineHeight: '20px',
                background: isActive ? '#2E78F6' : C.blue,
                color: '#fff',
                borderRadius: 999,
                padding: '0 8px',
                minWidth: 22,
                textAlign: 'center',
                boxShadow: 'none',
              }}
            >
              {item.unread > 99 ? '99+' : item.unread}
            </span>
          ) : null}
        </span>
      ) : (
        <span />
      )}
    </button>
  )
}
