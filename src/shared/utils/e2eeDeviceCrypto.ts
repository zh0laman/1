const encoder = new TextEncoder()
const decoder = new TextDecoder()
const X25519_ALGORITHM = { name: 'X25519' } as const
const X25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
])
const X25519_PUBLIC_KEY_BYTES = 32
const X25519_PRIVATE_KEY_BYTES = 32
const X25519_BASE_POINT = Uint8Array.from([
  9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
])
const X25519_FIELD_PRIME = (1n << 255n) - 19n

const createWebCryptoUnavailableError = (): Error => {
  const secureContextHint =
    typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext
      ? ' Open the app over HTTPS (or localhost) and try again.'
      : ' Open the app in a modern browser and try again.'

  return new Error(`This browser cannot use Web Crypto for E2EE device keys.${secureContextHint}`)
}

const ensureCryptoApi = (): Crypto => {
  const cryptoApi = globalThis.crypto

  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw createWebCryptoUnavailableError()
  }

  return cryptoApi
}

const ensureSubtleCrypto = (): SubtleCrypto => ensureCryptoApi().subtle

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  ensureCryptoApi().getRandomValues(bytes)
  return bytes
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
}

export const normalizeBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4

  if (padding === 0) {
    return normalized
  }

  return normalized.padEnd(normalized.length + (4 - padding), '=')
}

export const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(normalizeBase64(value))
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) {
    return false
  }

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

const mod = (value: bigint): bigint => {
  const result = value % X25519_FIELD_PRIME
  return result >= 0n ? result : result + X25519_FIELD_PRIME
}

const powMod = (base: bigint, exponent: bigint): bigint => {
  let result = 1n
  let currentBase = mod(base)
  let currentExponent = exponent

  while (currentExponent > 0n) {
    if ((currentExponent & 1n) === 1n) {
      result = mod(result * currentBase)
    }

    currentBase = mod(currentBase * currentBase)
    currentExponent >>= 1n
  }

  return result
}

const decodeLittleEndian = (bytes: Uint8Array): bigint => {
  let value = 0n

  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = (value << 8n) + BigInt(bytes[index])
  }

  return value
}

const encodeLittleEndian = (value: bigint, length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  let current = value

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Number(current & 0xffn)
    current >>= 8n
  }

  return bytes
}

export const getRawX25519PrivateKeyBytes = (privateKeyBase64: string): Uint8Array => {
  const privateKeyBytes = base64ToBytes(privateKeyBase64)

  if (privateKeyBytes.byteLength === X25519_PRIVATE_KEY_BYTES) {
    return privateKeyBytes
  }

  if (
    privateKeyBytes.byteLength === X25519_PKCS8_PREFIX.byteLength + X25519_PRIVATE_KEY_BYTES &&
    bytesEqual(privateKeyBytes.slice(0, X25519_PKCS8_PREFIX.byteLength), X25519_PKCS8_PREFIX)
  ) {
    return privateKeyBytes.slice(X25519_PKCS8_PREFIX.byteLength)
  }

  throw new Error('Unsupported X25519 private key format.')
}

export const assertX25519PublicKeyBytes = (publicKeyBase64: string): Uint8Array => {
  const publicKeyBytes = base64ToBytes(publicKeyBase64)

  if (publicKeyBytes.byteLength !== X25519_PUBLIC_KEY_BYTES) {
    throw new Error(`Expected 32-byte X25519 public key, got ${publicKeyBytes.byteLength} bytes.`)
  }

  return publicKeyBytes
}

