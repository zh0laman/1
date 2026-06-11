import {
  asArrayBuffer,
  base64ToBytes,
  bytesToBase64,
  deriveX25519PublicKeyBase64,
  normalizeBase64,
  rawX25519PrivateKeyToPkcs8Base64,
  textToBytes,
} from './e2eeDeviceCrypto'

interface BackupKdfParams {
  iterations?: number
  hash?: string
  keyLength?: number
  memory?: number
  memoryKiB?: number
  parallelism?: number
  passes?: number
}

interface BackupMetadata {
  backupKeyType?: string | null
  backupKeyFormat?: string | null
  backupKeyScope?: string | null
  backupFormatVersion?: number | null
  cipherAlgorithm?: string | null
  cipherTagEmbedded?: boolean | null
  aadMode?: string | null
  passwordProcessing?: string | null
}

interface BackupDecryptContext {
  kdfAlgorithm: string
  backupKeyFormat?: string | null
}

interface CanonicalBackupCreateInput {
  privateKeyBase64: string
  masterPassword: string
}

interface CanonicalBackupPayload {
  encryptedPrivateKey: string
  salt: string
  iv: string
  kdfAlgorithm: string
  kdfParams: {
    iterations: number
    hash: string
    keyLength: number
  }
  version: number
  backupKeyType: string
  backupKeyFormat: string
  backupKeyScope: string
  backupFormatVersion: number
  cipherAlgorithm: string
  cipherTagEmbedded: boolean
  aadMode: string
  passwordProcessing: string
}

const CANONICAL_BACKUP_KDF_ALGORITHM = 'pbkdf2-sha256'
const CANONICAL_BACKUP_ITERATIONS = 310000
const CANONICAL_BACKUP_HASH = 'sha256'
const CANONICAL_BACKUP_KEY_LENGTH = 32
const CANONICAL_BACKUP_VERSION = 1
const CANONICAL_BACKUP_KEY_TYPE = 'x25519'
const CANONICAL_BACKUP_KEY_FORMAT = 'pkcs8-der-base64'
const CANONICAL_BACKUP_KEY_SCOPE = 'device_identity'
const CANONICAL_BACKUP_FORMAT_VERSION = 1
const CANONICAL_BACKUP_CIPHER_ALGORITHM = 'aes-256-gcm'
const CANONICAL_BACKUP_PASSWORD_PROCESSING = 'utf8-raw'
const CANONICAL_BACKUP_SALT_BYTES = 16
const CANONICAL_BACKUP_IV_BYTES = 12

type WebCryptoPurpose = 'restore' | 'create'

const createWebCryptoUnavailableError = (purpose: WebCryptoPurpose): Error => {
  const secureContextHint =
    typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext
      ? ' Open the app over HTTPS (or localhost) and try again.'
      : ' Open the app in a modern browser and try again.'

  if (purpose === 'restore') {
    return new Error(
      `This browser cannot use Web Crypto for E2EE backup restore.${secureContextHint} If needed, use QR linked-device flow.`,
    )
  }

  return new Error(
    `This browser cannot use Web Crypto to create or rotate an E2EE recovery backup.${secureContextHint}`,
  )
}

const ensureCryptoApi = (purpose: WebCryptoPurpose): Crypto => {
  const cryptoApi = globalThis.crypto

  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw createWebCryptoUnavailableError(purpose)
  }

  return cryptoApi
}

const ensureSubtleCrypto = (purpose: WebCryptoPurpose): SubtleCrypto => ensureCryptoApi(purpose).subtle

const importPasswordKey = async (
  masterPassword: string,
  algorithm: string,
  purpose: WebCryptoPurpose = 'restore',
): Promise<CryptoKey> => {
  const passwordBytes = asArrayBuffer(textToBytes(masterPassword))
  const subtle = ensureSubtleCrypto(purpose) as SubtleCrypto & {
    importKey: (
      format: string,
      keyData: BufferSource | JsonWebKey,
      algorithmIdentifier: AlgorithmIdentifier,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ) => Promise<CryptoKey>
  }

  return subtle.importKey('raw', passwordBytes, algorithm as AlgorithmIdentifier, false, ['deriveKey'])
}

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  ensureCryptoApi('create').getRandomValues(bytes)
  return bytes
}

