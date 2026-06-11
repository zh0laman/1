import type { NotificationItem } from '../../domain/entities/Notification'

export type AppLocale = 'ru' | 'kk' | 'en'
export type NotificationStatusTone = 'success' | 'warning' | 'error' | 'neutral'

export interface NotificationTranslationSet {
  notification: string
  notificationTitleDefault: string
  applicationProcessed: string
  applicationStatusChanged: string
  sourceNotification: string
  responseReceived: string
  systemNotification: string
  noDescription: string
  incomingCall: string
  source: string
  status: string
  details: string
  today: string
  yesterday: string
  allRead: string
  notifications: string
  newItems: string
  noNotifications: string
  close: string
  open: string
  externalMessageId: string
  applicationNumber: string
  sourceSystemCode: string
  sourceSystemName: string
  receivedAt: string
  processedAt: string
  readAll: string
  statusProcessed: string
  statusPending: string
  statusFailed: string
  statusInfo: string
  statusUnknown: string
  applicationProcessedDetailed: (numberLabel: string | null) => string
  applicationProcessedFallback: string
  applicationAcceptedDetailed: (numberLabel: string | null) => string
  responseReceivedDetailed: string
  openForDetails: string
}

export const notificationTranslations: Record<AppLocale, NotificationTranslationSet> = {
  ru: {
    notification: 'Уведомление',
    notificationTitleDefault: 'Уведомление',
    applicationProcessed: 'Заявление обработано',
    applicationStatusChanged: 'Статус заявления изменён',
    sourceNotification: 'Уведомление от {source}',
    responseReceived: 'Ответ по вашему обращению',
    systemNotification: 'Новое системное уведомление',
    noDescription: 'Без описания',
    incomingCall: 'Входящий звонок',
    source: 'Источник',
    status: 'Статус',
    details: 'Подробнее',
    today: 'Сегодня',
    yesterday: 'Вчера',
    allRead: 'Все прочитаны',
    notifications: 'Уведомления',
    newItems: 'новых',
    noNotifications: 'Нет уведомлений',
    close: 'Закрыть',
    open: 'Перейти',
    externalMessageId: 'ID сообщения',
    applicationNumber: 'Номер заявления',
    sourceSystemCode: 'Код системы',
    sourceSystemName: 'Система',
    receivedAt: 'Получено',
    processedAt: 'Обработано',
    readAll: 'Все прочитаны',
    statusProcessed: 'Обработано',
    statusPending: 'В обработке',
    statusFailed: 'Ошибка',
    statusInfo: 'Информация',
    statusUnknown: 'Без статуса',
    applicationProcessedDetailed: (numberLabel) =>
      numberLabel
        ? `Ваше заявление №${numberLabel} успешно обработано. Результат доступен в разделе «Заявления».`
        : 'Ваше заявление успешно обработано. Результат доступен в разделе «Заявления».',
    applicationProcessedFallback: 'Ваше заявление успешно обработано. Откройте уведомление, чтобы посмотреть детали.',
    applicationAcceptedDetailed: (numberLabel) =>
      numberLabel
        ? `Ваше заявление №${numberLabel} принято в обработку.`
        : 'Ваше заявление принято в обработку.',
    responseReceivedDetailed: 'По вашему обращению получен ответ. Откройте уведомление, чтобы посмотреть детали.',
    openForDetails: 'Откройте уведомление, чтобы посмотреть детали.',
  },
  kk: {
    notification: 'Хабарлама',
    notificationTitleDefault: 'Хабарлама',
    applicationProcessed: 'Өтініш өңделді',
    applicationStatusChanged: 'Өтініш күйі өзгерді',
    sourceNotification: '{source} хабарламасы',
    responseReceived: 'Өтінішіңіз бойынша жауап келді',
    systemNotification: 'Жаңа жүйелік хабарлама',
    noDescription: 'Сипаттама жоқ',
    incomingCall: 'Кіріс қоңырау',
    source: 'Дереккөз',
    status: 'Күйі',
    details: 'Толығырақ',
    today: 'Бүгін',
    yesterday: 'Кеше',
    allRead: 'Барлығы оқылды',
    notifications: 'Хабарламалар',
    newItems: 'жаңа',
    noNotifications: 'Хабарламалар жоқ',
    close: 'Жабу',
    open: 'Өту',
    externalMessageId: 'Хабарлама ID',
    applicationNumber: 'Өтініш нөмірі',
    sourceSystemCode: 'Жүйе коды',
    sourceSystemName: 'Жүйе',
    receivedAt: 'Қабылданды',
    processedAt: 'Өңделді',
    readAll: 'Барлығы оқылды',
    statusProcessed: 'Өңделді',
    statusPending: 'Өңделуде',
    statusFailed: 'Қате',
    statusInfo: 'Ақпарат',
    statusUnknown: 'Күйі жоқ',
    applicationProcessedDetailed: (numberLabel) =>
      numberLabel
        ? `Сіздің №${numberLabel} өтінішіңіз сәтті өңделді. Нәтиже «Өтініштер» бөлімінде қолжетімді.`
        : 'Сіздің өтінішіңіз сәтті өңделді. Нәтиже «Өтініштер» бөлімінде қолжетімді.',
    applicationProcessedFallback: 'Сіздің өтінішіңіз өңделді. Толық мәліметті көру үшін хабарламаны ашыңыз.',
    applicationAcceptedDetailed: (numberLabel) =>
      numberLabel
        ? `Сіздің №${numberLabel} өтінішіңіз өңдеуге қабылданды.`
        : 'Сіздің өтінішіңіз өңдеуге қабылданды.',
    responseReceivedDetailed: 'Өтінішіңіз бойынша жауап келді. Толық мәліметті көру үшін хабарламаны ашыңыз.',
    openForDetails: 'Толық мәліметті көру үшін хабарламаны ашыңыз.',
  },
  en: {
    notification: 'Notification',
    notificationTitleDefault: 'Notification',
    applicationProcessed: 'Application processed',
    applicationStatusChanged: 'Application status updated',
    sourceNotification: 'Notification from {source}',
    responseReceived: 'Response to your request',
    systemNotification: 'New system notification',
    noDescription: 'No description',
    incomingCall: 'Incoming call',
    source: 'Source',
    status: 'Status',
    details: 'Details',
    today: 'Today',
    yesterday: 'Yesterday',
    allRead: 'All read',
    notifications: 'Notifications',
    newItems: 'new',
    noNotifications: 'No notifications',
    close: 'Close',
    open: 'Open',
    externalMessageId: 'Message ID',
    applicationNumber: 'Application number',
    sourceSystemCode: 'System code',
    sourceSystemName: 'System',
    receivedAt: 'Received',
    processedAt: 'Processed',
    readAll: 'All read',
    statusProcessed: 'Processed',
    statusPending: 'In progress',
    statusFailed: 'Error',
    statusInfo: 'Info',
    statusUnknown: 'No status',
    applicationProcessedDetailed: (numberLabel) =>
      numberLabel
        ? `Your application #${numberLabel} has been processed successfully. The result is available in the Applications section.`
        : 'Your application has been processed successfully. The result is available in the Applications section.',
    applicationProcessedFallback: 'Your application has been processed. Open the notification to view the details.',
    applicationAcceptedDetailed: (numberLabel) =>
      numberLabel
        ? `Your application #${numberLabel} has been accepted for processing.`
        : 'Your application has been accepted for processing.',
    responseReceivedDetailed: 'A response to your request has been received. Open the notification to view the details.',
    openForDetails: 'Open the notification to view the details.',
  },
}

