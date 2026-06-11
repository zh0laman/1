import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  CreateUserReviewInput,
  UserDirectoryEducationItem,
  UserDirectoryLicenseCertificationItem,
  UserDirectoryReviewStats,
  UserDirectoryUserDetails,
} from '../../../infrastructure/repositories/HttpUserDirectoryRepository'
import MS from '../../../shared/ui/MaterialSymbol'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { C } from '../../pages/dashboard/model/constants'
import MessengerAvatar from './MessengerAvatar'
import { getInitials, getSeed } from './utils'
import AvatarLightbox from './AvatarLightbox'
import { MESSENGER_VIDEO_CALLS_ENABLED } from './featureFlags'

interface UserProfileModalProps {
  isOpen: boolean
  user: UserDirectoryUserDetails | null
  currentUserId: number | null
  isOnline: boolean
  isLoading: boolean
  error: string
  onRetry: () => void
  onClose: () => void
  onOpenChat: () => void
  onOpenUserProfile: (userId: number) => void
  onSubmitReview: (input: CreateUserReviewInput) => Promise<void>
  onCall?: () => void
  /** Если есть личный чат с пользователем — показать переключатель push (mute API). */
  personalChatMute?: { isMuted: boolean; busy: boolean; onToggle: () => void } | null
}

type ReviewNoticeTone = 'success' | 'error'
type ReviewDraft = Omit<CreateUserReviewInput, 'targetUserId'>
type ReviewDraftKey = keyof ReviewDraft
type ReviewStatKey =
  | 'avgDataFluency'
  | 'avgProjectManagement'
  | 'avgDigitalProficiency'
  | 'avgCrisisCommunication'
  | 'avgServiceDesignThinking'

interface ReviewCriterion {
  key: ReviewDraftKey
  statKey: ReviewStatKey
  label: string
  description: string
  icon: string
  accent: string
  tint: string
}

const REVIEW_CRITERIA: ReviewCriterion[] = [
  {
    key: 'dataFluency',
    statKey: 'avgDataFluency',
    label: 'Работа с данными',
    description: 'Насколько уверенно человек анализирует и использует данные в работе.',
    icon: 'analytics',
    accent: '#0F766E',
    tint: '#ECFDF5',
  },
  {
    key: 'projectManagement',
    statKey: 'avgProjectManagement',
    label: 'Управление проектами',
    description: 'Организация задач, сроков, приоритетов и доведение работы до результата.',
    icon: 'leaderboard',
    accent: '#2563EB',
    tint: '#EFF6FF',
  },
  {
    key: 'digitalProficiency',
    statKey: 'avgDigitalProficiency',
    label: 'Цифровая грамотность',
    description: 'Умение быстро работать с цифровыми инструментами и сервисами.',
    icon: 'videocam',
    accent: '#7C3AED',
    tint: '#F5F3FF',
  },
  {
    key: 'crisisCommunication',
    statKey: 'avgCrisisCommunication',
    label: 'Коммуникация в сложных ситуациях',
    description: 'Спокойствие, ясность и конструктивность в напряженных рабочих моментах.',
    icon: 'warning',
    accent: '#C2410C',
    tint: '#FFF7ED',
  },
  {
    key: 'serviceDesignThinking',
    statKey: 'avgServiceDesignThinking',
    label: 'Сервисное мышление',
    description: 'Ориентация на пользу для команды, клиентов и внутренних процессов.',
    icon: 'emoji_events',
    accent: '#B45309',
    tint: '#FFFBEB',
  },
]

const REVIEW_LEVEL_LABELS: Record<number, string> = {
  0: 'Не выбрано',
  1: 'Нужно усиление',
  2: 'Базовый уровень',
  3: 'Уверенно',
  4: 'Сильно',
  5: 'Отлично',
}

const noticeStyles: Record<ReviewNoticeTone, { border: string; background: string; text: string }> = {
  success: {
    background: '#ECFDF5',
    border: '#BBF7D0',
    text: '#15803D',
  },
  error: {
    background: '#FFF1F2',
    border: '#FECDD3',
    text: '#BE123C',
  },
}

