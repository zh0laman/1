import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthTokens } from '../../domain/entities/AuthTokens'
import type { QrLoginStatus } from '../../domain/entities/QrPairing'
import { QrAuthApi } from '../../infrastructure/auth/qrAuthApi'
import { IndexedDbKeyStore } from '../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../infrastructure/storage/WebDeviceSessionStore'
import {
  deriveX25519PublicKeyBase64,
  generateX25519DeviceKeyMaterial,
} from '../../shared/utils/e2eeDeviceCrypto'

interface UseQrLoginOptions {
  onAuthenticated: (tokens: AuthTokens) => Promise<void>
}

interface UseQrLoginResult {
  status: QrLoginStatus
  statusMessage: string
  qrValue: string
  error: string
  isBusy: boolean
  startQrLogin: () => Promise<void>
  resetQrLogin: () => void
}

const pollingIntervalMs = 2500

const statusMessageMap: Record<QrLoginStatus, string> = {
  idle: 'Нажмите, чтобы сгенерировать QR',
  creating_pairing: 'Создаем QR-сессию...',
  qr_ready: 'QR готов',
  waiting_for_mobile: 'Ожидаем подтверждения на телефоне',
  approved: 'Устройство подтверждено, ожидаем синхронизацию истории...',
  synced: 'Синхронизация завершена, завершаем вход...',
  redeeming: 'Выполняем вход...',
  authenticated: 'Вход выполнен',
  expired: 'QR истек. Обновляем...',
  revoked: 'Вход отклонен на телефоне.',
  error: 'Ошибка, попробуйте снова',
}

export const useQrLogin = ({ onAuthenticated }: UseQrLoginOptions): UseQrLoginResult => {
  const api = useMemo(() => new QrAuthApi(), [])
  const keyStore = useMemo(() => new IndexedDbKeyStore(), [])
  const deviceSessionStore = useMemo(() => new WebDeviceSessionStore(), [])

  const [status, setStatus] = useState<QrLoginStatus>('idle')
  const [qrValue, setQrValue] = useState('')
  const [error, setError] = useState('')

  const pollingRef = useRef<number | null>(null)
  const pairingIdRef = useRef<string>('')
  const sessionTokenRef = useRef<string>('')
  const webDeviceIdRef = useRef<string>('')
  const redeemInProgressRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const resetRuntime = useCallback(() => {
    stopPolling()
    pairingIdRef.current = ''
    sessionTokenRef.current = ''
    webDeviceIdRef.current = ''
    redeemInProgressRef.current = false
  }, [stopPolling])

  const resetQrLogin = useCallback(() => {
    resetRuntime()
    setQrValue('')
    setError('')
    setStatus('idle')
  }, [resetRuntime])

  const redeem = useCallback(async () => {
    if (redeemInProgressRef.current || !pairingIdRef.current || !sessionTokenRef.current) {
      return
    }

    redeemInProgressRef.current = true
    setStatus('redeeming')

    try {
      const redeemed = await api.redeemPairingSession(pairingIdRef.current, sessionTokenRef.current)
      const meResponse = await api.getMe(redeemed.tokens.accessToken)

      if (!meResponse.ok) {
        throw new Error('Не удалось подтвердить сессию пользователя')
      }
      const me = (await meResponse.json()) as { id: number; full_name?: string }

      const resolvedDeviceId = redeemed.webDeviceId || webDeviceIdRef.current
      if (resolvedDeviceId) {
        deviceSessionStore.setCurrentDeviceId(resolvedDeviceId)

        // Migrate keys to scoped storage for multi-user consistency
        const keyMaterial = await keyStore.getDeviceKeyMaterial(resolvedDeviceId)
        if (keyMaterial?.privateKey) {
          const scopedKey = IndexedDbKeyStore.buildScopedStorageKey(
            me.id,
            resolvedDeviceId,
          )
          await keyStore.saveDeviceKeyMaterial(
            scopedKey,
            keyMaterial.privateKey,
            keyMaterial.publicKey ?? undefined,
          )
        }
      }

      stopPolling()
      await onAuthenticated(redeemed.tokens)
      setStatus('authenticated')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Не удалось завершить вход')
    } finally {
      redeemInProgressRef.current = false
    }
  }, [api, deviceSessionStore, onAuthenticated, stopPolling])

  const pollOnce = useCallback(async () => {
    if (!pairingIdRef.current || !sessionTokenRef.current) {
      return
    }

    try {
      const statusResult = await api.getPairingSessionStatus(pairingIdRef.current, sessionTokenRef.current)

      switch (statusResult.status) {
        case 'pending':
          setStatus('waiting_for_mobile')
          break
        case 'approved':
          setStatus('approved')
          break
        case 'synced':
          setStatus('synced')
          await redeem()
          break
        case 'redeemed':
          setStatus('authenticated')
          stopPolling()
          break
        case 'expired':
          setStatus('expired')
          stopPolling()
          break
        case 'revoked':
          setStatus('revoked')
          stopPolling()
          break
        default:
          setStatus('waiting_for_mobile')
          break
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Не удалось проверить статус QR')
      stopPolling()
    }
  }, [api, redeem, stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    pollingRef.current = window.setInterval(() => {
      void pollOnce()
    }, pollingIntervalMs)
  }, [pollOnce, stopPolling])

  const resolveCurrentDeviceKeys = useCallback(async (): Promise<{
    webDeviceId: string
    webPublicKey: string
    webPrivateKey: string
  }> => {
    const webDeviceId = deviceSessionStore.getOrCreateCurrentDeviceId()
    const stored = await keyStore.getDeviceKeyMaterial(webDeviceId)

    if (stored?.privateKey) {
      const webPublicKey = stored.publicKey ?? (await deriveX25519PublicKeyBase64(stored.privateKey))
      await keyStore.saveDeviceKeyMaterial(webDeviceId, stored.privateKey, webPublicKey)

      return {
        webDeviceId,
        webPrivateKey: stored.privateKey,
        webPublicKey,
      }
    }

    const generated = await generateX25519DeviceKeyMaterial(webDeviceId)
    await keyStore.saveDeviceKeyMaterial(generated.deviceId, generated.privateKey, generated.publicKey)

    return {
      webDeviceId: generated.deviceId,
      webPrivateKey: generated.privateKey,
      webPublicKey: generated.publicKey,
    }
  }, [deviceSessionStore, keyStore])

  const startQrLogin = useCallback(async () => {
    setError('')

    resetRuntime()
    setQrValue('')
    setStatus('creating_pairing')

    try {
      const keyMaterial = await resolveCurrentDeviceKeys()
      webDeviceIdRef.current = keyMaterial.webDeviceId

      const pairing = await api.createPairingSession({
        webDeviceId: keyMaterial.webDeviceId,
        webPublicKey: keyMaterial.webPublicKey,
        ttlSeconds: 90,
      })

      pairingIdRef.current = pairing.pairingId
      sessionTokenRef.current = pairing.sessionToken

      setQrValue(JSON.stringify(pairing.qrPayload))
      setStatus('qr_ready')

      startPolling()
      void pollOnce()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Не удалось создать QR-сессию')
    }
  }, [api, pollOnce, resetRuntime, resolveCurrentDeviceKeys, startPolling])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    status,
    statusMessage: statusMessageMap[status],
    qrValue,
    error,
    isBusy: status === 'creating_pairing' || status === 'redeeming',
    startQrLogin,
    resetQrLogin,
  }
}
