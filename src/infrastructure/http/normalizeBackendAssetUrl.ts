const LEGACY_BACKEND_HOSTS = ['92.38.48.9', '100.72.193.178', 'alem-superapp.qaztech.gov.kz']
const LEGACY_BACKEND_PORT = '18080'

export const normalizeBackendAssetUrl = (
  rawUrl: string | null | undefined,
): string | null | undefined => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return rawUrl
  }

  if (typeof window === 'undefined') {
    return rawUrl
  }

  const currentOrigin = window.location.origin

  try {
    const parsed = new URL(rawUrl)
    const isLegacyHost = LEGACY_BACKEND_HOSTS.includes(parsed.hostname)
    const isLegacyPort = parsed.port === LEGACY_BACKEND_PORT

    if (isLegacyHost || isLegacyPort) {
      return `${currentOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    return rawUrl
  } catch {
    let result = rawUrl

    LEGACY_BACKEND_HOSTS.forEach((host) => {
      const patterns = [
        `http://${host}:${LEGACY_BACKEND_PORT}`,
        `https://${host}:${LEGACY_BACKEND_PORT}`,
        `http://${host}`,
        `https://${host}`,
      ]
      patterns.forEach((p) => {
        if (result.includes(p)) {
          result = result.replace(p, '')
        }
      })
    })

    if (result !== rawUrl && !result.startsWith('/')) {
      result = `/${result}`
    }

    return result
  }
}

export const resolveProfileAssetUrl = (
  rawUrl: string | null | undefined,
  objectName: string | null | undefined,
): string | null => {
  const normalizedUrl = normalizeBackendAssetUrl(rawUrl ?? null)
  if (typeof normalizedUrl === 'string' && normalizedUrl.trim()) {
    return normalizedUrl.trim()
  }

  const trimmedObjectName = objectName?.trim()
  if (!trimmedObjectName) {
    return null
  }

  const downloadPath = `/api/v1/files/download?object_name=${encodeURIComponent(trimmedObjectName)}`
  return normalizeBackendAssetUrl(downloadPath) ?? downloadPath
}