const normalizeHashName = (hash: string): string => {
  const normalized = hash.trim().toLowerCase()

  if (normalized === 'sha256' || normalized === 'sha-256') {
    return 'SHA-256'
  }

  if (normalized === 'sha384' || normalized === 'sha-384') {
    return 'SHA-384'
  }

  if (normalized === 'sha512' || normalized === 'sha-512') {
    return 'SHA-512'
  }

  throw new Error(`Unsupported backup KDF hash: ${hash}`)
}

const resolveAesKeyLengthBits = (keyLength: number): number => {
  if (!Number.isFinite(keyLength) || keyLength <= 0) {
    throw new Error('Unsupported backup KDF key length.')
  }

  const keyLengthBits = keyLength * 8
  if (keyLengthBits !== 128 && keyLengthBits !== 192 && keyLengthBits !== 256) {
    throw new Error(`Unsupported backup KDF key length: ${keyLength}`)
  }

  return keyLengthBits
}

const unsupportedBackupKdfError = () =>
  new Error('Unsupported E2EE backup: backend did not provide a complete kdf_params contract.')

const unsupportedBackupFormatError = (details: string) =>
  new Error(`Unsupported E2EE backup format: ${details}`)

const requireFiniteNumber = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw unsupportedBackupKdfError()
  }

  return value
}

const requireNonEmptyString = (value: string | undefined): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw unsupportedBackupKdfError()
  }

  return value
}

const pickFiniteNumber = (...values: Array<number | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  throw unsupportedBackupKdfError()
}

const requireBackupContract = (metadata: BackupMetadata): void => {
  const backupKeyType = metadata.backupKeyType?.trim().toLowerCase()
  const backupKeyFormat = metadata.backupKeyFormat?.trim().toLowerCase()
  const backupKeyScope = metadata.backupKeyScope?.trim().toLowerCase()
  const cipherAlgorithm = metadata.cipherAlgorithm?.trim().toLowerCase()
  const aadMode = metadata.aadMode?.trim().toLowerCase()
  const passwordProcessing = metadata.passwordProcessing?.trim().toLowerCase()

  if (backupKeyType !== 'x25519') {
    throw unsupportedBackupFormatError(`backup_key_type=${metadata.backupKeyType ?? 'missing'}`)
  }

  if (backupKeyFormat !== 'pkcs8-der-base64' && backupKeyFormat !== 'raw-32-bytes') {
    throw unsupportedBackupFormatError(`backup_key_format=${metadata.backupKeyFormat ?? 'missing'}`)
  }

  if (backupKeyScope !== 'device_identity' && backupKeyScope !== 'user_recovery_material') {
    throw unsupportedBackupFormatError(`backup_key_scope=${metadata.backupKeyScope ?? 'missing'}`)
  }

  if (metadata.backupFormatVersion != null && metadata.backupFormatVersion !== 1) {
    throw unsupportedBackupFormatError(`backup_format_version=${metadata.backupFormatVersion}`)
  }

  if (cipherAlgorithm !== 'aes-256-gcm') {
    throw unsupportedBackupFormatError(`cipher_algorithm=${metadata.cipherAlgorithm ?? 'missing'}`)
  }

  if (metadata.cipherTagEmbedded !== true) {
    throw unsupportedBackupFormatError(`cipher_tag_embedded=${String(metadata.cipherTagEmbedded)}`)
  }

  if (aadMode !== 'none') {
    throw unsupportedBackupFormatError(`aad_mode=${metadata.aadMode ?? 'missing'}`)
  }

  if (passwordProcessing !== 'utf8-raw') {
    throw unsupportedBackupFormatError(`password_processing=${metadata.passwordProcessing ?? 'missing'}`)
  }
}

const normalizeRestoredPkcs8PrivateKeyBase64 = async (privateKeyPlaintext: Uint8Array): Promise<string> => {
  if (privateKeyPlaintext.byteLength === 0) {
    throw unsupportedBackupFormatError('empty decrypted private key payload')
  }

  try {
    const maybeBase64 = new TextDecoder().decode(privateKeyPlaintext).trim()

    if (!maybeBase64) {
      throw unsupportedBackupFormatError('empty decrypted private key payload')
    }

    const normalized = normalizeBase64(maybeBase64)
    await deriveX25519PublicKeyBase64(normalized)
    return normalized
  } catch {
    throw unsupportedBackupFormatError('decrypted payload is not a valid pkcs8-der-base64 x25519 private key')
  }
}

