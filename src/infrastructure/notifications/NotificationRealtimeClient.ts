import { WebDeviceSessionStore } from '../storage/WebDeviceSessionStore'

type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

type WsEventListener = (event: Record<string, unknown>) => void
type WsStatusListener = (status: WsStatus) => void

interface NotificationRealtimeClientOptions {
  maxReconnectAttempts?: number
  baseReconnectDelayMs?: number
  connectTimeoutMs?: number
}

interface WsStrategy {
  url: string
  protocols?: string | string[]
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5
const DEFAULT_BASE_RECONNECT_DELAY_MS = 1000
const DEFAULT_CONNECT_TIMEOUT_MS = 7000
const webDeviceSessionStore = new WebDeviceSessionStore()

const toWsBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'ws://localhost/api/v1/ws'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/ws`
}

export class NotificationRealtimeClient {
  private readonly maxReconnectAttempts: number
  private readonly baseReconnectDelayMs: number
  private readonly connectTimeoutMs: number

  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private stoppedManually = false
  private status: WsStatus = 'idle'
  private readonly eventListeners = new Set<WsEventListener>()
  private readonly statusListeners = new Set<WsStatusListener>()

  constructor(options: NotificationRealtimeClientOptions = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? DEFAULT_BASE_RECONNECT_DELAY_MS
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
  }

  connect(): void {
    this.stoppedManually = false
    void this.openSocketWithFallbackStrategies()
  }

  disconnect(): void {
    this.stoppedManually = true
    this.reconnectAttempts = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.onopen = null
      this.socket.onmessage = null
      this.socket.onerror = null
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
    this.setStatus('closed')
  }

  subscribe(listener: WsEventListener): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  subscribeStatus(listener: WsStatusListener): () => void {
    this.statusListeners.add(listener)
    listener(this.status)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private async openSocketWithFallbackStrategies(): Promise<void> {
    if (this.stoppedManually) {
      return
    }

    this.setStatus('connecting')
    const baseUrl = toWsBaseUrl()
    const strategies = this.buildStrategies(baseUrl)
    let connectedSocket: WebSocket | null = null

    for (const strategy of strategies) {
      try {
        connectedSocket = await this.openSocket(strategy)
        break
      } catch {
        connectedSocket = null
      }
    }

    if (!connectedSocket) {
      this.handleConnectionFailure()
      return
    }

    this.socket = connectedSocket
    this.reconnectAttempts = 0
    this.setStatus('open')

    connectedSocket.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as Record<string, unknown>
        this.eventListeners.forEach((listener) => listener(parsed))
      } catch {
        // ignore malformed payloads
      }
    }

    connectedSocket.onerror = () => {
      this.setStatus('error')
    }

    connectedSocket.onclose = () => {
      this.socket = null
      if (this.stoppedManually) {
        this.setStatus('closed')
        return
      }
      this.scheduleReconnect()
    }
  }

  private buildStrategies(baseUrl: string): WsStrategy[] {
    const strategies: WsStrategy[] = []
    const webDeviceId = webDeviceSessionStore.getCurrentDeviceId()
    const appendParams = (value: string): string => {
      if (!webDeviceId) {
        return value
      }

      const separator = value.includes('?') ? '&' : '?'
      return `${value}${separator}web_device_id=${encodeURIComponent(webDeviceId)}`
    }

    strategies.push({ url: appendParams(baseUrl) })
    return strategies
  }

  private openSocket(strategy: WsStrategy): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      let settled = false
      const socket = strategy.protocols ? new WebSocket(strategy.url, strategy.protocols) : new WebSocket(strategy.url)
      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        socket.close()
        reject(new Error('Notification websocket connect timeout'))
      }, this.connectTimeoutMs)

      socket.onopen = () => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(socket)
      }

      const fail = () => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        try {
          socket.close()
        } catch {
          // ignore close errors
        }
        reject(new Error('Notification websocket handshake failed'))
      }

      socket.onerror = fail
      socket.onclose = fail
    })
  }

  private handleConnectionFailure(): void {
    if (this.stoppedManually) {
      return
    }
    this.setStatus('error')
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.stoppedManually) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error')
      return
    }

    this.reconnectAttempts += 1
    const exponent = Math.max(0, this.reconnectAttempts - 1)
    const baseDelay = Math.min(this.baseReconnectDelayMs * 2 ** exponent, 20000)
    const jitter = Math.round(baseDelay * (0.2 + Math.random() * 0.4))
    const delay = baseDelay + jitter

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.openSocketWithFallbackStrategies()
    }, delay)
  }

  private setStatus(status: WsStatus): void {
    this.status = status
    this.statusListeners.forEach((listener) => listener(status))
  }
}

export type { WsStatus }
