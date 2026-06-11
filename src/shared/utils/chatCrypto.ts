import {
  assertX25519PublicKeyBytes,
  deriveX25519PublicKeyBytes,
  deriveX25519SharedSecretBytes,
  getRawX25519PrivateKeyBytes,
} from './e2eeDeviceCrypto'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const CONTENT_IV_BYTES = 12
const TAG_BYTES = 16
const PUBLIC_KEY_BYTES = 32
const HKDF_INFO_VARIANTS = ['', 'alem-chat-wrapped-message-key'] as const

interface CipherEnvelope {
  v: 1
  alg: 'aes-256-gcm'
  iv: string
  ciphertext: string
}

interface WrappedKeyEnvelope {
  v: 1
  alg: 'x25519-hkdf-aes256gcm'
  epk: string
  iv: string
  ciphertext: string
}

interface MessagePlaintextPayload {
  text: string
  type: string
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

const tryParseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

const normalizeBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4

  if (padding === 0) {
    return normalized
  }

  return normalized.padEnd(normalized.length + (4 - padding), '=')
}

const tryDecodeBase64 = (value: string): Uint8Array | null => {
  try {
    return base64ToBytes(normalizeBase64(value))
  } catch {
    return null
  }
}

const tryParseEnvelope = <T>(value: string): T | null => {
  const direct = tryParseJson<T>(value)

  if (direct) {
    return direct
  }

  try {
    const decoded = new TextDecoder().decode(base64ToBytes(normalizeBase64(value)))
    return tryParseJson<T>(decoded)
  } catch {
    return null
  }
}

const looksLikeCompactBase64 = (value: string): boolean => /^[A-Za-z0-9+/=_-]+$/.test(value) && !/\s/.test(value)

const tryParseV4ContentBlob = (value: string): { iv: Uint8Array; ciphertext: Uint8Array } | null => {
  if (!looksLikeCompactBase64(value)) {
    return null
  }

  const bytes = tryDecodeBase64(value)

  if (!bytes || bytes.length <= CONTENT_IV_BYTES + TAG_BYTES) {
    return null
  }

  return {
    iv: bytes.slice(0, CONTENT_IV_BYTES),
    ciphertext: bytes.slice(CONTENT_IV_BYTES),
  }
}

const tryParseV4WrappedKeyBlob = (value: string): { epk: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array } | null => {
  if (!looksLikeCompactBase64(value)) {
    return null
  }

  const bytes = tryDecodeBase64(value)

  if (!bytes || bytes.length <= PUBLIC_KEY_BYTES + CONTENT_IV_BYTES + TAG_BYTES) {
    return null
  }

  return {
    epk: bytes.slice(0, PUBLIC_KEY_BYTES),
    iv: bytes.slice(PUBLIC_KEY_BYTES, PUBLIC_KEY_BYTES + CONTENT_IV_BYTES),
    ciphertext: bytes.slice(PUBLIC_KEY_BYTES + CONTENT_IV_BYTES),
  }
}

const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const generateX25519EphemeralKeyPair = (): { privateKey: Uint8Array; publicKey: Uint8Array } => {
  const privateKey = randomBytes(PUBLIC_KEY_BYTES)
  return {
    privateKey,
    publicKey: deriveX25519PublicKeyBytes(privateKey),
  }
}

const deriveWrappingKey = async (privateKey: Uint8Array, publicKey: Uint8Array, info = ''): Promise<CryptoKey> => {
  const sharedBits = deriveX25519SharedSecretBytes(privateKey, publicKey)
  const sharedSecret = await crypto.subtle.importKey('raw', toArrayBuffer(sharedBits), 'HKDF', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      info: toArrayBuffer(encoder.encode(info)),
      salt: toArrayBuffer(new Uint8Array()),
    },
    sharedSecret,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const decryptWrappedMessageKey = async (
  privateKey: Uint8Array,
  ephemeralPublicKey: Uint8Array,
  wrapIv: Uint8Array,
  wrappedCiphertext: Uint8Array,
): Promise<Uint8Array> => {
  let lastError: unknown = null

  for (const info of HKDF_INFO_VARIANTS) {
    try {
      const wrappingKey = await deriveWrappingKey(privateKey, ephemeralPublicKey, info)
      const rawMessageKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(wrapIv) },
        wrappingKey,
        toArrayBuffer(wrappedCiphertext),
      )
      return new Uint8Array(rawMessageKey)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Wrapped key decrypt failed')
}

const importMessageKey = (messageKey: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', toArrayBuffer(messageKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

const sha256Base64 = async (value: string): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(encoder.encode(value)))
  return bytesToBase64(new Uint8Array(hash))
}

export const isEncryptedChatPayload = (value: string): boolean => {
  const parsed = tryParseEnvelope<Partial<CipherEnvelope>>(value)

  if (parsed?.alg === 'aes-256-gcm' && typeof parsed.iv === 'string' && typeof parsed.ciphertext === 'string') {
    return true
  }

  return tryParseV4ContentBlob(value) !== null
}