const normalizeRestoredRawPrivateKeyBase64 = async (privateKeyPlaintext: Uint8Array): Promise<string> => {
  if (privateKeyPlaintext.byteLength !== 32) {
    throw unsupportedBackupFormatError(
      `decrypted payload is not a valid raw-32-bytes x25519 private key: got ${privateKeyPlaintext.byteLength} bytes`,
    )
  }

  try {
    const pkcs8Base64 = rawX25519PrivateKeyToPkcs8Base64(privateKeyPlaintext)
    await deriveX25519PublicKeyBase64(pkcs8Base64)
    return pkcs8Base64
  } catch {
    throw unsupportedBackupFormatError('decrypted payload is not a valid raw-32-bytes x25519 private key')
  }
}

const normalizeRestoredPrivateKeyBase64 = async (
  privateKeyPlaintext: Uint8Array,
  backupKeyFormat: string | null | undefined,
): Promise<string> => {
  const normalizedFormat = backupKeyFormat?.trim().toLowerCase()

  if (normalizedFormat === 'pkcs8-der-base64') {
    return normalizeRestoredPkcs8PrivateKeyBase64(privateKeyPlaintext)
  }

  if (normalizedFormat === 'raw-32-bytes') {
    return normalizeRestoredRawPrivateKeyBase64(privateKeyPlaintext)
  }

  throw unsupportedBackupFormatError(`backup_key_format=${backupKeyFormat ?? 'missing'}`)
}

const resolveArgon2Params = (
  kdfParams: BackupKdfParams | null | undefined,
): { parallelism: number; memory: number; passes: number; keyLengthBits: number } => {
  if (!kdfParams) {
    throw unsupportedBackupKdfError()
  }

  const parallelism = requireFiniteNumber(kdfParams.parallelism)
  const memory = pickFiniteNumber(kdfParams.memory, kdfParams.memoryKiB)
  const passes = pickFiniteNumber(kdfParams.passes, kdfParams.iterations)
  const keyLength = requireFiniteNumber(kdfParams.keyLength)

  return {
    parallelism,
    memory,
    passes,
    keyLengthBits: resolveAesKeyLengthBits(keyLength),
  }
}

const resolvePbkdf2Params = (
  kdfParams: BackupKdfParams | null | undefined,
): { iterations: number; hash: string; keyLengthBits: number } => {
  if (!kdfParams) {
    throw unsupportedBackupKdfError()
  }

  const iterations = requireFiniteNumber(kdfParams.iterations)
  const hash = requireNonEmptyString(kdfParams.hash)
  const keyLength = requireFiniteNumber(kdfParams.keyLength)

  return {
    iterations,
    hash: normalizeHashName(hash),
    keyLengthBits: resolveAesKeyLengthBits(keyLength),
  }
}

const deriveArgon2BackupKey = async (
  passwordKey: CryptoKey,
  salt: Uint8Array,
  params: { parallelism: number; memory: number; passes: number; keyLengthBits: number },
  usages: KeyUsage[] = ['decrypt'],
  purpose: WebCryptoPurpose = 'restore',
): Promise<CryptoKey> =>
  ensureSubtleCrypto(purpose).deriveKey(
    {
      name: 'Argon2id',
      nonce: asArrayBuffer(salt),
      parallelism: params.parallelism,
      memory: params.memory,
      passes: params.passes,
      version: 19,
    } as AlgorithmIdentifier,
    passwordKey,
    { name: 'AES-GCM', length: params.keyLengthBits },
    false,
    usages,
  )

const derivePbkdf2BackupKey = async (
  passwordKey: CryptoKey,
  salt: Uint8Array,
  params: { iterations: number; hash: string; keyLengthBits: number },
  usages: KeyUsage[] = ['decrypt'],
  purpose: WebCryptoPurpose = 'restore',
): Promise<CryptoKey> =>
  ensureSubtleCrypto(purpose).deriveKey(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(salt),
      iterations: params.iterations,
      hash: params.hash,
    },
    passwordKey,
    { name: 'AES-GCM', length: params.keyLengthBits },
    false,
    usages,
  )