const createEmptyReviewDraft = (): ReviewDraft => ({
  dataFluency: 0,
  projectManagement: 0,
  digitalProficiency: 0,
  crisisCommunication: 0,
  serviceDesignThinking: 0,
})

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatReviewPeriod = (value: string): string => {
  switch (value) {
    case 'current_month':
      return 'текущий месяц'
    case 'previous_month':
      return 'прошлый месяц'
    case 'current_quarter':
      return 'текущий квартал'
    case 'current_year':
      return 'текущий год'
    default:
      return value ? value.replace(/_/g, ' ') : 'период не указан'
  }
}


const profileMonthYearFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: 'numeric',
})

const formatProfileDateRange = (startDate: string, endDate: string | null | undefined): string => {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) {
    return ''
  }

  const startLabel = profileMonthYearFormatter.format(start)
  if (!endDate) {
    return `${startLabel} - настоящее время`
  }

  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) {
    return startLabel
  }

  return `${startLabel} - ${profileMonthYearFormatter.format(end)}`
}

const formatProfileIssueDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `Выдан ${profileMonthYearFormatter.format(date)}`
}

const isProfileAttachmentImage = (contentType: string | null | undefined): boolean =>
  typeof contentType === 'string' && contentType.startsWith('image/')

const getMetricValue = (stats: UserDirectoryReviewStats | null | undefined, statKey: ReviewStatKey): number | null => {
  if (!stats || stats.reviewCount <= 0) {
    return null
  }

  const value = stats[statKey]
  return Number.isFinite(value) ? value : null
}

const getOverallReviewScore = (stats: UserDirectoryReviewStats | null | undefined): number | null => {
  if (!stats || stats.reviewCount <= 0) {
    return null
  }

  const values = REVIEW_CRITERIA
    .map((criterion) => stats[criterion.statKey])
    .filter((value) => Number.isFinite(value))

  if (values.length === 0) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const ProfileSectionEmpty = ({ message }: { message: string }) => (
  <div
    style={{
      borderRadius: 20,
      border: `1px dashed ${C.borderLight}`,
      background: '#FFFFFF',
      padding: '16px',
      fontSize: 13,
      lineHeight: 1.6,
      color: C.inkMuted,
      textAlign: 'center',
      margin: '0 16px 16px',
    }}
  >
    {message}
  </div>
)

const TelegramInfoRow = ({
  label,
  value,
  isClickable = false,
  onClick,
  showChevron = false,
  showCopy = false,
}: {
  label: string
  value: string
  isClickable?: boolean
  onClick?: () => void
  showChevron?: boolean
  showCopy?: boolean
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const rowContent = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '12px 16px',
      }}
    >
      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, textAlign: 'left' }}>
        <span style={{ fontSize: 11, color: C.blue, fontWeight: 600, textTransform: 'lowercase' }}>{label}</span>
        <span style={{ fontSize: 14, color: C.ink, fontWeight: 500, wordBreak: 'break-word', lineHeight: 1.4 }}>{value}</span>
      </div>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            color: copied ? C.green : C.blue,
            transition: 'color 0.2s ease',
          }}
          title={copied ? 'Скопировано!' : 'Копировать'}
        >
          <MS name={copied ? 'check' : 'content_copy'} size={18} color="currentColor" />
        </button>
      )}
      {showChevron && <MS name="chevron_right" size={20} color={C.inkMuted} />}
    </div>
  )

  if (isClickable && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          background: '#FFFFFF',
          border: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'block',
          outline: 'none',
        }}
      >
        {rowContent}
      </button>
    )
  }

  return <div style={{ background: '#FFFFFF' }}>{rowContent}</div>
}

