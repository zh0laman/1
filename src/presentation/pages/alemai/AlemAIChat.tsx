import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'


import { createAuthController } from '../../auth/createAuthController'

import {
  askQuestion,
  createChatConversation,
  getChatConversation,
  listChatConversations,
} from './chat/api/client'
import SettingsModal from './chat/components/SettingsModal'
import type { AlemAiProfile } from '../../../infrastructure/repositories/HttpAlemAiRepository'

import type {
  AskApiResponse,
  AskHistoryMessage,
  ChatConversationSummary,
} from './chat/api/types'
import { INITIAL_MESSAGES } from './chat/data'
import type { ChatMessage } from './chat/types'
import { getCurrentRuTime } from './chat/utils'
import { Icon } from './chat/components/Icons'
import { MessageBubble } from './chat/components/MessageBubble'
import { Sidebar } from './chat/components/Sidebar'
import { TypingDots } from './chat/components/TypingDots'
import { MeetingAiPanel } from './meeting-ai/components/MeetingAiPanel'
import { SmartAgentPanel } from './smart-agent/components/SmartAgentPanel'
import { TzAiPanel } from './tzai/components/TzAiPanel'
import './styles/alemai.css'

const API_ERROR_MESSAGE = 'Не удалось получить ответ от сервера Alem AI. Попробуйте снова через несколько секунд.'
const SELECTED_TOOL_STORAGE_KEY = 'alemai:selected-tool'
const SELECTED_CONVERSATION_STORAGE_KEY = 'alemai:chat:selected-conversation'
const SEARCH_MODE_STORAGE_KEY = 'alemai:chat:search-mode'
const CHAT_HISTORY_ENABLED = false

type SelectedTool = 'chat' | 'meeting-ai' | 'tzai' | 'smart-agent'
type SearchMode = 'auto' | 'kb' | 'web'

interface ComposerAttachment {
  file: File
  name: string
  previewUrl?: string
}

const isSelectedTool = (value: string | null): value is SelectedTool =>
  value === 'chat' || value === 'meeting-ai' || value === 'tzai' || value === 'smart-agent'

const isSearchMode = (value: string | null): value is SearchMode =>
  value === 'auto' || value === 'kb' || value === 'web'

const hasNoLiveSources = (response: AskApiResponse): boolean => {
  const haystack = [
    response.answer,
    response.rationale,
    response.confidence?.reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes('no live sources') || haystack.includes('веб-поиск не вернул документов')
}

const shouldHideDisplayUrl = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false

  return normalized === 'https://alem-workspace.gov.kz/v1/chats' || normalized.startsWith('https://alem-workspace.gov.kz/v1/chats/')
}

const sanitizeDisplayText = (value: string): string =>
  value
    .split('\n')
    .filter((line) => !shouldHideDisplayUrl(line.trim()))
    .join('\n')

const adaptQuestionForSearchMode = (question: string, mode: SearchMode): string => {
  const trimmed = question.trim()
  if (!trimmed) return trimmed

  if (mode === 'kb') {
    return `[Режим: база знаний]\nИспользуй внутреннюю базу знаний и не опирайся на веб-поиск, если это не абсолютно необходимо.\n\nВопрос: ${trimmed}`
  }

  if (mode === 'web') {
    return `[Режим: веб-поиск]\nСделай упор на актуальные внешние источники и веб-поиск. Если живые источники не найдены, явно скажи об этом.\n\nВопрос: ${trimmed}`
  }

  return trimmed
}

const formatAssistantText = (response: AskApiResponse, requestedMode: SearchMode): string => {
  if (hasNoLiveSources(response)) {
    if (requestedMode === 'web') {
      return [
        'Веб-поиск не вернул актуальных источников по этому запросу.',
        '',
        'Попробуйте:',
        '- уточнить запрос или добавить контекст',
        '- указать должность, организацию или период',
        '- повторить запрос позже',
      ].join('\n')
    }

    return [
      'Не удалось получить актуальные источники по этому запросу.',
      '',
      'Попробуйте переформулировать вопрос или уточнить детали.',
    ].join('\n')
  }

  if (!response.sources?.length) {
    return sanitizeDisplayText(response.answer)
  }

  if (/источники\s*:/i.test(response.answer)) {
    return sanitizeDisplayText(response.answer)
  }

  const topSources = response.sources.filter((source) => !shouldHideDisplayUrl(source.url)).slice(0, 3)
  if (topSources.length === 0) {
    return sanitizeDisplayText(response.answer)
  }
  const sourcesText = topSources.map((source) => `- ${source.url}`).join('\n')

  return sanitizeDisplayText(`${response.answer}\n\nИсточники:\n${sourcesText}`)
}