const decryptBackupCiphertext = async (
  backupKey: CryptoKey,
  iv: Uint8Array,
  encryptedPrivateKey: Uint8Array,
  context: BackupDecryptContext,
): Promise<Uint8Array> => {
  const subtle = ensureSubtleCrypto('restore')

  try {
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(iv) },
      backupKey,
      asArrayBuffer(encryptedPrivateKey),
    )

    return new Uint8Array(decrypted)
  } catch {
    const normalizedKdf = context.kdfAlgorithm.trim().toLowerCase()
    const normalizedBackupKeyFormat = context.backupKeyFormat?.trim().toLowerCase()

    if ((normalizedKdf === 'pbkdf2-sha256' || normalizedKdf === 'pbkdf2') && normalizedBackupKeyFormat === 'raw-32-bytes') {
      throw new Error(
        'Failed to decrypt legacy E2EE backup. The master password does not match this backup, or this legacy PBKDF2 backup was created with a different crypto contract than backend now declares. You can continue with a fresh web key or use QR linked-device flow for old history.',
      )
    }

    throw new Error('Failed to decrypt E2EE backup. Check the master password.')
  }
}

const restoreFromArgon2id = async (
  masterPassword: string,
  salt: Uint8Array,
  iv: Uint8Array,
  encryptedPrivateKey: Uint8Array,
  kdfParams: BackupKdfParams | null | undefined,
  backupKeyFormat: string | null | undefined,
): Promise<{ privateKeyBase64: string; publicKeyBase64: string }> => {
  const passwordKey = await importPasswordKey(masterPassword, 'Argon2id', 'restore').catch((error) => {
    if (error instanceof Error && error.message.includes('Web Crypto')) {
      throw error
    }

    throw new Error('This browser does not support Argon2id for E2EE backup restore. Use QR linked-device flow or a modern browser.')
  })
  const params = resolveArgon2Params(kdfParams)
  const backupKey = await deriveArgon2BackupKey(passwordKey, salt, params)
  const decrypted = await decryptBackupCiphertext(backupKey, iv, encryptedPrivateKey, {
    kdfAlgorithm: 'argon2id',
    backupKeyFormat,
  })

  const privateKeyBase64 = await normalizeRestoredPrivateKeyBase64(decrypted, backupKeyFormat)
  return {
    privateKeyBase64,
    publicKeyBase64: await deriveX25519PublicKeyBase64(privateKeyBase64),
  }
}

const restoreFromPbkdf2Sha256 = async (
  masterPassword: string,
  salt: Uint8Array,
  iv: Uint8Array,
  encryptedPrivateKey: Uint8Array,
  kdfParams: BackupKdfParams | null | undefined,
  backupKeyFormat: string | null | undefined,
): Promise<{ privateKeyBase64: string; publicKeyBase64: string }> => {
  const passwordKey = await importPasswordKey(masterPassword, 'PBKDF2', 'restore').catch((error) => {
    if (error instanceof Error && error.message.includes('Web Crypto')) {
      throw error
    }

    throw new Error(
      'This browser does not support PBKDF2 for E2EE backup restore. Open the app over HTTPS or use QR linked-device flow.',
    )
  })
  const params = resolvePbkdf2Params(kdfParams)
  const backupKey = await derivePbkdf2BackupKey(passwordKey, salt, params)
  const decrypted = await decryptBackupCiphertext(backupKey, iv, encryptedPrivateKey, {
    kdfAlgorithm: 'pbkdf2-sha256',
    backupKeyFormat,
  })

  const privateKeyBase64 = await normalizeRestoredPrivateKeyBase64(decrypted, backupKeyFormat)
  return {
    privateKeyBase64,
    publicKeyBase64: await deriveX25519PublicKeyBase64(privateKeyBase64),
  }
}