function EducationPreviewCard({ item }: { item: UserDirectoryEducationItem }) {
  const subtitle = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ')
  const period = formatProfileDateRange(item.startDate, item.endDate)

  return (
    <div
      style={{
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <MessengerAvatar
        initials={getInitials(item.schoolName)}
        imageUrl={item.schoolAvatarUrl}
        size={42}
        seed={getSeed(item.schoolName)}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyItems: 'space-between', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.schoolName}</div>
            {subtitle ? (
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
            ) : null}
          </div>
          {period ? (
            <span style={{ fontSize: 11, color: C.blue, fontWeight: 600, whiteSpace: 'nowrap' }}>{period}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LicensePreviewCard({ item }: { item: UserDirectoryLicenseCertificationItem }) {
  const issueDate = formatProfileIssueDate(item.issueDate)
  const hasPreview = Boolean(item.attachmentDownloadUrl) && isProfileAttachmentImage(item.attachmentContentType)

  return (
    <div
      style={{
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <MessengerAvatar initials={getInitials(item.name)} imageUrl={item.avatarUrl} size={42} seed={getSeed(item.name)} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyItems: 'space-between', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
            <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{item.issuingOrganization}</div>
            {issueDate ? (
              <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 3 }}>{issueDate}</div>
            ) : null}
          </div>
          {item.skillName ? (
            <span style={{ fontSize: 11, color: C.blue, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.skillName}</span>
          ) : null}
        </div>

        {item.attachmentFileName || item.attachmentDownloadUrl ? (
          <div
            style={{
              marginTop: 10,
              borderRadius: 12,
              border: `1px solid ${C.borderLight}`,
              background: '#F8FAFC',
              padding: 8,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            {hasPreview ? (
              <a
                href={item.attachmentDownloadUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                style={{
                  width: 46,
                  height: 36,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                <img
                  src={item.attachmentDownloadUrl ?? undefined}
                  alt={item.attachmentFileName ?? item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </a>
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.blue,
                  flexShrink: 0,
                }}
              >
                <MS name="description" size={18} color={C.blue} />
              </div>
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.attachmentFileName ?? 'Файл'}
              </div>
            </div>

            {item.attachmentDownloadUrl ? (
              <a
                href={item.attachmentDownloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  color: C.blue,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <MS name="open_in_new" size={12} color={C.blue} />
                Открыть
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ReviewScoreRow({
  criterion,
  value,
  disabled,
  onChange,
}: {
  criterion: ReviewCriterion
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const previewValue = (disabled ? null : hoverValue) ?? value

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${criterion.accent}22`,
        background: '#FFFFFF',
        padding: 18,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: criterion.tint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MS name={criterion.icon} size={20} color={criterion.accent} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{criterion.label}</div>
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: C.inkMuted }}>
            {criterion.description}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((score) => {
            const active = previewValue >= score

            return (
              <button
                key={score}
                type="button"
                disabled={disabled}
                onMouseEnter={() => setHoverValue(score)}
                onMouseLeave={() => setHoverValue(null)}
                onFocus={() => setHoverValue(score)}
                onBlur={() => setHoverValue(null)}
                onClick={() => onChange(score)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: `1px solid ${active ? `${criterion.accent}33` : C.borderLight}`,
                  background: active ? criterion.tint : '#F8FAFD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'transform 120ms ease, background 120ms ease, border-color 120ms ease',
                  transform: active ? 'translateY(-1px)' : 'none',
                  padding: 0,
                }}
                aria-label={`${criterion.label}: ${score}`}
                title={`${score} из 5`}
              >
                <span
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    color: active ? criterion.accent : '#C7D2E4',
                  }}
                >
                  ★
                </span>
              </button>
            )
          })}
        </div>

        <div
          style={{
            minWidth: 122,
            height: 34,
            padding: '0 12px',
            borderRadius: 999,
            background: criterion.tint,
            color: criterion.accent,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {REVIEW_LEVEL_LABELS[previewValue] ?? 'Не выбрано'}
        </div>
      </div>
    </div>
  )
}

const sheetButtonStyle: CSSProperties = {
  height: 44,
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
}

export default function UserProfileModal({
  isOpen,
  user,
  isOnline,
  isLoading,
  error,
  onRetry,
  onClose,
  onOpenChat,
  onOpenUserProfile,
  onSubmitReview,
  onCall,
}: UserProfileModalProps) {
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false)
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(() => createEmptyReviewDraft())
  const [reviewError, setReviewError] = useState('')
  const [reviewNotice, setReviewNotice] = useState<{ tone: ReviewNoticeTone; message: string } | null>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [isAvatarZoomed, setIsAvatarZoomed] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setIsReviewSheetOpen(false)
      setReviewDraft(createEmptyReviewDraft())
      setReviewError('')
      setReviewNotice(null)
      setIsSubmittingReview(false)
      setIsAvatarZoomed(false)
      return
    }

    setIsReviewSheetOpen(false)
    setReviewDraft(createEmptyReviewDraft())
    setReviewError('')
    setReviewNotice(null)
    setIsSubmittingReview(false)
    setIsAvatarZoomed(false)
  }, [isOpen, user?.id])

  const title = user?.fullName || user?.username || (user ? `User ${user.id}` : 'Профиль')
  const bossId = user?.bossId ?? null
  const isVirtualProfile = Boolean(user && user.id <= 0)
  const canReviewProfile = Boolean(user && user.id > 0 && !user.isSupport)
  const reviewSummary = user?.reviewStats
    ? `${user.reviewStats.reviewCount} отзывов за ${formatReviewPeriod(user.reviewStats.period)}`
    : 'Пока нет агрегированной статистики по отзывам'
  const overallReviewScore = useMemo(() => getOverallReviewScore(user?.reviewStats), [user?.reviewStats])
  const completedReviewCriteriaCount = useMemo(
    () => REVIEW_CRITERIA.filter((criterion) => reviewDraft[criterion.key] > 0).length,
    [reviewDraft],
  )

  if (!isOpen) {
    return null
  }

  const handleOpenReviewSheet = () => {
    if (!canReviewProfile || !user || user.hasReviewedThisMonth) {
      return
    }

    setReviewError('')
    setReviewNotice(null)
    setIsReviewSheetOpen(true)
  }

  const handleUpdateReviewScore = (key: ReviewDraftKey, value: number) => {
    setReviewError('')
    setReviewDraft((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const handleSubmitReview = async () => {
    if (!user || !canReviewProfile) {
      return
    }

    if (completedReviewCriteriaCount < REVIEW_CRITERIA.length) {
      setReviewError('Пожалуйста, оцените пользователя по всем пяти критериям.')
      return
    }

    setIsSubmittingReview(true)
    setReviewError('')

    try {
      await onSubmitReview({
        targetUserId: user.id,
        ...reviewDraft,
      })
      setReviewDraft(createEmptyReviewDraft())
      setIsReviewSheetOpen(false)
      setReviewNotice({
        tone: 'success',
        message: 'Отзыв отправлен. Статистика пользователя обновлена.',
      })
    } catch (submitError) {
      setReviewError(getErrorMessage(submitError, 'Не удалось отправить отзыв. Попробуйте еще раз.'))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 560,
          background: 'rgba(10,22,40,0.18)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        {/* Modal Window Container */}
        <div
          style={{
            width: 580,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(90vh, 840px)',
            borderRadius: 24,
            background: '#F1F3F6',
            boxShadow: '0 28px 80px rgba(10,22,40,0.16)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {/* 1. Telegram-style Header Navigation */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 100px',
              alignItems: 'center',
              padding: '14px 18px',
              background: '#F1F3F6',
              borderBottom: '1px solid #E8EDF2',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: C.blue,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                outline: 'none',
              }}
            >
              <MS name="chevron_left" size={24} color={C.blue} />
              <span>Назад</span>
            </button>
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: C.ink }}>Информация</div>
            <div />
          </div>

          {/* 2. Scrollable Body Content */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 24, display: 'grid', gap: 18 }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 12, paddingTop: 10 }}>
                  <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#DDE6F5' }} />
                  <div style={{ width: 220, height: 18, borderRadius: 999, background: '#DDE6F5' }} />
                  <div style={{ width: 160, height: 14, borderRadius: 999, background: '#E8EEF8' }} />
                  <div style={{ width: 240, height: 34, borderRadius: 999, background: '#EEF3FA' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} style={{ height: 58, borderRadius: 14, background: '#FFFFFF' }} />
                  ))}
                </div>
              </div>
            ) : error ? (
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${C.red}22`,
                    background: '#FFF6F6',
                    padding: 20,
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.red }}>
                    <MS name="error" size={18} color={C.red} />
                    <span style={{ fontSize: 15, fontWeight: 900 }}>Не удалось загрузить профиль</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#9A4545' }}>{error}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={onRetry}
                      style={{
                        height: 40,
                        padding: '0 16px',
                        borderRadius: 12,
                        border: 'none',
                        background: `linear-gradient(135deg, ${C.blue} 0%, #4EA1FF 100%)`,
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Повторить
                    </button>
                  </div>
                </div>
              </div>
            ) : user ? (
              <>
                {/* 3. Avatar and Title Area */}
                <div style={{ display: 'grid', justifyItems: 'center', padding: '24px 24px 16px', background: '#F1F3F6' }}>
                  <button
                    type="button"
                    onClick={() => setIsAvatarZoomed(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      borderRadius: '50%',
                      outline: 'none',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.03)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    title="Нажмите, чтобы увеличить аватарку"
                  >
                    <MessengerAvatar
                      initials={getInitials(title)}
                      imageUrl={user.avatarUrl}
                      size={96}
                      seed={getSeed(title)}
                      online={isOnline}
                    />
                  </button>

                  <h2 style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: C.ink, textAlign: 'center' }}>{title}</h2>
                  <p style={{ marginTop: 4, fontSize: 13, color: isOnline ? C.green : C.inkMuted, fontWeight: 500 }}>
                    {isOnline ? 'в сети' : 'был(а) недавно'}
                  </p>
                </div>

                {/* 4. Horizontal Pill-shaped action buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '12px 24px 24px',
                    background: '#F1F3F6',
                    width: '100%',
                  }}
                >
                  {/* Чат */}
                  <button
                    type="button"
                    onClick={onOpenChat}
                    style={{
                      flex: 1,
                      maxWidth: 120,
                      height: 68,
                      borderRadius: 20,
                      background: '#FFFFFF',
                      border: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(10,22,40,0.03)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      outline: 'none',
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <MS name="forum" size={22} color={C.blue} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>Чат</span>
                  </button>

                  {/* Видеозвонок / Звонок */}
                  {MESSENGER_VIDEO_CALLS_ENABLED ? (
                    <button
                      type="button"
                      onClick={onCall}
                      disabled={!onCall || isVirtualProfile}
                      style={{
                        flex: 1,
                        maxWidth: 120,
                        height: 68,
                        borderRadius: 20,
                        background: '#FFFFFF',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px rgba(10,22,40,0.03)',
                        cursor: onCall && !isVirtualProfile ? 'pointer' : 'default',
                        opacity: onCall && !isVirtualProfile ? 1 : 0.5,
                        transition: 'transform 0.15s ease',
                        outline: 'none',
                      }}
                      onMouseDown={(e) => { if (onCall && !isVirtualProfile) e.currentTarget.style.transform = 'scale(0.96)' }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      <MS name="videocam" size={22} color={C.blue} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>Звонок</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        maxWidth: 120,
                        height: 68,
                        borderRadius: 20,
                        background: '#FFFFFF',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px rgba(10,22,40,0.03)',
                        opacity: 0.5,
                      }}
                    >
                      <MS name="videocam" size={22} color={C.blue} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>Звонок</span>
                    </div>
                  )}

                  {/* Оценить */}
                  <button
                    type="button"
                    onClick={handleOpenReviewSheet}
                    disabled={!canReviewProfile || user.hasReviewedThisMonth}
                    style={{
                      flex: 1,
                      maxWidth: 120,
                      height: 68,
                      borderRadius: 20,
                      background: '#FFFFFF',
                      border: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(10,22,40,0.03)',
                      cursor: canReviewProfile && !user.hasReviewedThisMonth ? 'pointer' : 'default',
                      opacity: canReviewProfile && !user.hasReviewedThisMonth ? 1 : 0.5,
                      transition: 'transform 0.15s ease',
                      outline: 'none',
                    }}
                    onMouseDown={(e) => { if (canReviewProfile && !user.hasReviewedThisMonth) e.currentTarget.style.transform = 'scale(0.96)' }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <MS name="more_horiz" size={22} color={C.blue} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>Оценить</span>
                  </button>
                </div>

                {/* 5. ИНФОРМАЦИЯ Card */}
                <div
                  style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                    background: '#FFFFFF',
                    margin: '0 16px 16px',
                    boxShadow: '0 2px 8px rgba(10,22,40,0.01)',
                    border: `1px solid ${C.borderLight}`,
                  }}
                >
                  <TelegramInfoRow label="Гос. орган" value={user.stateBodyName || 'Не указано'} />
                  <div style={{ height: 1, background: C.borderLight, margin: '0 16px' }} />
                  <TelegramInfoRow
                    label={isVirtualProfile ? 'Описание' : 'Руководитель'}
                    value={isVirtualProfile ? 'Виртуальный ассистент Alem Workspace' : user.bossName || 'Не указано'}
                    isClickable={!isVirtualProfile && bossId !== null}
                    onClick={!isVirtualProfile && bossId !== null ? () => onOpenUserProfile(bossId) : undefined}
                    showChevron={!isVirtualProfile && bossId !== null}
                  />
                </div>

                {/* 6. АКТИВНОСТЬ Card */}
                <div
                  style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                    background: '#FFFFFF',
                    margin: '0 16px 16px',
                    boxShadow: '0 2px 8px rgba(10,22,40,0.01)',
                    border: `1px solid ${C.borderLight}`,
                  }}
                >
                  <TelegramInfoRow label="Последний вход" value={formatDateTime(user.lastLoginAt)} />
                  <div style={{ height: 1, background: C.borderLight, margin: '0 16px' }} />
                  <TelegramInfoRow label="Последняя активность" value={formatDateTime(user.lastSeenAt)} />
                  <div style={{ height: 1, background: C.borderLight, margin: '0 16px' }} />
                  <TelegramInfoRow label="Создан" value={formatDateTime(user.createdAt)} />
                </div>

                {/* 7. ОБРАЗОВАНИЕ Card */}
                <div style={{ padding: '4px 24px 8px', fontSize: 12, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.04em' }}>
                  ОБРАЗОВАНИЕ
                </div>
                {user.educations.length ? (
                  <div
                    style={{
                      borderRadius: 20,
                      overflow: 'hidden',
                      background: '#FFFFFF',
                      margin: '0 16px 16px',
                      border: `1px solid ${C.borderLight}`,
                      display: 'grid',
                    }}
                  >
                    {user.educations.map((item, index) => (
                      <div key={item.id}>
                        <EducationPreviewCard item={item} />
                        {index < user.educations.length - 1 && <div style={{ height: 1, background: C.borderLight, margin: '0 16px' }} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <ProfileSectionEmpty message="Пользователь пока не добавил записи об образовании." />
                )}

                {/* 8. ЛИЦЕНЗИИ И СЕРТИФИКАТЫ Card */}
                <div style={{ padding: '4px 24px 8px', fontSize: 12, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.04em' }}>
                  ЛИЦЕНЗИИ И СЕРТИФИКАТЫ
                </div>
                {user.licenses.length ? (
                  <div
                    style={{
                      borderRadius: 20,
                      overflow: 'hidden',
                      background: '#FFFFFF',
                      margin: '0 16px 16px',
                      border: `1px solid ${C.borderLight}`,
                      display: 'grid',
                    }}
                  >
                    {user.licenses.map((item, index) => (
                      <div key={item.id}>
                        <LicensePreviewCard item={item} />
                        {index < user.licenses.length - 1 && <div style={{ height: 1, background: C.borderLight, margin: '0 16px' }} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <ProfileSectionEmpty message="В профиле пока нет лицензий и сертификатов." />
                )}

                {/* 9. ЕЖЕМЕСЯЧНАЯ ОЦЕНКА Card */}
                {canReviewProfile && (
                  <div>
                    <div style={{ padding: '4px 24px 8px', fontSize: 12, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.04em' }}>
                      ЕЖЕМЕСЯЧНАЯ ОЦЕНКА
                    </div>
                    <div
                      style={{
                        borderRadius: 20,
                        overflow: 'hidden',
                        background: '#FFFFFF',
                        margin: '0 16px 16px',
                        padding: 16,
                        border: `1px solid ${C.borderLight}`,
                        display: 'grid',
                        gap: 16,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 32, fontWeight: 800, color: C.ink }}>
                              {overallReviewScore === null ? '—' : overallReviewScore.toFixed(1)}
                            </span>
                            <span style={{ fontSize: 14, color: C.inkMuted, fontWeight: 600 }}>/ 5.0</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>{reviewSummary}</div>
                        </div>
                        
                        <div style={{ background: '#F5F7FB', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MS name="stars" size={16} color={C.blue} />
                          <span>{user.reviewStats?.reviewCount ? `${user.reviewStats.reviewCount} оценок` : 'Оценок нет'}</span>
                        </div>
                      </div>

                      <div style={{ height: 1, background: C.borderLight }} />

                      <div style={{ display: 'grid', gap: 10 }}>
                        {REVIEW_CRITERIA.map((criterion) => {
                          const score = getMetricValue(user.reviewStats, criterion.statKey)
                          const displayScore = score === null ? '—' : score.toFixed(1)
                          return (
                            <div key={criterion.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 6, background: criterion.tint, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                                  <MS name={criterion.icon} size={14} color={criterion.accent} />
                                </div>
                                <span style={{ color: C.ink, fontWeight: 500 }}>{criterion.label}</span>
                              </div>
                              <span style={{ fontWeight: 700, color: criterion.accent }}>{displayScore} / 5.0</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 10. Rating Status block inside scroll */}
                {user && !isLoading && !error && canReviewProfile && (
                  <div style={{ margin: '8px 16px 24px' }}>
                    {reviewNotice && (
                      <div
                        style={{
                          borderRadius: 14,
                          border: `1px solid ${noticeStyles[reviewNotice.tone].border}`,
                          background: noticeStyles[reviewNotice.tone].background,
                          color: noticeStyles[reviewNotice.tone].text,
                          padding: 12,
                          fontSize: 13,
                          fontWeight: 600,
                          marginBottom: 12,
                          textAlign: 'center',
                        }}
                      >
                        {reviewNotice.message}
                      </div>
                    )}

                    {user.hasReviewedThisMonth ? (
                      <div
                        style={{
                          borderRadius: 20,
                          border: `1px solid ${C.borderLight}`,
                          background: '#FFFFFF',
                          padding: 16,
                          textAlign: 'center',
                          fontSize: 13,
                          color: C.inkMuted,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: C.green, fontWeight: 700 }}>
                          <MS name="check_circle" size={18} color={C.green} />
                          <span>Оценка на этот месяц успешно принята</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11 }}>Повторно оценить пользователя можно будет в следующем месяце.</div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenReviewSheet}
                        style={{
                          width: '100%',
                          height: 48,
                          borderRadius: 20,
                          border: 'none',
                          background: C.blue,
                          color: '#FFFFFF',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(30,136,229,0.15)',
                          transition: 'transform 0.15s ease',
                          outline: 'none',
                        }}
                        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
                        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        Оставить анонимный отзыв
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 11. Anonymous Rating Modal Dialog */}
      {user && isReviewSheetOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 570,
            background: 'rgba(10,22,40,0.28)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
          onClick={() => {
            if (isSubmittingReview) {
              return
            }

            setIsReviewSheetOpen(false)
            setReviewError('')
          }}
        >
          <div
            style={{
              width: 760,
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 'min(88vh, 860px)',
              borderRadius: 28,
              background: '#F7FAFE',
              boxShadow: '0 34px 84px rgba(10,22,40,0.2)',
              border: '1px solid rgba(255,255,255,0.7)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                padding: '22px 24px 18px',
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F1F7FF 100%)',
                borderBottom: `1px solid ${C.borderLight}`,
                display: 'grid',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#7B8CA8', letterSpacing: '0.08em' }}>
                    АНОНИМНЫЙ ОТЗЫВ
                  </div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, lineHeight: 1.15, color: C.ink }}>
                    Оцените работу {title}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: C.inkMuted, maxWidth: 560 }}>
                    Отметьте уровень по пяти ключевым навыкам. Автор оценки не отображается, а результат влияет только на агрегированную статистику профиля.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isSubmittingReview) {
                      return
                    }

                    setIsReviewSheetOpen(false)
                    setReviewError('')
                  }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    border: `1px solid ${C.borderLight}`,
                    background: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isSubmittingReview ? 'default' : 'pointer',
                    flexShrink: 0,
                    outline: 'none',
                  }}
                >
                  <MS name="close" size={18} color={C.inkMuted} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    minHeight: 48,
                    borderRadius: 16,
                    background: '#FFFFFF',
                    border: `1px solid ${C.borderLight}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 14px',
                  }}
                >
                  <MS name="task_alt" size={18} color={C.blue} />
                  <div>
                    <div style={{ fontSize: 12, color: C.inkMuted, fontWeight: 700 }}>Заполнено</div>
                    <div style={{ fontSize: 15, color: C.ink, fontWeight: 900 }}>
                      {completedReviewCriteriaCount} / {REVIEW_CRITERIA.length}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    minHeight: 48,
                    borderRadius: 16,
                    background: '#FFFFFF',
                    border: `1px solid ${C.borderLight}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 14px',
                  }}
                >
                  <MS name="rate_review" size={18} color="#15803D" />
                  <div>
                    <div style={{ fontSize: 12, color: C.inkMuted, fontWeight: 700 }}>Статистика</div>
                    <div style={{ fontSize: 15, color: C.ink, fontWeight: 900 }}>{reviewSummary}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'grid', gap: 14 }}>
              {REVIEW_CRITERIA.map((criterion) => (
                <ReviewScoreRow
                  key={criterion.key}
                  criterion={criterion}
                  value={reviewDraft[criterion.key]}
                  disabled={isSubmittingReview}
                  onChange={(value) => handleUpdateReviewScore(criterion.key, value)}
                />
              ))}

              {reviewError ? (
                <div
                  style={{
                    borderRadius: 18,
                    border: '1px solid #FECDD3',
                    background: '#FFF1F2',
                    color: '#BE123C',
                    padding: '14px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.5,
                  }}
                >
                  {reviewError}
                </div>
              ) : null}
            </div>

            <div
              style={{
                padding: '18px 20px 20px',
                borderTop: `1px solid ${C.borderLight}`,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12, lineHeight: 1.5, color: C.inkMuted, maxWidth: 420 }}>
                После отправки отзыв нельзя повторить в этом месяце. Если сервер не разрешит отзыв, причина отобразится здесь же.
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isSubmittingReview) {
                      return
                    }

                    setIsReviewSheetOpen(false)
                    setReviewError('')
                  }}
                  disabled={isSubmittingReview}
                  style={{
                    ...sheetButtonStyle,
                    padding: '0 16px',
                    border: `1px solid ${C.borderLight}`,
                    background: '#FFFFFF',
                    color: C.inkMuted,
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSubmitReview()
                  }}
                  disabled={isSubmittingReview}
                  style={{
                    ...sheetButtonStyle,
                    padding: '0 18px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #1E7BFF 0%, #63B3FF 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 18px 34px rgba(30,123,255,0.22)',
                  }}
                >
                  {isSubmittingReview ? 'Сохраняем...' : 'Отправить отзыв'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {user && (
        <AvatarLightbox
          isOpen={isAvatarZoomed}
          imageUrl={user.avatarUrl}
          initials={getInitials(title)}
          seed={getSeed(title)}
          title={title}
          onClose={() => setIsAvatarZoomed(false)}
        />
      )}
    </>
  )
}