const localeToIntl: Record<AppLocale, string> = {
  ru: 'ru-RU',
  kk: 'kk-KZ',
  en: 'en-US',
}

const knownLocaleKeys = [
  'app:locale',
  'app_locale',
  'superapp.locale',
  'locale',
  'lang',
  'language',
  'preferred_language',
  'ui.locale',
  'i18nextLng',
]
const technicalCallIdPattern = /\s*[•·]\s*call(?:_group)?_[^\s•·]+/gi

const normalizeLocaleValue = (value: string | null | undefined): AppLocale | null => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith('kk')) return 'kk'
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('ru')) return 'ru'
  return null
}

const safeStorageValue = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export const detectAppLocale = (): AppLocale => {
  for (const key of knownLocaleKeys) {
    const fromStorage = normalizeLocaleValue(safeStorageValue(key))
    if (fromStorage) return fromStorage
  }

  if (typeof document !== 'undefined') {
    const fromDocument = normalizeLocaleValue(document.documentElement.lang)
    // In this project `index.html` uses `lang="en"` by default.
    // Do not treat that template default as a real app locale override.
    if (fromDocument && fromDocument !== 'en') return fromDocument
  }

  if (typeof navigator !== 'undefined') {
    const fromNavigator = normalizeLocaleValue(navigator.language)
    // Keep Russian as the fallback UI language unless ru/kk is explicitly detected.
    if (fromNavigator === 'ru' || fromNavigator === 'kk') return fromNavigator
  }

  return 'ru'
}

export const getNotificationTranslations = (locale: AppLocale): NotificationTranslationSet =>
  notificationTranslations[locale] ?? notificationTranslations.ru

export const sanitizeNotificationText = (value: string): string =>
  value.replace(technicalCallIdPattern, '').replace(/\s+/g, ' ').trim()

const buildNumberLabel = (item: NotificationItem): string | null =>
  item.applicationNumber?.trim() || item.externalMessageId?.trim() || null

const buildSourceName = (item: NotificationItem): string =>
  item.sourceSystemName?.trim() || item.sourceSystemCode?.trim() || ''

const isApplicationStatus = (item: NotificationItem): boolean => {
  const notificationType = (item.notificationType || item.type || '').toUpperCase()
  return notificationType === 'APPLICATION_STATUS'
}

const normalizeStatus = (status: string | undefined): string => (status || '').trim().toUpperCase()