const toChatMessages = (history: AskHistoryMessage[]): ChatMessage[] =>
  history.map((item, index) => ({
    id: Date.now() + index,
    role: item.role,
    text: item.content,
    time: item.created_at ? new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : undefined,
  }))

const normalizeChatName = (value?: string | null): string => {
  const text = (value || '').trim()
  if (text) return text
  return 'Новый чат'
}

const buildNewConversationName = (input: string): string => {
  const normalized = input.trim().replace(/\s+/g, ' ')
  if (!normalized) return 'Новый чат'
  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized
}

const getConversationSortValue = (value: ChatConversationSummary): number => {
  const stamp = value.updated_at || value.last_message_at
  if (!stamp) return 0
  const parsed = new Date(stamp).valueOf()
  return Number.isNaN(parsed) ? 0 : parsed
}

const sortConversations = (items: ChatConversationSummary[]): ChatConversationSummary[] =>
  [...items].sort((a, b) => getConversationSortValue(b) - getConversationSortValue(a))

const upsertConversation = (
  items: ChatConversationSummary[],
  nextConversation: ChatConversationSummary,
): ChatConversationSummary[] => {
  const withoutTarget = items.filter((item) => item.conv_id !== nextConversation.conv_id)
  return sortConversations([nextConversation, ...withoutTarget])
}

interface AlemAIChatProps {
  authToken: string
}