export const deriveX25519SharedSecretBytes = (privateKeyBytes: Uint8Array, publicKeyBytes: Uint8Array): Uint8Array => {
  if (privateKeyBytes.byteLength !== X25519_PRIVATE_KEY_BYTES) {
    throw new Error(`Expected 32-byte X25519 private key, got ${privateKeyBytes.byteLength} bytes.`)
  }

  if (publicKeyBytes.byteLength !== X25519_PUBLIC_KEY_BYTES) {
    throw new Error(`Expected 32-byte X25519 public key, got ${publicKeyBytes.byteLength} bytes.`)
  }

  const scalar = Uint8Array.from(privateKeyBytes)
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64

  const uBytes = Uint8Array.from(publicKeyBytes)
  uBytes[31] &= 127

  const k = decodeLittleEndian(scalar)
  const x1 = decodeLittleEndian(uBytes)
  let x2 = 1n
  let z2 = 0n
  let x3 = x1
  let z3 = 1n
  let swap = 0

  for (let bitIndex = 254; bitIndex >= 0; bitIndex -= 1) {
    const bit = Number((k >> BigInt(bitIndex)) & 1n)
    swap ^= bit

    if (swap === 1) {
      const previousX2 = x2
      const previousZ2 = z2
      x2 = x3
      z2 = z3
      x3 = previousX2
      z3 = previousZ2
    }

    swap = bit

    const a = mod(x2 + z2)
    const aa = mod(a * a)
    const b = mod(x2 - z2)
    const bb = mod(b * b)
    const e = mod(aa - bb)
    const c = mod(x3 + z3)
    const d = mod(x3 - z3)
    const da = mod(d * a)
    const cb = mod(c * b)
    const daPlusCb = mod(da + cb)
    const daMinusCb = mod(da - cb)

    x3 = mod(daPlusCb * daPlusCb)
    z3 = mod(x1 * daMinusCb * daMinusCb)
    x2 = mod(aa * bb)
    z2 = mod(e * (aa + 121665n * e))
  }

  if (swap === 1) {
    const previousX2 = x2
    const previousZ2 = z2
    x2 = x3
    z2 = z3
    x3 = previousX2
    z3 = previousZ2
  }

  return encodeLittleEndian(mod(x2 * powMod(z2, X25519_FIELD_PRIME - 2n)), X25519_PUBLIC_KEY_BYTES)
}

export const deriveX25519PublicKeyBytes = (privateKeyBytes: Uint8Array): Uint8Array =>
  deriveX25519SharedSecretBytes(privateKeyBytes, X25519_BASE_POINT)

export const generateStableWebDeviceId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const exportPublicKeyRawBase64 = async (publicKey: CryptoKey): Promise<string> => {
  const subtle = ensureSubtleCrypto() as SubtleCrypto & {
    exportKey: (format: string, key: CryptoKey) => Promise<ArrayBuffer>
  }

  try {
    const raw = await subtle.exportKey('raw', publicKey)
    return bytesToBase64(new Uint8Array(raw))
  } catch {
    const raw = await subtle.exportKey('raw-public', publicKey)
    return bytesToBase64(new Uint8Array(raw))
  }
}

const derivePublicKeyFromPrivateKey = async (privateKey: CryptoKey): Promise<CryptoKey> => {
  const subtle = ensureSubtleCrypto() as SubtleCrypto & {
    getPublicKey?: (key: CryptoKey, keyUsages: KeyUsage[]) => Promise<CryptoKey>
  }

  if (typeof subtle.getPublicKey === 'function') {
    return subtle.getPublicKey(privateKey, [])
  }

  const jwk = await subtle.exportKey('jwk', privateKey)
  if (typeof jwk.x === 'string') {
    const subtle = ensureSubtleCrypto() as SubtleCrypto & {
      importKey: (
        format: string,
        keyData: JsonWebKey,
        algorithm: AlgorithmIdentifier,
        extractable: boolean,
        keyUsages: KeyUsage[],
      ) => Promise<CryptoKey>
    }

    return subtle.importKey(
      'jwk',
      {
        kty: 'OKP',
        crv: 'X25519',
        x: jwk.x,
        ext: true,
        key_ops: [],
      },
      X25519_ALGORITHM,
      true,
      [],
    )
  }

  throw new Error('Unable to derive a public key from the restored X25519 private key.')
}

export const importX25519PrivateKeyFlexible = async (
  privateKeyBase64: string,
  options?: { extractable?: boolean },
): Promise<CryptoKey> => {
  const privateKeyBytes = base64ToBytes(privateKeyBase64)
  const extractable = options?.extractable ?? false
  const subtle = ensureSubtleCrypto() as SubtleCrypto & {
    importKey: (
      format: string,
      keyData: BufferSource | JsonWebKey,
      algorithm: AlgorithmIdentifier,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ) => Promise<CryptoKey>
  }
  const attempts = [
    () =>
      subtle.importKey(
        'pkcs8',
        toArrayBuffer(privateKeyBytes),
        X25519_ALGORITHM,
        extractable,
        ['deriveBits'],
      ),
    () =>
      subtle.importKey(
        'raw-private',
        toArrayBuffer(privateKeyBytes),
        X25519_ALGORITHM,
        extractable,
        ['deriveBits'],
      ),
  ]

  let lastError: unknown = null

  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unsupported X25519 private key format.')
}

