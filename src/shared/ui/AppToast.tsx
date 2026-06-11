import { useEffect } from 'react'
import MaterialSymbol from './MaterialSymbol'

type AppToastVariant = 'success' | 'error' | 'info' | 'warning'

interface AppToastProps {
  message: string
  title?: string
  subtitle?: string
  variant?: AppToastVariant
  icon?: string
  onClose?: () => void
  autoCloseMs?: number
  floating?: boolean
}

const tone = {
  success: {
    wrapper: 'border-[#CFE9D7] bg-gradient-to-br from-[#F8FFFB] to-[#EFFAF3] text-[#0F7D4F]',
    iconWrap: 'bg-[#E5F7EC]',
    title: 'text-[#0A6D46]',
    subtitle: 'text-[#4D8C6C]',
    icon: 'check_circle',
    iconColor: '#0F7D4F',
    closeAfterMs: 2400,
  },
  error: {
    wrapper: 'border-[#F1C9C9] bg-gradient-to-br from-[#FFF9F9] to-[#FFF1F1] text-[#B32626]',
    iconWrap: 'bg-[#FDEBEC]',
    title: 'text-[#A61F1F]',
    subtitle: 'text-[#A95959]',
    icon: 'error',
    iconColor: '#B32626',
    closeAfterMs: 5200,
  },
  warning: {
    wrapper: 'border-[#F2DEBB] bg-gradient-to-br from-[#FFFDF8] to-[#FFF7EA] text-[#A56A12]',
    iconWrap: 'bg-[#FFF1D6]',
    title: 'text-[#915B0E]',
    subtitle: 'text-[#9D7A43]',
    icon: 'warning',
    iconColor: '#A56A12',
    closeAfterMs: 5600,
  },
  info: {
    wrapper: 'border-[#D6E8FE] bg-gradient-to-br from-[#FAFDFF] to-[#EEF5FF] text-[#1F6FD1]',
    iconWrap: 'bg-[#E8F1FF]',
    title: 'text-[#1261C2]',
    subtitle: 'text-[#5F7FA9]',
    icon: 'info',
    iconColor: '#1F6FD1',
    closeAfterMs: 3200,
  },
} as const

export default function AppToast({ message, title, subtitle, variant = 'info', icon, onClose, autoCloseMs, floating = true }: AppToastProps) {
  const styles = tone[variant]

  useEffect(() => {
    if (!onClose) return

    const timeout = window.setTimeout(() => {
      onClose()
    }, autoCloseMs ?? styles.closeAfterMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [autoCloseMs, onClose, styles.closeAfterMs])

  return (
    <div className={`${floating ? 'fixed right-4 top-16 z-[9999] w-[min(460px,calc(100vw-2rem))]' : 'w-full'} flex items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-[0_12px_28px_rgba(10,22,40,0.12)] backdrop-blur-sm ${styles.wrapper}`}>
      <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}>
        <MaterialSymbol name={icon || styles.icon} size={14} color={styles.iconColor} />
      </span>
      <div className="min-w-0 flex-1">
        {title ? (
          <p className={`break-words text-[15px] font-semibold leading-5 ${styles.title}`}>{title}</p>
        ) : null}
        <p className={`break-words whitespace-pre-wrap text-[13px] leading-5 ${title ? styles.subtitle : styles.title}`}>
          {subtitle || message}
        </p>
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label="Закрыть уведомление"
          onClick={onClose}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5"
        >
          <MaterialSymbol name="close" size={14} color="currentColor" />
        </button>
      ) : null}
    </div>
  )
}
