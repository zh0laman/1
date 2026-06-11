import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import type { CallChatMessage } from '../../calls/types'

interface CallChatPanelProps {
  messages: CallChatMessage[]
  onSendMessage: (text: string, recipientId?: string, recipientName?: string) => void
  onClose: () => void
  participants: { identity: string; name: string }[]
  localIdentity: string
}

export default function CallChatPanel({
  messages,
  onSendMessage,
  onClose,
  participants,
  localIdentity,
}: CallChatPanelProps) {
  const [inputText, setInputText] = useState('')
  const [recipientId, setRecipientId] = useState<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    
    let recipientName = undefined
    if (recipientId) {
      recipientName = participants.find(p => p.identity === recipientId)?.name
    }

    onSendMessage(trimmed, recipientId, recipientName)
    setInputText('')
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div style={{
      width: 380,
      height: '100%',
      background: 'rgba(15, 18, 26, 0.94)',
      backdropFilter: 'blur(32px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1300,
      boxShadow: '-20px 0 50px rgba(0,0,0,0.3)'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>Чат в звонке</div>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Recipient Selector */}
      <div style={{ padding: '12px 20px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>Кому:</span>
        <select 
          value={recipientId || ''} 
          onChange={(e) => setRecipientId(e.target.value || undefined)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 13,
            padding: '4px 8px',
            borderRadius: 8,
            outline: 'none',
            flex: 1
          }}
        >
          <option value="">Всем</option>
          {participants.filter(p => p.identity !== localIdentity).map(p => (
            <option key={p.identity} value={p.identity}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
            Сообщений пока нет
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === localIdentity || msg.isLocal
            return (
              <div 
                key={msg.id} 
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                {!isMe && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', marginLeft: 4 }}>
                    {msg.senderName}
                  </div>
                )}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  background: isMe ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: isMe ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
                  position: 'relative'
                }}>
                  {msg.recipientId && (
                    <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 4, textTransform: 'uppercase', opacity: 0.7 }}>
                      {msg.recipientId === localIdentity ? 'Лично вам' : `Лично: ${msg.recipientName}`}
                    </div>
                  )}
                  {msg.text}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.3)', alignSelf: isMe ? 'flex-end' : 'flex-start', marginLeft: 4, marginRight: 4 }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '24px 20px 32px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.06)',
          padding: '6px 6px 6px 16px',
          borderRadius: 18,
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <input 
            type="text"
            placeholder="Напишите сообщение..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 14,
              outline: 'none',
              padding: '8px 0'
            }}
          />
          <button 
            onClick={handleSend}
            disabled={!inputText.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: inputText.trim() ? '#2563EB' : 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputText.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={18} fill={inputText.trim() ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </div>
  )
}
