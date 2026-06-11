export class HttpError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type ErrorPayload = {
  error?: string | { message?: string; code?: string; details?: unknown }
  message?: string
  detail?: string
  code?: string
  details?: unknown
}

const extractMessageFromPayload = (payload: unknown): { message?: string; code?: string; details?: unknown } => {
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  const data = payload as ErrorPayload

  if (typeof data.error === 'string' && data.error.trim()) {
    return { message: data.error.trim(), code: data.code, details: data.details }
  }

  if (data.error && typeof data.error === 'object') {
    const message = typeof data.error.message === 'string' ? data.error.message.trim() : ''
    return {
      message: message || undefined,
      code: data.error.code || data.code,
      details: data.error.details ?? data.details,
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return { message: data.message.trim(), code: data.code, details: data.details }
  }

  if (typeof data.detail === 'string' && data.detail.trim()) {
    return { message: data.detail.trim(), code: data.code, details: data.details }
  }

  return {}
}

const getDefaultStatusMessage = (status: number): string => {
  if (status === 400) return 'Некорректный запрос.'
  if (status === 401) return 'Сессия истекла. Войдите снова.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Запрашиваемые данные не найдены.'
  if (status === 409) return 'Конфликт данных. Обновите страницу и попробуйте снова.'
  if (status === 413) return 'Размер файла превышает допустимый лимит.'
  if (status === 422) return 'Данные не прошли валидацию.'
  if (status === 429) return 'Слишком много запросов. Попробуйте позже.'
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'
  return 'Не удалось выполнить запрос.'
}

export const parseHttpError = async (response: Response): Promise<HttpError> => {
  let parsedPayload: unknown

  try {
    const cloned = response.clone()
    const contentType = cloned.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      parsedPayload = await cloned.json()
    } else if (contentType.includes('text/html')) {
      parsedPayload = undefined
    } else {
      const text = (await cloned.text()).trim()
      parsedPayload = text ? { message: text } : undefined
    }
  } catch {
    parsedPayload = undefined
  }

  const extracted = extractMessageFromPayload(parsedPayload)
  const message = extracted.message || getDefaultStatusMessage(response.status)

  return new HttpError(message, response.status, extracted.code, extracted.details)
}