export const deriveX25519PublicKeyBase64 = async (privateKeyBase64: string): Promise<string> => {
  try {
    const privateKey = await importX25519PrivateKeyFlexible(privateKeyBase64, { extractable: true })
    const publicKey = await derivePublicKeyFromPrivateKey(privateKey)
    return exportPublicKeyRawBase64(publicKey)
  } catch {
    return bytesToBase64(deriveX25519PublicKeyBytes(getRawX25519PrivateKeyBytes(privateKeyBase64)))
  }
}

export const canImportX25519PrivateKey = async (privateKeyBase64: string): Promise<boolean> => {
  try {
    getRawX25519PrivateKeyBytes(privateKeyBase64)
    return true
  } catch {
    try {
      await importX25519PrivateKeyFlexible(privateKeyBase64)
      return true
    } catch {
      return false
    }
  }
}

export const normalizePrivateKeyPlaintextToBase64 = async (privateKeyPlaintext: Uint8Array): Promise<string> => {
  const directBytesBase64 = bytesToBase64(privateKeyPlaintext)
  if (await canImportX25519PrivateKey(directBytesBase64)) {
    return directBytesBase64
  }

  const maybeBase64 = decoder.decode(privateKeyPlaintext).trim()
  if (maybeBase64 && (await canImportX25519PrivateKey(maybeBase64))) {
    return normalizeBase64(maybeBase64)
  }

  throw new Error('Unsupported decrypted private key format.')
}

export const rawX25519PrivateKeyToPkcs8Base64 = (rawPrivateKey: Uint8Array): string => {
  if (rawPrivateKey.byteLength !== 32) {
    throw new Error(`Expected 32-byte X25519 private key, got ${rawPrivateKey.byteLength} bytes.`)
  }

  const pkcs8Bytes = new Uint8Array(X25519_PKCS8_PREFIX.length + rawPrivateKey.length)
  pkcs8Bytes.set(X25519_PKCS8_PREFIX, 0)
  pkcs8Bytes.set(rawPrivateKey, X25519_PKCS8_PREFIX.length)
  return bytesToBase64(pkcs8Bytes)
}

export const generateX25519DeviceKeyMaterial = async (
  deviceId = generateStableWebDeviceId(),
): Promise<{ deviceId: string; publicKey: string; privateKey: string }> => {
  const subtle = ensureSubtleCrypto()

  try {
    const keyPair = (await subtle.generateKey(
      X25519_ALGORITHM,
      true,
      ['deriveBits'],
    )) as CryptoKeyPair

    return {
      deviceId,
      publicKey: await exportPublicKeyRawBase64(keyPair.publicKey),
      privateKey: bytesToBase64(new Uint8Array(await subtle.exportKey('pkcs8', keyPair.privateKey))),
    }
  } catch {
    const rawPrivateKey = randomBytes(X25519_PRIVATE_KEY_BYTES)

    return {
      deviceId,
      publicKey: bytesToBase64(deriveX25519PublicKeyBytes(rawPrivateKey)),
      privateKey: rawX25519PrivateKeyToPkcs8Base64(rawPrivateKey),
    }
  }
}

const detectBrowserName = (userAgent: string): string => {
  if (userAgent.includes('Edg/')) return 'Edge'
  if (userAgent.includes('OPR/')) return 'Opera'
  if (userAgent.includes('Chrome/')) return 'Chrome'
  if (userAgent.includes('Firefox/')) return 'Firefox'
  if (userAgent.includes('Safari/')) return 'Safari'
  return 'Browser'
}

const detectPlatformName = (userAgent: string, platform: string): string => {
  const source = `${platform} ${userAgent}`.toLowerCase()

  if (source.includes('windows')) return 'Windows'
  if (source.includes('mac')) return 'macOS'
  if (source.includes('iphone') || source.includes('ipad') || source.includes('ios')) return 'iOS'
  if (source.includes('android')) return 'Android'
  if (source.includes('linux')) return 'Linux'
  return 'Web'
}

export const getDefaultWebDeviceName = (): string => {
  if (typeof navigator === 'undefined') {
    return 'Web Browser'
  }

  const browser = detectBrowserName(navigator.userAgent || '')
  const platform = detectPlatformName(navigator.userAgent || '', navigator.platform || '')
  return `${browser} on ${platform}`
}

export const textToBytes = (value: string): Uint8Array => encoder.encode(value)
export const bytesToUtf8 = (value: Uint8Array): string => decoder.decode(value)
export const asArrayBuffer = toArrayBuffer
