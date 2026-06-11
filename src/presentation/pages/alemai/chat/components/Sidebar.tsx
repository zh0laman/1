import { useState } from 'react'
import type { ChatConversationSummary } from '../api/types'
import { formatConversationTimestamp } from '../utils'
import { Icon } from './Icons'

interface SidebarProps {
  collapsed: boolean
  compact: boolean
  onClose: () => void
  showChatHistory: boolean
  conversations: ChatConversationSummary[]
  selectedConversationId: string
  onSelectConversation: (convId: string) => void
  onCreateConversation: () => void
  isConversationsLoading: boolean
  isConversationLoading: boolean
  isCreatingConversation: boolean
  conversationsError: string
  detailError: string
}

const normalizeHistoryError = (value: string): string => {
  if (!value) return value
  if (/not\s+found/i.test(value)) {
    return 'История чатов пока недоступна на сервере.'
  }
  return value
}

export function Sidebar({
  collapsed,
  compact,
  onClose,
  showChatHistory,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  isConversationsLoading,
  isConversationLoading,
  isCreatingConversation,
  conversationsError,
  detailError,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredConversations = conversations.filter((conversation) => {
    const name = conversation.name || 'Новый чат'
    const preview = conversation.preview || conversation.last_message || ''
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preview.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <>
      {compact && (
        <button
          onClick={onClose}
          className={`fixed inset-0 z-30 transition-opacity duration-300 ${
            !collapsed ? 'bg-gray-900/40 opacity-100' : 'bg-transparent opacity-0 pointer-events-none'
          }`}
          aria-label="Закрыть меню"
        />
      )}

      <aside
        className={`bg-white/38 backdrop-blur-[18px] border border-white/65 rounded-[36px] shadow-[0_18px_60px_rgba(104,138,198,0.14)] flex flex-col overflow-hidden transition-[width,transform,opacity] duration-300 ease-in-out ${
          compact
            ? `fixed top-3 bottom-3 left-3 z-40 w-[85vw] max-w-[320px] shadow-2xl ${
                !collapsed ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
              }`
            : `m-3 shrink-0 h-[calc(100%-1.5rem)] ${
                !collapsed ? 'w-[280px] translate-x-0 opacity-100' : 'w-0 -translate-x-4 opacity-0 pointer-events-none'
              }`
        }`}
      >
        <div className="px-5 py-4.5 flex items-center justify-between border-b border-white/50 bg-white/30 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-blue-600 shrink-0 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2L11.5 5.5L15 7L11.5 8.5L10 12L8.5 8.5L5 7L8.5 5.5L10 2Z" fill="currentColor" className="fill-blue-600" />
              <path d="M19 11L19.8 13L21.8 13.8L19.8 14.6L19 16.6L18.2 14.6L16.2 13.8L18.2 13L19 11Z" fill="currentColor" className="fill-blue-500/80" />
              <path d="M6 16L6.5 17.3L7.8 17.8L6.5 18.3L6 19.6L5.5 18.3L4.2 17.8L5.5 17.3L6 16Z" fill="currentColor" className="fill-blue-400/60" />
            </svg>
            <p className="text-base font-bold text-gray-900 tracking-tight font-head">Alem AI</p>
          </div>
          {compact && (
            <button onClick={onClose} className="p-2 -mr-2 text-gray-500 hover:text-gray-700">
               <span className="sr-only">Close</span>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {showChatHistory && <div className="px-4 pt-4 pb-2">
          <div className="relative flex items-center bg-gray-100/70 border border-gray-200/30 rounded-2xl px-3.5 py-2.5 focus-within:bg-white focus-within:border-blue-500/30 focus-within:ring-4 focus-within:ring-blue-100/65 transition-all">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-gray-400 shrink-0 stroke-[2] stroke-current" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none pl-2 pr-1"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-sans font-medium text-gray-400 bg-white border border-gray-200/80 px-1.5 py-0.5 rounded shadow-[0_1px_1px_rgba(0,0,0,0.03)] shrink-0">
              <span>⌘</span><span>K</span>
            </kbd>
          </div>
        </div>}

        <div className="flex-1 overflow-y-auto hide-scrollbars flex flex-col">
          

          {showChatHistory && (
            <div className="px-4 py-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="text-[11px] font-bold text-gray-400/80 uppercase tracking-wider pl-1">История чатов</h3>
                <button
                  type="button"
                  onClick={onCreateConversation}
                  disabled={isCreatingConversation}
                  className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition-all active:scale-90 disabled:opacity-50"
                  title="Новый чат"
                >
                   <Icon.Plus />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbars -mx-2 px-2 space-y-0.5">
                {isConversationsLoading ? (
                  <p className="text-sm text-gray-500 px-2 py-2">Загрузка...</p>
                ) : filteredConversations.length === 0 && conversationsError ? (
                  <p className="text-sm text-red-500 px-2 py-2">{normalizeHistoryError(conversationsError)}</p>
                ) : filteredConversations.length === 0 ? (
                  <p className="text-sm text-gray-400 px-2 py-2">Диалогов пока нет</p>
                ) : (
                  <>
                    {detailError && (
                      <div className="mb-2 px-2 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-[11px] text-red-600 leading-tight">
                          {normalizeHistoryError(detailError)}
                        </p>
                      </div>
                    )}
                    {filteredConversations.map((conversation) => {
                      const isActive = selectedConversationId === conversation.conv_id
                      const stamp = formatConversationTimestamp(conversation.updated_at || conversation.last_message_at)

                      return (
                        <button
                          key={conversation.conv_id}
                          type="button"
                          onClick={() => onSelectConversation(conversation.conv_id)}
                          className={`w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200 group border ${
                            isActive
                              ? 'bg-white border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.035)]'
                              : 'bg-transparent border-transparent hover:bg-gray-100/60 active:scale-99'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 overflow-hidden">
                            <p className={`text-sm truncate ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {conversation.name || 'Новый чат'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-[11px] truncate text-gray-500 flex-1 pr-2">
                               {conversation.preview || conversation.last_message || 'Без сообщений'}
                            </p>
                            {stamp && <span className="text-[10px] text-gray-400 shrink-0">{stamp}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}

                {isConversationLoading && (
                  <div className="px-3 py-2">
                     <span className="inline-flex gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-75" />
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-150" />
                     </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        
      </aside>
    </>
  )
}