export default function AlemAIChat({ authToken }: AlemAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string>(() =>
    CHAT_HISTORY_ENABLED ? window.localStorage.getItem(SELECTED_CONVERSATION_STORAGE_KEY) || '' : '',
  )
  const [conversationHistory, setConversationHistory] = useState<AskHistoryMessage[]>([])
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [isConversationsLoading, setIsConversationsLoading] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [conversationsError, setConversationsError] = useState('')
  const [conversationDetailError, setConversationDetailError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [compactLayout, setCompactLayout] = useState(false)
  const [selectedTool, setSelectedTool] = useState<SelectedTool>(() => {
    const stored = window.localStorage.getItem(SELECTED_TOOL_STORAGE_KEY)
    return isSelectedTool(stored) ? stored : 'chat'
  })
  const [searchMode] = useState<SearchMode>(() => {
    const stored = window.localStorage.getItem(SEARCH_MODE_STORAGE_KEY)
    return isSearchMode(stored) ? stored : 'auto'
  })

  // Quick Action Buttons States
  const [isReasoningActive] = useState(false)
  const [isCreateImageActive] = useState(false)
  const [isDeepResearchActive] = useState(false)

  // Profile Information
  const { authController } = useMemo(() => createAuthController(), [])
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; avatarUrl: string }>({
    name: 'Пользователь',
    email: '',
    avatarUrl: '',
  })

  // Settings & Theme Customization States
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [chatBackgroundStyle, setChatBackgroundStyle] = useState<React.CSSProperties>({})
  const [customAssistantName, setCustomAssistantName] = useState('Ассистент')
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null)

  const applyAccentColor = (hex: string) => {
    const raw = String(hex || '').trim()
    const c = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : '#1d72e7'
    
    const darkenHex = (h: string, amt: number) => {
      const n = parseInt(h.slice(1), 16)
      const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
      const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
      const b = Math.max(0, Math.min(255, (n & 255) + amt))
      return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
    }
    
    const hexToRgba = (h: string, alpha: number) => {
      const n = parseInt(h.slice(1), 16)
      const r = (n >> 16) & 255
      const g = (n >> 8) & 255
      const b = n & 255
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    const dark = darkenHex(c, -30)
    const light = darkenHex(c, 12)

    document.documentElement.style.setProperty('--teal', c)
    document.documentElement.style.setProperty('--teal-dark', dark)
    document.documentElement.style.setProperty('--accent-grad-start', light)
    document.documentElement.style.setProperty('--accent-grad-end', dark)
    document.documentElement.style.setProperty('--accent-ring', hexToRgba(c, 0.16))
    document.documentElement.style.setProperty('--accent-shadow', hexToRgba(c, 0.22))
    document.documentElement.style.setProperty('--accent-soft', hexToRgba(c, 0.18))
    document.documentElement.style.setProperty('--accent-glow', hexToRgba(c, 0.32))
    document.documentElement.style.setProperty('--page-glow-primary', hexToRgba(c, 0.16))
    document.documentElement.style.setProperty('--page-glow-secondary', hexToRgba(light, 0.12))
    document.documentElement.style.setProperty('--messages-accent-wash', hexToRgba(c, 0.12))
    document.documentElement.style.setProperty('--messages-accent-surface', hexToRgba(c, 0.06))
    document.documentElement.style.setProperty('--bot-icon-surface', hexToRgba(c, 0.16))
  }

  const applyChatBackground = (type: string, value: string) => {
    const t = (type || 'default').toLowerCase()
    const v = String(value || '').trim()

    if (t === 'color' && /^#[0-9a-fA-F]{6}$/.test(v)) {
      setChatBackgroundStyle({
        backgroundColor: v,
        backgroundImage: 'none',
      })
      return
    }

    if (t === 'image' && v.startsWith('data:image/')) {
      const safe = v.replace(/'/g, '%27')
      setChatBackgroundStyle({
        backgroundColor: 'rgba(10,12,20,0.42)',
        backgroundImage: `linear-gradient(rgba(12,16,26,0.42), rgba(12,16,26,0.42)), url('${safe}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundBlendMode: 'multiply',
      })
      return
    }

    setChatBackgroundStyle({})
  }

  const handleProfileUpdated = (prof: AlemAiProfile) => {
    if (prof.assistant_name) {
      setCustomAssistantName(prof.assistant_name)
    }
    if (prof.chat_accent_color) {
      applyAccentColor(prof.chat_accent_color)
    }
    applyChatBackground(prof.chat_background_type, prof.chat_background_value)
  }

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedConversationIdRef = useRef(selectedConversationId)

  const clearAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl)
      }
      return null
    })
  }, [])

  useEffect(() => () => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
  }, [attachment])

  const token = authToken.trim()

  useEffect(() => {
    let isCancelled = false
    const loadProfile = async () => {
      try {
        const authModel = await authController.bootstrap()
        if (!isCancelled) {
          setUserProfile({
            name: authModel.name || 'Пользователь',
            email: authModel.email || '',
            avatarUrl: authModel.avatarUrl || '',
          })
        }
      } catch {
        // ignore
      }
    }
    void loadProfile()
    return () => {
      isCancelled = true
    }
  }, [authController])

  useEffect(() => {
    const applyLayout = () => {
      const compact = window.innerWidth < 1024
      setCompactLayout(compact)
      setSidebarOpen(!compact)
    }

    applyLayout()
    window.addEventListener('resize', applyLayout)
    return () => window.removeEventListener('resize', applyLayout)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    window.localStorage.setItem(SELECTED_TOOL_STORAGE_KEY, selectedTool)
  }, [selectedTool])

  useEffect(() => {
    window.localStorage.setItem(SEARCH_MODE_STORAGE_KEY, searchMode)
  }, [searchMode])

  useEffect(() => {
    if (!CHAT_HISTORY_ENABLED) {
      window.localStorage.removeItem(SELECTED_CONVERSATION_STORAGE_KEY)
      return
    }

    if (selectedConversationId) {
      window.localStorage.setItem(SELECTED_CONVERSATION_STORAGE_KEY, selectedConversationId)
      return
    }
    window.localStorage.removeItem(SELECTED_CONVERSATION_STORAGE_KEY)
  }, [selectedConversationId])

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  useEffect(() => {
    if (!CHAT_HISTORY_ENABLED) {
      setConversations([])
      return
    }

    let isAlive = true

    const loadConversations = async () => {
      if (!token) {
        setConversations([])
        return
      }

      setIsConversationsLoading(true)
      setConversationsError('')
      try {
        const loaded = await listChatConversations(token)
        if (!isAlive) return

        const sorted = sortConversations(loaded)
        setConversations(sorted)

        if (!selectedConversationIdRef.current && sorted.length > 0) {
          setSelectedConversationId(sorted[0].conv_id)
        }
      } catch (error) {
        if (!isAlive) return
        setConversationsError(error instanceof Error ? error.message : 'Не удалось загрузить историю чатов')
      } finally {
        if (isAlive) {
          setIsConversationsLoading(false)
        }
      }
    }

    void loadConversations()

    return () => {
      isAlive = false
    }
  }, [token])

  const hydrateConversation = useCallback(
    async (convId: string) => {
      if (!token || !convId) return

      setIsConversationLoading(true)
      setConversationDetailError('')
      setConversationHistory([])
      setMessages([])

      try {
        const detail = await getChatConversation(token, convId)
        const history = Array.isArray(detail.messages) ? detail.messages : []
        setConversationHistory(history)
        setMessages(toChatMessages(history))
        setConversations((prev) =>
          upsertConversation(prev, {
            conv_id: detail.conv_id,
            name: normalizeChatName(detail.name),
            updated_at: detail.updated_at || null,
            preview: history[history.length - 1]?.content || null,
          }),
        )
      } catch (error) {
        setConversationDetailError(error instanceof Error ? error.message : 'Не удалось загрузить выбранный диалог')
      } finally {
        setIsConversationLoading(false)
      }
    },
    [token],
  )

  const handleSelectConversation = useCallback(
    (convId: string) => {
      if (!convId) return
      setSelectedTool('chat')
      setSelectedConversationId(convId)
      if (compactLayout) {
        setSidebarOpen(false)
      }
    },
    [compactLayout],
  )

  useEffect(() => {
    if (!CHAT_HISTORY_ENABLED) {
      return
    }

    if (!selectedConversationId || !token) {
      if (!selectedConversationId) {
        setConversationHistory([])
        setMessages(INITIAL_MESSAGES)
      }
      return
    }

    void hydrateConversation(selectedConversationId)
  }, [selectedConversationId, token, hydrateConversation])

  const autoResize = () => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
  }

  const resetComposer = () => {
    setInput('')
    clearAttachment()
    setIsTyping(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleCreateConversation = useCallback(async () => {
    if (!token || isCreatingConversation) return

    setSelectedTool('chat')
    setIsCreatingConversation(true)
    setConversationsError('')

    try {
      const created = await createChatConversation(token, 'Новый чат')
      setConversations((prev) => upsertConversation(prev, created))
      setSelectedConversationId(created.conv_id)
      setConversationHistory([])
      setMessages(INITIAL_MESSAGES)
      resetComposer()
    } catch (error) {
      setConversationsError(error instanceof Error ? error.message : 'Не удалось создать новый диалог')
    } finally {
      setIsCreatingConversation(false)
    }
  }, [token, isCreatingConversation])

  const sendMessage = async () => {
    const trimmedInput = input.trim()
    if ((!trimmedInput && !attachment) || isTyping) {
      return
    }

    const activeAttachment = attachment
    const fallbackQuestion = activeAttachment
      ? activeAttachment.previewUrl
        ? 'Опиши изображение'
        : 'Проанализируй вложение'
      : ''
    let requestText = trimmedInput || fallbackQuestion
    let displayText = trimmedInput

    setInput('')
    clearAttachment()

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    if (activeAttachment) {
      const attachmentLabel = activeAttachment.previewUrl
        ? `[Изображение: ${activeAttachment.name}]`
        : `[Файл: ${activeAttachment.name}]`
      displayText = [attachmentLabel, trimmedInput].filter(Boolean).join('\n')
    }

    if (isReasoningActive) {
      requestText = `[Рассуждение] ${requestText}`
      displayText = `[Рассуждение] ${displayText || fallbackQuestion}`
    } else if (isCreateImageActive) {
      requestText = `[Создать изображение] ${requestText}`
      displayText = `[Создать изображение] ${displayText || fallbackQuestion}`
    } else if (isDeepResearchActive) {
      requestText = `[Глубокий поиск] ${requestText}`
      displayText = `[Глубокий поиск] ${displayText || fallbackQuestion}`
    }

    if (!displayText) {
      displayText = requestText
    }

    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: displayText, time: getCurrentRuTime() }])
    setIsTyping(true)

    try {
      if (!token) {
        throw new Error('Сначала выполните вход через форму Авторизация.')
      }

      const response = await askQuestion({
        question: adaptQuestionForSearchMode(requestText, searchMode),
        token,
        convId: selectedConversationId || null,
        conversationHistory,
        file: activeAttachment?.file ?? null,
      })

      const payload = response.fullResponse
      const nextConvId = response.convId || selectedConversationId
      const nextHistory = response.conversationHistory

      if (nextConvId) {
        setSelectedConversationId(nextConvId)
      }
      setConversationHistory(nextHistory)

      if (nextConvId) {
        const conversationName = buildNewConversationName(trimmedInput || activeAttachment?.name || requestText)
        setConversations((prev) =>
          upsertConversation(prev, {
            conv_id: nextConvId,
            name: normalizeChatName(prev.find((item) => item.conv_id === nextConvId)?.name || conversationName),
            updated_at: new Date().toISOString(),
            preview: payload.answer,
            last_message: payload.answer,
          }),
        )
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          time: getCurrentRuTime(),
          text: formatAssistantText(payload, searchMode),
          meta: {
            route: payload.route,
            learned: payload.learned,
            rationale: payload.rationale,
            confidenceScore: payload.confidence?.score,
            confidenceLabel: payload.confidence?.label,
            noLiveSources: hasNoLiveSources(payload),
            sources: payload.sources?.filter((source) => !shouldHideDisplayUrl(source.url)).map((source) => ({
              title: source.title,
              url: source.url,
            })),
          },
        },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : API_ERROR_MESSAGE
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          time: getCurrentRuTime(),
          text: message,
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const handleAttachmentClick = () => {
    fileInputRef.current?.click()
  }
  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const normalizedName = file.name.trim() || 'file'
    const isTextLike =
      file.type.startsWith('text/') ||
      /(\.txt|\.md|\.json|\.csv|\.log|\.xml)$/i.test(normalizedName)
    if (isTextLike) {
      try {
        const content = await file.text()
        const nextValue = [input.trim(), `[Файл: ${normalizedName}]`, content.trim()]
          .filter(Boolean)
          .join('\n\n')
        setInput(nextValue)
        requestAnimationFrame(autoResize)
        return
      } catch {
        setInput((prev) => `${prev.trim()}\n\n[Файл: ${normalizedName}]`.trim())
        requestAnimationFrame(autoResize)
        return
      }
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    setAttachment((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl)
      }
      return {
        file,
        name: normalizedName,
        previewUrl,
      }
    })
  }
  const isEmpty = messages.length === 0
  const showTzAi = selectedTool === 'tzai'
  const showMeetingAi = selectedTool === 'meeting-ai'
  const showSmartAgent = selectedTool === 'smart-agent'
  const showChat = selectedTool === 'chat'
  const contentWidthClass = showChat || showSmartAgent ? 'max-w-240' : 'max-w-240'
  const pageTitle = useMemo(() => {
    if (selectedTool === 'chat') return customAssistantName
    if (selectedTool === 'smart-agent') return 'AlemAi.Assistant'
    if (selectedTool === 'tzai') return 'AlemAi.Tasks'
    return 'Помощник встреч'
  }, [selectedTool, customAssistantName])
  const renderInputComposer = (isCentered: boolean) => {
    return (
      <div className={`w-full ${isCentered ? 'max-w-2xl mx-auto' : 'max-w-3xl mx-auto'} transition-all z-10`}>
        <div className="glass-panel rounded-[32px] border border-slate-200/50 p-2 shadow-[0_12px_48px_rgba(0,0,0,0.035)] bg-white/80 backdrop-blur-md transition-all focus-within:border-blue-400/80 focus-within:ring-4 focus-within:ring-blue-100/50 flex flex-col gap-2">
          
          {/* Attachment Preview (Rendered inside the capsule on top of the input row) */}
          {attachment && (
            <div className="px-3 pt-2">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5">
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700">{attachment.name}</p>
                  <p className="text-xs text-gray-400">
                    {attachment.previewUrl ? 'Изображение прикреплено' : 'Файл прикреплен'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAttachment}
                  className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
                  title="Убрать вложение"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Main Input Row */}
          <div className="flex items-center gap-2 pl-2 pr-1.5 py-1">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={handleAttachmentClick}
              className="w-10 h-10 shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full flex items-center justify-center transition-all"
              title="Прикреппить файл"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5.5 h-5.5 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05L12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttachmentChange}
            />

            {/* Input Field */}
            <div className="flex-1 flex items-center min-w-0">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  autoResize()
                }}
                onKeyDown={handleKeyDown}
                placeholder={isCentered ? "Задайте вопрос или отправьте команду к AI..." : "Напишите сообщение..."}
                className="flex-1 bg-transparent text-[15px] text-gray-800 placeholder:text-gray-400 outline-none leading-relaxed py-2 min-h-10 max-h-40 resize-none hide-scrollbars focus:outline-none"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={() => {
                void sendMessage()
              }}
              disabled={isTyping || (!input.trim() && !attachment)}
              style={{
                backgroundImage: 'linear-gradient(to top right, var(--accent-grad-end, #1d72e7), var(--accent-grad-start, #3b82f6))',
                boxShadow: '0 10px 24px var(--accent-shadow, rgba(29,114,231,0.2))',
              }}
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white hover:shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="chat-shell flex h-full min-h-0 overflow-hidden text-gray-900 bg-transparent">
      {CHAT_HISTORY_ENABLED && (
        <Sidebar
          collapsed={!sidebarOpen}
          compact={compactLayout}
          onClose={() => setSidebarOpen(false)}
          showChatHistory={showChat}
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={() => {
            void handleCreateConversation()
          }}
          isConversationsLoading={isConversationsLoading}
          isConversationLoading={isConversationLoading}
          isCreatingConversation={isCreatingConversation}
          conversationsError={conversationsError}
          detailError={conversationDetailError}
        />
      )}

      <div style={{ background: 'linear-gradient(135deg, #F4F9FF 0%, #EEF6FF 38%, #F7FBFF 68%, #EAF4FF 100%)' }} className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Background glowing aurora orbs */}
        <div
          style={{ backgroundColor: 'var(--page-glow-primary, rgba(29,114,231,0.16))' }}
          className="absolute top-[10%] left-[15%] w-[320px] h-[320px] rounded-full blur-[100px] pointer-events-none animate-pulse duration-8000 z-0"
        />
        <div
          style={{ backgroundColor: 'var(--page-glow-secondary, rgba(59,130,246,0.12))' }}
          className="absolute bottom-[10%] right-[10%] w-[380px] h-[380px] rounded-full blur-[110px] pointer-events-none animate-pulse duration-10000 z-0"
        />

        <header className="hidden px-5 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 shrink-0 bg-white/40 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200/20 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100/60 hover:text-gray-700 transition-colors z-10"
            >
              <Icon.Menu />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate text-gray-900 font-head">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-full border border-slate-200/50 bg-white/90 hover:bg-white active:scale-95 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-gray-500 hover:text-gray-700 shrink-0 z-10"
              title="Настройки ассистента"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 px-3 py-3 sm:px-4 sm:py-4 md:px-5 relative z-10">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[36px] border border-white/65 bg-white/38 shadow-[0_18px_60px_rgba(104,138,198,0.14)] backdrop-blur-[18px]">
            <header className="px-5 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 shrink-0 bg-white/30 backdrop-blur-md border-b border-white/50 justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  className="hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100/60 hover:text-gray-700 transition-colors z-10"
                >
                  <Icon.Menu />
                </button>

                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold tracking-tight truncate text-gray-900 font-head">{pageTitle}</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 rounded-full border border-slate-200/50 bg-white/90 hover:bg-white active:scale-95 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-gray-500 hover:text-gray-700 shrink-0 z-10"
                  title="Настройки ассистента"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </header>
            <div style={chatBackgroundStyle} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 md:px-8 transition-all duration-300">
              <div className={`${contentWidthClass} mx-auto pb-4`}>
            <div className={showMeetingAi ? 'block panel-enter' : 'hidden'}>
              <MeetingAiPanel token={authToken} />
            </div>
            <div className={showTzAi ? 'block panel-enter' : 'hidden'}>
              <TzAiPanel token={authToken} />
            </div>
            <div className={showSmartAgent ? 'block panel-enter' : 'hidden'}>
              <SmartAgentPanel token={authToken} />
            </div>

            {showChat && isConversationLoading && (
              <div className="chat-conversation-loading msg-enter mb-6 rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-500">
                  <span className="chat-conversation-loading__dot h-2 w-2 rounded-full bg-blue-500" />
                  Загружаем переписку...
                </div>
                <div className="space-y-3">
                  <div className="chat-conversation-loading__line h-3 w-[82%] rounded-full" />
                  <div className="chat-conversation-loading__line h-3 w-[68%] rounded-full" />
                  <div className="chat-conversation-loading__line h-3 w-[74%] rounded-full" />
                </div>
              </div>
            )}

            {showChat && isEmpty && (
              <div className="flex flex-col items-center justify-center text-center mt-12 mb-8 msg-enter max-w-2xl mx-auto px-4">
                <div className="flex justify-center mb-6 orb-container">
                  <div className="holographic-orb" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2 font-head">
                  Добрый день, {userProfile.name.split(' ')[0]}
                </h2>
                <p className="text-xl font-medium text-gray-500 mb-8 leading-normal">
                  Чем я могу{' '}
                  <span
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, var(--accent-grad-end, #1d72e7), var(--accent-grad-start, #3b82f6), var(--teal, #1d72e7))',
                    }}
                    className="bg-clip-text text-transparent font-semibold"
                  >
                    помочь вам сегодня?
                  </span>
                </p>

                {renderInputComposer(true)}
              </div>
            )}

            {showChat && messages.map((msg) => (
              <div key={msg.id} className="msg-enter">
                <MessageBubble msg={msg} />
              </div>
            ))}

            {showChat && isTyping && (
              <div className="flex gap-3 sm:gap-4 mb-6 msg-enter">
                <div
                  style={{
                    backgroundImage: 'linear-gradient(to top right, var(--accent-grad-end, #1d72e7), var(--accent-grad-start, #3b82f6))',
                    boxShadow: '0 2px 10px var(--accent-shadow, rgba(29,114,231,0.18))',
                  }}
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white mt-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5 text-white stroke-[2.5] stroke-current" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
                    <path d="m12 7 1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z" fill="currentColor" />
                  </svg>
                </div>
                <div className="px-5 py-4 rounded-[24px] rounded-tl-[4px] bg-white/85 backdrop-blur-sm border border-slate-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-center min-h-11">
                  <TypingDots />
                </div>
              </div>
            )}

                {showChat && <div ref={bottomRef} />}
              </div>
            </div>

            {showChat && !isEmpty && (
              <div className="px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 shrink-0">
                {renderInputComposer(false)}
              </div>
            )}
          </div>
        </div>

        {!showChat && !showSmartAgent && (
          <div className="bg-white/80 backdrop-blur-md border-t border-gray-100/80 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] px-4 sm:px-6 shrink-0 relative z-10">
            <div className="max-w-240 mx-auto">
              <p className="text-xs text-center text-gray-400 py-3">
                Выберите действие в левой панели и заполните форму.
              </p>
            </div>
          </div>
        )}
      </div>
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        token={token} 
        onProfileUpdated={handleProfileUpdated} 
      />
    </div>
  )
}
