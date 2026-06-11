import { HttpError } from '../../infrastructure/http/HttpError'

const NETWORK_ERROR_SUBSTRINGS = [
  'failed to fetch',
  'network error',
  'load failed',
  'fetch failed',
  'networkrequestfailed',
  'network request failed',
  'failed to execute \'fetch\'',
  'connection refused',
  'failed to connect',
]

const isNetworkError = (message: string): boolean => {
  const lowercaseMessage = message.toLowerCase()
  return NETWORK_ERROR_SUBSTRINGS.some((substring) => lowercaseMessage.includes(substring))
}

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof HttpError && error.message.trim()) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    const msg = error.message
    if (isNetworkError(msg)) {
      return fallback || 'Не удалось загрузить данные. Пожалуйста, проверьте интернет-соединение или обновите страницу.'
    }
    return msg
  }

  if (typeof error === 'string' && error.trim()) {
    if (isNetworkError(error)) {
      return fallback || 'Не удалось загрузить данные. Пожалуйста, проверьте интернет-соединение или обновите страницу.'
    }
    return error
  }

  return fallback
}