export const restorePrivateKeyFromBackup = async (input: {
  encryptedPrivateKey: string
  salt: string
  iv: string
  kdfAlgorithm: string
  kdfParams?: BackupKdfParams | null
  backupKeyType?: string | null
  backupKeyFormat?: string | null
  backupKeyScope?: string | null
  backupFormatVersion?: number | null
  cipherAlgorithm?: string | null
  cipherTagEmbedded?: boolean | null
  aadMode?: string | null
  passwordProcessing?: string | null
  masterPassword: string
  version?: number
}): Promise<{ privateKeyBase64: string; publicKeyBase64: string }> => {
  requireBackupContract({
    backupKeyType: input.backupKeyType,
    backupKeyFormat: input.backupKeyFormat,
    backupKeyScope: input.backupKeyScope,
    backupFormatVersion: input.backupFormatVersion,
    cipherAlgorithm: input.cipherAlgorithm,
    cipherTagEmbedded: input.cipherTagEmbedded,
    aadMode: input.aadMode,
    passwordProcessing: input.passwordProcessing,
  })

  const kdfAlgorithm = input.kdfAlgorithm.trim().toLowerCase()
  const salt = base64ToBytes(input.salt)
  const iv = base64ToBytes(input.iv)
  const encryptedPrivateKey = base64ToBytes(input.encryptedPrivateKey)

  if (kdfAlgorithm === 'argon2id') {
    return restoreFromArgon2id(
      input.masterPassword,
      salt,
      iv,
      encryptedPrivateKey,
      input.kdfParams,
      input.backupKeyFormat,
    )
  }

  if (kdfAlgorithm === 'pbkdf2-sha256' || kdfAlgorithm === 'pbkdf2') {
    return restoreFromPbkdf2Sha256(
      input.masterPassword,
      salt,
      iv,
      encryptedPrivateKey,
      input.kdfParams,
      input.backupKeyFormat,
    )
  }

  throw new Error(`Unsupported backup KDF algorithm: ${input.kdfAlgorithm}`)
}

export const createCanonicalE2eeBackup = async (
  input: CanonicalBackupCreateInput,
): Promise<CanonicalBackupPayload> => {
  const normalizedPrivateKeyBase64 = normalizeBase64(input.privateKeyBase64)

  if (!input.masterPassword) {
    throw new Error('Master password is required to create a recovery backup.')
  }

  await deriveX25519PublicKeyBase64(normalizedPrivateKeyBase64)

  const salt = randomBytes(CANONICAL_BACKUP_SALT_BYTES)
  const iv = randomBytes(CANONICAL_BACKUP_IV_BYTES)
  const passwordKey = await importPasswordKey(input.masterPassword, 'PBKDF2', 'create').catch((error) => {
    if (error instanceof Error && error.message.includes('Web Crypto')) {
      throw error
    }

    throw new Error('This browser does not support PBKDF2 for creating an E2EE recovery backup. Open the app over HTTPS or use a modern browser.')
  })
  const backupKey = await derivePbkdf2BackupKey(passwordKey, salt, {
    iterations: CANONICAL_BACKUP_ITERATIONS,
    hash: normalizeHashName(CANONICAL_BACKUP_HASH),
    keyLengthBits: resolveAesKeyLengthBits(CANONICAL_BACKUP_KEY_LENGTH),
  }, ['encrypt'], 'create')
  const plaintext = textToBytes(normalizedPrivateKeyBase64)
  const subtle = ensureSubtleCrypto('create')
  const encryptedPrivateKey = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(iv) },
      backupKey,
      asArrayBuffer(plaintext),
    ),
  )

  return {
    encryptedPrivateKey: bytesToBase64(encryptedPrivateKey),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    kdfAlgorithm: CANONICAL_BACKUP_KDF_ALGORITHM,
    kdfParams: {
      iterations: CANONICAL_BACKUP_ITERATIONS,
      hash: CANONICAL_BACKUP_HASH,
      keyLength: CANONICAL_BACKUP_KEY_LENGTH,
    },
    version: CANONICAL_BACKUP_VERSION,
    backupKeyType: CANONICAL_BACKUP_KEY_TYPE,
    backupKeyFormat: CANONICAL_BACKUP_KEY_FORMAT,
    backupKeyScope: CANONICAL_BACKUP_KEY_SCOPE,
    backupFormatVersion: CANONICAL_BACKUP_FORMAT_VERSION,
    cipherAlgorithm: CANONICAL_BACKUP_CIPHER_ALGORITHM,
    cipherTagEmbedded: true,
    aadMode: 'none',
    passwordProcessing: CANONICAL_BACKUP_PASSWORD_PROCESSING,
  }
}
