import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import MessengerAvatar from './MessengerAvatar'
import type { ChatSearchResultItem } from './types'
import { getInitials, getSeed } from './utils'

const MARK_SPLIT_REGEX = /(<mark>.*?<\/mark>)/g
const MARK_STRIP_REGEX = /<\/?mark>/g
const HTML_TAG_REGEX = /<[^>]+>/g

const stripHtml = (value: string): string => value.replace(HTML_TAG_REGEX, '')

const getTypeBadgeConfig = (item: ChatSearchResultItem): { icon: string; label: string } | null => {
  if (!item.typeLabel) {
    return null
  }

  switch (item.view.kind) {
    case 'image':
      return { icon: 'image', label: item.typeLabel }
    case 'video':
    case 'video_message':
      return { icon: 'videocam', label: item.typeLabel }
    case 'audio':
    case 'voice':
      return { icon: 'mic', label: item.typeLabel }
    case 'file':
      return { icon: 'folder', label: item.typeLabel }
    default:
      return { icon: 'description', label: item.typeLabel }
  }
}

function SearchSnippet({ item }: { item: ChatSearchResultItem }) {
  if (!item.highlightedSnippet) {
    return <span>{item.snippetText}</span>
  }

  const parts = item.highlightedSnippet.split(MARK_SPLIT_REGEX)

  return (
    <>
      {parts.map((part, index) => {
        if (!part) {
          return null
        }

        if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
          return (
            <mark
              key={`search-mark-${index}`}
              style={{
                background: '#DCEBFF',
                color: C.blueDark,
                padding: '0 2px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              {part.replace(MARK_STRIP_REGEX, '')}
            </mark>
          )
        }

        return <span key={`search-text-${index}`}>{stripHtml(part)}</span>
      })}
    </>
  )
}

interface ChatSearchPanelProps {
  query: string
  resultCount: number
  results: ChatSearchResultItem[]
  isLoading: boolean
  error: string
  info: string
  selectedResultId: string | null
  onChangeQuery: (value: string) => void
  onClose: () => void
  onSelectResult: (messageId: string) => void
}

export default function ChatSearchPanel({
  query,
  resultCount,
  results,
  isLoading,
  error,
  info,
  selectedResultId,
  onChangeQuery,
  onClose,
  onSelectResult,
}: ChatSearchPanelProps) {
  const normalizedQuery = query.trim()
  const isReadyToSearch = normalizedQuery.length >= 2

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        bottom: 14,
        width: 'min(360px, calc(100% - 28px))',
        borderRadius: 24,
        border: `1px solid ${C.borderLight}`,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
        overflow: 'hidden',
        zIndex: 6,
        display: 'flex',
        flexDirection: 'column',
      }}
      data-no-message-select="true"
    >
      <div
        style={{
          padding: '14px 14px 12px',
          borderBottom: `1px solid ${C.borderLight}`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,255,0.92) 100%)',
          display: 'grid',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #EFF5FF 0%, #E6F0FF 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
              }}
            >
              <MS name="search" size={17} color={C.blue} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>Поиск в чате</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>
                {isReadyToSearch ? `${resultCount} результатов` : 'Введите минимум 2 символа'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              border: `1px solid ${C.borderLight}`,
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Закрыть поиск"
          >
            <MS name="close" size={16} color={C.inkMuted} />
          </button>
        </div>

        <div
          style={{
            height: 44,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 14px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <MS name="search" size={16} color={C.inkMuted} />
          <input
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder="Поиск по сообщениям"
            autoFocus
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: C.ink,
              fontSize: 14,
              fontFamily: '"Roboto", sans-serif',
            }}
          />
        </div>

        {info ? (
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${C.borderLight}`,
              background: '#F7FAFF',
              color: C.inkMuted,
              fontSize: 12,
              lineHeight: 1.45,
              padding: '10px 12px',
            }}
          >
            {info}
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'grid', gap: 10 }}>
        {error ? (
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${C.red}22`,
              background: '#FFF7F7',
              color: C.red,
              fontSize: 12,
              lineHeight: 1.5,
              padding: '12px 14px',
            }}
          >
            {error}
          </div>
        ) : null}

        {!error && !normalizedQuery ? (
          <div
            style={{
              margin: 'auto 0',
              display: 'grid',
              justifyItems: 'center',
              gap: 12,
              padding: '24px 18px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 22,
                background: 'linear-gradient(135deg, #EEF4FF 0%, #E2ECFF 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MS name="search" size={28} color={C.blue} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>Найти сообщение</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.inkMuted, maxWidth: 260 }}>
              Ищите по тексту сообщений внутри текущего чата. Результаты не смешиваются с историей переписки.
            </div>
          </div>
        ) : null}

        {!error && normalizedQuery.length > 0 && normalizedQuery.length < 2 ? (
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${C.borderLight}`,
              background: '#FFFFFF',
              color: C.inkMuted,
              fontSize: 12,
              lineHeight: 1.5,
              padding: '12px 14px',
            }}
          >
            Введите минимум 2 символа.
          </div>
        ) : null}

        {isLoading && isReadyToSearch
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`search-skeleton-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '46px minmax(0, 1fr)',
                  gap: 12,
                  alignItems: 'start',
                  padding: 12,
                  borderRadius: 18,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 23, background: '#EEF3FA' }} />
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ width: '44%', height: 12, borderRadius: 999, background: '#EEF3FA' }} />
                    <div style={{ width: 52, height: 12, borderRadius: 999, background: '#EEF3FA' }} />
                  </div>
                  <div style={{ width: '100%', height: 12, borderRadius: 999, background: '#F3F6FB' }} />
                  <div style={{ width: '68%', height: 12, borderRadius: 999, background: '#F3F6FB' }} />
                </div>
              </div>
            ))
          : null}

        {!error && !isLoading && isReadyToSearch && results.length === 0 ? (
          <div
            style={{
              margin: 'auto 0',
              display: 'grid',
              justifyItems: 'center',
              gap: 10,
              padding: '24px 18px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                background: '#F5F8FD',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MS name="search" size={24} color={C.inkMuted} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>Ничего не найдено</div>
            <div style={{ fontSize: 12, lineHeight: 1.55, color: C.inkMuted, maxWidth: 260 }}>
              Попробуйте изменить запрос. Текущий поиск работает только по тексту сообщений.
            </div>
          </div>
        ) : null}

        {!error &&
          !isLoading &&
          isReadyToSearch &&
          results.map((item) => {
            const isSelected = selectedResultId === item.raw.id
            const typeBadge = getTypeBadgeConfig(item)
            const avatarLabel = getInitials(item.senderLabel)
            const avatarUrl = item.raw.senderAvatar ?? null

            return (
              <button
                key={item.raw.id}
                type="button"
                onClick={() => onSelectResult(item.raw.id)}
                style={{
                  width: '100%',
                  border: `1px solid ${isSelected ? `${C.blue}33` : C.borderLight}`,
                  background: isSelected ? 'linear-gradient(135deg, #EEF5FF 0%, #E3EEFF 100%)' : '#FFFFFF',
                  borderRadius: 18,
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: '46px minmax(0, 1fr)',
                  gap: 12,
                  alignItems: 'start',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isSelected ? '0 16px 34px rgba(30,136,229,0.14)' : '0 4px 14px rgba(10,22,40,0.04)',
                }}
              >
                <MessengerAvatar initials={avatarLabel} imageUrl={avatarUrl} size={46} seed={getSeed(item.senderLabel)} />
                <div style={{ minWidth: 0, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.ink,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.senderLabel}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isSelected ? '#5C83B4' : C.inkMuted,
                        fontWeight: 600,
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {item.timeLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: C.inkSub,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                    }}
                  >
                    <SearchSnippet item={item} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {typeBadge ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          height: 26,
                          borderRadius: 999,
                          padding: '0 10px',
                          background: '#F3F7FD',
                          color: C.inkMuted,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <MS name={typeBadge.icon} size={13} color={C.inkMuted} />
                        {typeBadge.label}
                      </span>
                    ) : (
                      <span />
                    )}

                    {isSelected ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.blue,
                        }}
                      >
                        Выбрано
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
      </div>
    </div>
  )
}
