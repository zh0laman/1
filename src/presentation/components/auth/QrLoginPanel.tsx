import { useEffect, useMemo, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'
import type { QrLoginStatus } from '../../../domain/entities/QrPairing'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import logo from '../../../assets/logo.png'

interface QrLoginPanelProps {
  status: QrLoginStatus
  statusMessage: string
  qrValue: string
  error: string
  isBusy: boolean
  onStart?: () => void
}

const statusStyles: Partial<Record<QrLoginStatus, { dot: string; text: string }>> = {
  approved: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  synced: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  authenticated: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  expired: { dot: 'bg-amber-400', text: 'text-amber-600' },
  revoked: { dot: 'bg-red-500', text: 'text-red-600' },
  error: { dot: 'bg-red-500', text: 'text-red-600' },
}

export function QrLoginPanel({ status, statusMessage, qrValue, error, isBusy, onStart }: QrLoginPanelProps) {

  const qrHostRef = useRef<HTMLDivElement | null>(null)
  const qrCode = useMemo(
    () =>
      new QRCodeStyling({
        width: 304,
        height: 304,
        type: 'canvas',
        margin: 0,
        data: ' ',
        qrOptions: {
          typeNumber: 0,
          mode: 'Byte',
          errorCorrectionLevel: 'M',
        },
        dotsOptions: {
          type: 'rounded',
          color: '#020617',
        },
        cornersSquareOptions: {
          color: '#020617',
          type: 'rounded',
        },
        cornersDotOptions: {
          color: '#020617',
          type: 'rounded',
        },
        backgroundOptions: {
          color: '#FFFFFF',
        },
      }),
    [],
  )

  useEffect(() => {
    if (!qrHostRef.current) {
      return
    }

    // When QR tab switches from placeholder to real canvas, ensure renderer is attached.
    if (qrHostRef.current.childElementCount === 0) {
      qrHostRef.current.innerHTML = ''
      qrCode.append(qrHostRef.current)
    }

    qrCode.update({
      data: qrValue || ' ',
    })
  }, [qrCode, qrValue])

  const style = useMemo(() => statusStyles[status] ?? { dot: 'bg-gray-300', text: 'text-gray-500' }, [status])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
        <div className="relative rounded-[28px] border border-[#e5e7eb] bg-white p-2 shadow-[0_12px_30px_rgba(10,22,40,0.16)]">
          <div className="relative h-[304px] w-[304px] overflow-hidden rounded-[22px]">
            {qrValue && status !== 'creating_pairing' ? (
              <>
                <div ref={qrHostRef} className="h-[304px] w-[304px]" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-[22px] bg-white p-2.5 shadow-[0_6px_18px_rgba(10,22,40,0.16)]">
                    <img src={logo} alt="Alem logo" className="h-12 w-12 rounded-full object-cover" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-[304px] w-[304px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#d1d5db] bg-white gap-3">
                {isBusy ? (
                  <svg className="animate-spin h-8 w-8 text-[#1E88E5]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <MaterialSymbol name="qr_code" size={36} color="#d1d5db" />
                )}
              </div>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className={`flex items-center gap-2 ${style.text}`}>
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
            <span className="text-xs font-medium">{statusMessage}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-[#6b7280] text-center leading-relaxed">
        Откройте мобильное приложение, отсканируйте QR-код и подтвердите вход на телефоне.
      </p>

      {onStart && (status === 'idle' || status === 'expired' || status === 'error') && (
        <button
          type="button"
          onClick={onStart}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
        >
          {status === 'idle' ? 'Сгенерировать QR-код' : 'Обновить QR-код'}
        </button>
      )}

      {error && (

        <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <MaterialSymbol name="close" size={18} color="#ef4444" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