export const encryptChatContent = async (
  plaintext: string,
  recipientPublicKeys: Record<string, string>,
  messageType = 'text',
): Promise<{ content: string; contentHash: string; keys: Record<string, string> }> => {
  const messageKeyBytes = randomBytes(32)
  const messageKey = await importMessageKey(messageKeyBytes)
  const iv = randomBytes(12)
  const plaintextPayload = JSON.stringify({
    text: plaintext,
    type: messageType,
  } satisfies MessagePlaintextPayload)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      messageKey,
      toArrayBuffer(encoder.encode(plaintextPayload)),
    ),
  )

  const keysEntries = await Promise.all(
    Object.entries(recipientPublicKeys).map(async ([deviceId, publicKeyBase64]) => {
      const recipientPublicKey = assertX25519PublicKeyBytes(publicKeyBase64)
      const ephemeralKeyPair = generateX25519EphemeralKeyPair()
      const wrappingKey = await deriveWrappingKey(ephemeralKeyPair.privateKey, recipientPublicKey, '')
      const wrapIv = randomBytes(12)
      const wrappedKeyCiphertext = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: toArrayBuffer(wrapIv) },
          wrappingKey,
          toArrayBuffer(messageKeyBytes),
        ),
      )
      const wrappedBlob = new Uint8Array(ephemeralKeyPair.publicKey.length + wrapIv.length + wrappedKeyCiphertext.length)

      wrappedBlob.set(ephemeralKeyPair.publicKey, 0)
      wrappedBlob.set(wrapIv, ephemeralKeyPair.publicKey.length)
      wrappedBlob.set(wrappedKeyCiphertext, ephemeralKeyPair.publicKey.length + wrapIv.length)

      return [deviceId, bytesToBase64(wrappedBlob)] as const
    }),
  )
  const contentBlob = new Uint8Array(iv.length + ciphertext.length)
  contentBlob.set(iv, 0)
  contentBlob.set(ciphertext, iv.length)

  return {
    content: bytesToBase64(contentBlob),
    contentHash: await sha256Base64(plaintextPayload),
    keys: Object.fromEntries(keysEntries),
  }
}

export const decryptChatContent = async (
  ciphertextPayload: string,
  wrappedKeyPayload: string,
  privateKeyBase64: string,
): Promise<string> => {
  const contentEnvelope = tryParseEnvelope<CipherEnvelope>(ciphertextPayload)
  const wrappedEnvelope = tryParseEnvelope<WrappedKeyEnvelope>(wrappedKeyPayload)

  const privateKey = getRawX25519PrivateKeyBytes(privateKeyBase64)
  let rawMessageKey: Uint8Array
  let plaintext: ArrayBuffer

  if (contentEnvelope && wrappedEnvelope) {
    if (contentEnvelope.alg !== 'aes-256-gcm' || wrappedEnvelope.alg !== 'x25519-hkdf-aes256gcm') {
      throw new Error('Unsupported encryption format')
    }

    const ephemeralPublicKey = assertX25519PublicKeyBytes(wrappedEnvelope.epk)
    try {
      rawMessageKey = await decryptWrappedMessageKey(
        privateKey,
        ephemeralPublicKey,
        base64ToBytes(wrappedEnvelope.iv),
        base64ToBytes(wrappedEnvelope.ciphertext),
      )
    } catch (error) {
      throw new Error(`Wrapped key decrypt failed${error instanceof Error && error.message ? `: ${error.message}` : ''}`)
    }

    const messageKey = await importMessageKey(rawMessageKey)

    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(contentEnvelope.iv)) },
        messageKey,
        toArrayBuffer(base64ToBytes(contentEnvelope.ciphertext)),
      )
    } catch (error) {
      throw new Error(`Content decrypt failed${error instanceof Error && error.message ? `: ${error.message}` : ''}`)
    }
  } else {
    const contentBlob = tryParseV4ContentBlob(ciphertextPayload)
    const wrappedBlob = tryParseV4WrappedKeyBlob(wrappedKeyPayload)

    if (!contentBlob || !wrappedBlob) {
      throw new Error('Invalid encryption envelope')
    }

    try {
      rawMessageKey = await decryptWrappedMessageKey(privateKey, wrappedBlob.epk, wrappedBlob.iv, wrappedBlob.ciphertext)
    } catch (error) {
      throw new Error(`Wrapped key decrypt failed${error instanceof Error && error.message ? `: ${error.message}` : ''}`)
    }

    const messageKey = await importMessageKey(rawMessageKey)

    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(contentBlob.iv) },
        messageKey,
        toArrayBuffer(contentBlob.ciphertext),
      )
    } catch (error) {
      throw new Error(`Content decrypt failed${error instanceof Error && error.message ? `: ${error.message}` : ''}`)
    }
  }

  const decoded = decoder.decode(plaintext)
  const messagePayload = tryParseJson<Partial<MessagePlaintextPayload>>(decoded)

  if (messagePayload && typeof messagePayload.text === 'string') {
    return messagePayload.text
  }

  return decoded
}

export const decryptChatContentWithAnyWrappedKey = async (
  ciphertextPayload: string,
  wrappedKeys: Record<string, string>,
  privateKeyBase64: string,
  preferredDeviceId?: string | null,
): Promise<{ plaintext: string; matchedDeviceId: string }> => {
  const candidateEntries = Object.entries(wrappedKeys)

  if (candidateEntries.length === 0) {
    throw new Error('No wrapped keys available for this message')
  }

  const orderedCandidates =
    preferredDeviceId && wrappedKeys[preferredDeviceId]
      ? ([
          [preferredDeviceId, wrappedKeys[preferredDeviceId]],
          ...candidateEntries.filter(([deviceId]) => deviceId !== preferredDeviceId),
        ] as Array<[string, string]>)
      : candidateEntries

  let lastError: unknown = null

  for (const [deviceId, wrappedKeyPayload] of orderedCandidates) {
    try {
      const plaintext = await decryptChatContent(ciphertextPayload, wrappedKeyPayload, privateKeyBase64)
      return { plaintext, matchedDeviceId: deviceId }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No wrapped key matched the current private key')
}
