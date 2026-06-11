import { useState } from 'react'


import type { ChatMessage } from '../types'
import { Icon } from './Icons'

interface MessageBubbleProps {
  msg: ChatMessage
}

const shouldHideDisplayUrl = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false

  return normalized === 'https://alem-workspace.gov.kz/v1/chats' || normalized.startsWith('https://alem-workspace.gov.kz/v1/chats/')
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  const sourceCount = msg.meta?.sources?.length ?? 0

  const routeLabel = (() => {
    const route = (msg.meta?.route || '').trim().toLowerCase()
    if (!route) return ''
    if (route.includes('web')) return 'Веб'
    if (route.includes('attach')) return 'Файл'
    if (route.includes('adapt')) return 'Авто'
    if (route.includes('ask')) return 'База'
    return route
  })()

  const handleCopy = () => {
    navigator.clipboard?.writeText(msg.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const renderInline = (line: string) => {
    const chunks = line.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g)

    return chunks.map((chunk, index) => {
      if (!chunk) {
        return null
      }

      if (shouldHideDisplayUrl(chunk)) {
        return null
      }

      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return <strong key={index} className="font-semibold">{chunk.slice(2, -2)}</strong>
      }

      if (/^https?:\/\/[^\s]+$/.test(chunk)) {
        return (
          <a
            key={index}
            href={chunk}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
          >
            {chunk}
          </a>
        )
      }

      return <span key={index}>{chunk}</span>
    })
  }

  const renderText = (text: string) =>
    text.split('\n').map((line, i) => {
      const trimmed = line.trim()

      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return (
          <p key={i} className="font-semibold text-gray-900 mt-3 mb-1 first:mt-0">
            {trimmed.slice(2, -2)}
          </p>
        )
      }

      if (/^[—\-•]\s+/.test(trimmed)) {
        return (
          <p key={i} className="ml-4 pl-1 border-l-2 border-gray-200 text-[15px] my-1">
            {renderInline(line)}
          </p>
        )
      }

      if (trimmed === '') {
        return <div key={i} className="h-3 leading-none" />
      }

      return <p key={i} className="text-[15px] leading-relaxed my-1.5 first:mt-0 last:mb-0">{renderInline(line)}</p>
    })

  if (isUser) {
    return (
      <div className="flex justify-end mb-6 group">
        <div className="max-w-[75%] sm:max-w-[70%]">
          <div
            style={{
              backgroundImage: 'linear-gradient(to top right, var(--accent-grad-end, #1d72e7), var(--accent-grad-start, #3b82f6))',
              boxShadow: '0 4px 16px var(--accent-shadow, rgba(29,114,231,0.12))',
            }}
            className="px-5 py-3.5 rounded-[24px] rounded-tr-[4px] text-white text-[15px] leading-relaxed"
          >
            {msg.text}
          </div>
          {msg.time && <p className="text-[11px] text-gray-400 text-right mt-1.5 pr-1">{msg.time}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 sm:gap-4 mb-6 group">
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

      <div className="flex-1 min-w-0">
        <div className="px-5 py-4 rounded-[24px] rounded-tl-[4px] bg-white/85 backdrop-blur-sm border border-slate-100/80 text-gray-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] max-w-[90%] sm:max-w-[85%]">
          <div className="[word-wrap:break-word]">{renderText(msg.text)}</div>
          {(routeLabel || sourceCount > 0 || msg.meta?.noLiveSources) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {routeLabel && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Маршрут: {routeLabel}
                </span>
              )}
              {sourceCount > 0 && (
                <span
                  style={{
                    borderColor: 'var(--accent-soft, rgba(29,114,231,0.18))',
                    backgroundColor: 'var(--messages-accent-surface, rgba(29,114,231,0.06))',
                    color: 'var(--teal-dark, #155eef)',
                  }}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                >
                  Источники: {sourceCount}
                </span>
              )}
              {msg.meta?.noLiveSources && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  Веб-источники не найдены
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-2 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {msg.time && <p className="text-[11px] text-gray-400 mr-2">{msg.time}</p>}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors text-xs font-medium"
            onMouseEnter={(event) => {
              event.currentTarget.style.color = 'var(--teal, #1d72e7)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = ''
            }}
          >
            <Icon.Copy />
            <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
