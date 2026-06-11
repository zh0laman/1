import type { AuthTokens } from './AuthTokens'

export type QrLoginStatus =
  | 'idle'
  | 'creating_pairing'
  | 'qr_ready'
  | 'waiting_for_mobile'
  | 'approved'
  | 'synced'
  | 'redeeming'
  | 'authenticated'
  | 'expired'
  | 'revoked'
  | 'error'

export interface CreatePairingSessionInput {
  webDeviceId: string
  webPublicKey: string
  ttlSeconds?: number
}

export interface CreatePairingSessionResult {
  pairingId: string
  sessionToken: string
  webDeviceId: string
  status: string
  expiresAt: string
  qrPayload: Record<string, unknown>
}

export interface PairingStatusResult {
  pairingId: string
  webDeviceId: string
  status: string
  approved: boolean
  synced: boolean
  redeemed: boolean
  expiresAt: string
}

export interface RedeemPairingResult {
  pairingId: string
  webDeviceId: string
  tokens: AuthTokens
}
