import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Search, 
  Loader2, 
  ChevronRight
} from 'lucide-react'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import { authorizedFetch } from '../../../infrastructure/http/authorizedFetch'
import MessengerAvatar from './MessengerAvatar'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'

interface UnifiedChat {
  id: string
  type: 'personal' | 'group' | 'channel' | 'ai' | 'support'
  peer_full_name?: string
  peer_avatar?: string
  group_name?: string
  group_avatar?: string
  channel_name?: string
  channel_avatar?: string
  last_message?: unknown
}

interface ChatPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (chat: UnifiedChat) => void
  title?: string
}

export default function ChatPickerModal({ isOpen, onClose, onSelect, title = 'Поделиться в чат' }: ChatPickerModalProps) {
  const [chats, setChats] = useState<UnifiedChat[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'personal' | 'group'>('all')
  const session = useMemo(() => new LocalStorageAuthSessionStore(), [])

  const loadChats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await authorizedFetch(session, '/api/v1/chats/unified')
      const data = await response.json()
      setChats(data || [])
    } catch (err) {
      console.error('Failed to load chats', err)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (isOpen) {
      void loadChats()
    }
  }, [isOpen, loadChats])

  const filteredChats = chats.filter((chat) => {
    if (chat.type === 'channel') return false
    const name = (chat.peer_full_name || chat.group_name || chat.channel_name || '').toLowerCase()
    const matchesSearch = name.includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || chat.type === activeTab
    return matchesSearch && matchesTab
  })

  const getChatName = (chat: UnifiedChat) => chat.peer_full_name || chat.group_name || chat.channel_name || 'Чат'
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const getChatAvatarProps = (chat: UnifiedChat) => {
    const name = getChatName(chat)
    const initials = getInitials(name)
    const imageUrl = chat.peer_avatar || chat.group_avatar || chat.channel_avatar
    // Use the chat ID as a seed for consistent color
    const seed = chat.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    
    return { initials, imageUrl, seed }
  }

  const getChatSubtitle = (chat: UnifiedChat) => {
    switch (chat.type) {
      case 'personal': return 'Личный чат'
      case 'group': return 'Группа'
      case 'channel': return 'Канал'
      case 'ai': return 'AI Ассистент'
      default: return 'Чат'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
          style={{ fontFamily: '"Inter", "Roboto", sans-serif' }}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                <MS name="send" size={24} color={C.blue} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs and Search */}
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 space-y-4">
            <div className="flex p-1 bg-gray-100 rounded-2xl">
              {[
                { id: 'all', label: 'Все' },
                { id: 'personal', label: 'Личный чат' },
                { id: 'group', label: 'Группа' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'all' | 'personal' | 'group')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Поиск чатов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Загрузка чатов...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                  <MS name="search_off" size={32} />
                </div>
                <span className="text-sm">Чаты не найдены</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {filteredChats.map((chat) => {
                  const avatarProps = getChatAvatarProps(chat)
                  return (
                    <button
                      key={chat.id}
                      onClick={() => onSelect(chat)}
                      className="flex items-center gap-3.5 p-3 px-4 rounded-2xl hover:bg-blue-50/50 text-left transition-all group border border-transparent"
                    >
                      <MessengerAvatar 
                        {...avatarProps} 
                        size={44}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                          {getChatName(chat)}
                        </div>
                        <div className="text-[13px] text-gray-500 mt-0.5 truncate font-normal">
                          {getChatSubtitle(chat)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-all transform group-hover:translate-x-0.5" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              Выберите чат, чтобы отправить в него текущую заметку.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
