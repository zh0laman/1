import type {
  CreatePairingSessionInput,
  CreatePairingSessionResult,
  PairingStatusResult,
  RedeemPairingResult,
} from '../../domain/entities/QrPairing'

interface CreatePairingDto {
  web_device_id: string
  web_public_key: string
  ttl_seconds?: number
}

interface CreatePairingResponseDto {
  pairing_id: string
  session_token: string
  web_device_id: string
  status: string
  expires_at: string
  qr_payload: Record<string, unknown>
}

interface PairingStatusResponseDto {
  pairing_id: string
  web_device_id: string
  status: string
  approved: boolean
  synced: boolean
  redeemed: boolean
  expires_at: string
}

interface RedeemResponseDto {
  pairing_id: string
  web_device_id: string
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  expires_at: string
}

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

export class QrAuthApi {
  async getMe(accessToken?: string): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return fetch('/api/v1/auth/me', {
      method: 'GET',
      headers,
      credentials: 'include',
    })
  }

  async createPairingSession(input: CreatePairingSessionInput): Promise<CreatePairingSessionResult> {
    const payload: CreatePairingDto = {
      web_device_id: input.webDeviceId,
      web_public_key: input.webPublicKey,
      ttl_seconds: input.ttlSeconds ?? 90,
    }

    const response = await fetch('/api/v1/web/pairing/sessions', {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(await this.extractError(response, 'Failed to create QR session'))
    }

    const data = (await response.json()) as CreatePairingResponseDto
    return {
      pairingId: data.pairing_id,
      sessionToken: data.session_token,
      webDeviceId: data.web_device_id,
      status: data.status,
      expiresAt: data.expires_at,
      qrPayload: data.qr_payload,
    }
  }

  async getPairingSessionStatus(pairingId: string, sessionToken: string): Promise<PairingStatusResult> {
    const response = await this.fetchWithTimeout(
      `/api/v1/web/pairing/sessions/${pairingId}?session_token=${encodeURIComponent(sessionToken)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      },
      8000,
    )

    if (!response.ok) {
      throw new Error(await this.extractError(response, 'Failed to check QR status'))
    }

    const data = (await response.json()) as PairingStatusResponseDto
    return {
      pairingId: data.pairing_id,
      webDeviceId: data.web_device_id,
      status: data.status,
      approved: data.approved,
      synced: data.synced,
      redeemed: data.redeemed,
      expiresAt: data.expires_at,
    }
  }

  async redeemPairingSession(pairingId: string, sessionToken: string): Promise<RedeemPairingResult> {
    const response = await fetch(`/api/v1/web/pairing/sessions/${pairingId}/redeem`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify({ session_token: sessionToken }),
    })

    if (!response.ok) {
      throw new Error(await this.extractError(response, 'Failed to redeem QR session'))
    }

    const data = (await response.json()) as RedeemResponseDto

    return {
      pairingId: data.pairing_id,
      webDeviceId: data.web_device_id,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        expiresAt: data.expires_at,
      },
    }
  }

  private async extractError(response: Response, fallback: string): Promise<string> {
    try {
      const data = (await response.json()) as { error?: { message?: string } }
      return data.error?.message ?? fallback
    } catch {
      return fallback
    }
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('QR status request timed out')
      }

      throw error
    } finally {
      window.clearTimeout(timeoutId)
    }
  }
}