export const getNotificationStatusMeta = (
  status: string | undefined,
  locale: AppLocale,
): { label: string; tone: NotificationStatusTone } | null => {
  const translations = getNotificationTranslations(locale)
  switch (normalizeStatus(status)) {
    case 'PROCESSED':
    case 'SUCCESS':
    case 'SENT':
      return { label: translations.statusProcessed, tone: 'success' }
    case 'PENDING':
    case 'RECEIVED':
    case 'SAVED':
      return { label: translations.statusPending, tone: 'warning' }
    case 'FAILED':
    case 'ERROR':
      return { label: translations.statusFailed, tone: 'error' }
    case 'INFO':
      return { label: translations.statusInfo, tone: 'neutral' }
    default:
      return null
  }
}

export const getNotificationFallbackTitle = (item: NotificationItem, locale: AppLocale): string => {
  const translations = getNotificationTranslations(locale)
  const sourceName = buildSourceName(item)
  const status = normalizeStatus(item.status)
  const notificationType = (item.notificationType || item.type || '').toUpperCase()

  if (isApplicationStatus(item) && (status === 'PROCESSED' || status === 'SUCCESS')) {
    return translations.applicationProcessed
  }
  if (isApplicationStatus(item)) {
    return translations.applicationStatusChanged
  }
  if (notificationType === 'RESPONSE' || notificationType === 'APPEAL_RESPONSE') {
    return translations.responseReceived
  }
  if (sourceName) {
    return translations.sourceNotification.replace('{source}', sourceName)
  }
  if (notificationType === 'SYSTEM' || item.type === 'external_system') {
    return translations.systemNotification
  }
  return translations.notificationTitleDefault
}

export const getNotificationFallbackMessage = (item: NotificationItem, locale: AppLocale): string => {
  const translations = getNotificationTranslations(locale)
  const rawMessage = sanitizeNotificationText(item.messageText || item.content || item.shortText || '')
  const notificationType = (item.notificationType || item.type || '').toUpperCase()
  const status = normalizeStatus(item.status)
  const numberLabel = buildNumberLabel(item)

  if (isApplicationStatus(item) && (status === 'PROCESSED' || status === 'SUCCESS')) {
    const lowerRaw = rawMessage.toLowerCase()
    const genericPhrases = ['успешно обработано', 'сәтті өңделді', 'processed successfully']
    if (!rawMessage || genericPhrases.some((phrase) => lowerRaw.includes(phrase))) {
      return numberLabel
        ? translations.applicationProcessedDetailed(numberLabel)
        : translations.applicationProcessedFallback
    }
  }

  if (isApplicationStatus(item) && status === 'PENDING') {
    return translations.applicationAcceptedDetailed(numberLabel)
  }

  if (notificationType === 'RESPONSE' || notificationType === 'APPEAL_RESPONSE') {
    return rawMessage || translations.responseReceivedDetailed
  }

  if (rawMessage) {
    return rawMessage
  }

  return translations.openForDetails
}

export const getNotificationPreview = (item: NotificationItem, locale: AppLocale): string => {
  const rawShort = sanitizeNotificationText(item.shortText || '')
  if (rawShort) return rawShort
  return getNotificationFallbackMessage(item, locale)
}

export const getNotificationIconName = (item: Pick<NotificationItem, 'type' | 'notificationType' | 'status'>): string => {
  const type = `${item.notificationType || ''} ${item.type || ''}`.toLowerCase()
  const status = normalizeStatus(item.status)
  if (status === 'FAILED' || status === 'ERROR') return 'error'
  if (status === 'PROCESSED' || status === 'SUCCESS') return 'check_circle'
  if (status === 'PENDING' || status === 'RECEIVED' || status === 'SAVED') return 'schedule'
  if (type.includes('response') || type.includes('appeal')) return 'mail'
  if (type.includes('application')) return 'description'
  if (type.includes('calendar')) return 'event'
  if (type.includes('kanban') || type.includes('task')) return 'task_alt'
  if (type.includes('drive')) return 'folder'
  if (type.includes('call')) return 'call'
  return 'notifications'
}

export const formatNotificationDateTime = (value: string | undefined, locale: AppLocale): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const translations = getNotificationTranslations(locale)
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(midnight)
  yesterday.setDate(yesterday.getDate() - 1)

  const timePart = new Intl.DateTimeFormat(localeToIntl[locale], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (date >= midnight) {
    return `${translations.today}, ${timePart}`
  }

  if (date >= yesterday && date < midnight) {
    return `${translations.yesterday}, ${timePart}`
  }

  if (date.getFullYear() === now.getFullYear()) {
    const datePart = new Intl.DateTimeFormat(localeToIntl[locale], {
      day: 'numeric',
      month: 'long',
    }).format(date)
    return `${datePart}, ${timePart}`
  }

  const datePart = new Intl.DateTimeFormat(localeToIntl[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  return `${datePart}, ${timePart}`
}

export const buildNotificationCompactMeta = (
  preview: string,
  sourceName: string,
  createdAt: string,
  locale: AppLocale,
): string => {
  const parts = [preview]
  if (sourceName) {
    parts.push(sourceName)
  }
  parts.push(formatNotificationDateTime(createdAt, locale))
  return parts.filter(Boolean).join(' · ')
}

export const getNotificationSourceName = (item: NotificationItem): string => buildSourceName(item)
