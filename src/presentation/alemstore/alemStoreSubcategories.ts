import type { AlemStoreAppViewModel } from '../view-models/AlemStoreViewModel'

export type AlemStoreSubcategoryId = 'ai' | 'documents' | 'other'

const SUBCATEGORY_LABELS: Record<AlemStoreSubcategoryId, string> = {
  ai: 'Искусственный интеллект',
  documents: 'Документооборот',
  other: 'Прочие приложения',
}

const ORDER: AlemStoreSubcategoryId[] = ['ai', 'documents', 'other']

/** Латиница «AI» как отдельное сокращение, не часть слова вроде «plain». */
const hasLatinAi = (text: string): boolean =>
  /(?:^|[^A-Za-zА-Яа-яЁё0-9])ai(?:$|[^A-Za-zА-Яа-яЁё0-9])/i.test(text)

/** Кириллица «ИИ» как подстрока в названии (как просили: «если есть в слове»). */
const hasCyrillicIi = (text: string): boolean => text.toLowerCase().includes('ии')

const hasAiSignals = (text: string): boolean => hasLatinAi(text) || hasCyrillicIi(text)

const hasDocumentSignals = (text: string): boolean => {
  const lower = text.toLowerCase()
  if (lower.includes('документ')) {
    return true
  }
  // «ОДО» как аббревиатура (не подстрока вроде «продолжить» — только после разделителя/начала строки)
  return /(?:^|[\s(/.,\-–—])(одо)(?:[\s).,\-/–—]|$)/i.test(text)
}

const catalogText = (app: AlemStoreAppViewModel): string => {
  const tags = app.tags?.length ? app.tags.join(' ') : ''
  return `${app.appName} ${tags}`.trim()
}

/**
 * Подгруппа для витрины: сначала ИИ/AI, иначе документы/ОДО, иначе прочее.
 */
export function getAlemStoreSubcategory(app: AlemStoreAppViewModel): AlemStoreSubcategoryId {
  if (app.category === 'ИИ') {
    return 'ai'
  }
  if (app.category === 'Документация') {
    return 'documents'
  }
  if (app.category === 'Прочие') {
    return 'other'
  }

  // Fallback to heuristics if category is missing or unknown
  const haystack = catalogText(app)
  if (hasAiSignals(haystack)) {
    return 'ai'
  }
  if (hasDocumentSignals(haystack)) {
    return 'documents'
  }
  return 'other'
}

export interface AlemStoreSubcategoryGroup {
  id: AlemStoreSubcategoryId
  title: string
  apps: AlemStoreAppViewModel[]
}

/** Сохраняет порядок приложений внутри каждой группы (как в отфильтрованном списке). */
export function groupAppsBySubcategory(apps: AlemStoreAppViewModel[]): AlemStoreSubcategoryGroup[] {
  const buckets: Record<AlemStoreSubcategoryId, AlemStoreAppViewModel[]> = {
    ai: [],
    documents: [],
    other: [],
  }

  for (const app of apps) {
    buckets[getAlemStoreSubcategory(app)].push(app)
  }

  return ORDER.map((id) => ({
    id,
    title: SUBCATEGORY_LABELS[id],
    apps: buckets[id],
  })).filter((g) => g.apps.length > 0)
}
