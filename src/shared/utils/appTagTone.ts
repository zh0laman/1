import type { CSSProperties } from 'react'

export interface AppTagTone {
  chipStyle: CSSProperties
}

const TAG_TONES: ReadonlyArray<AppTagTone> = [
  {
    chipStyle: {
      background: '#EFF6FF',
      borderColor: '#DBEAFE',
      color: '#1E40AF',
    },
  },
  {
    chipStyle: {
      background: '#ECFDF5',
      borderColor: '#D1FAE5',
      color: '#065F46',
    },
  },
  {
    chipStyle: {
      background: '#FFF3E0',
      borderColor: '#FFE0B2',
      color: '#E65100',
    },
  },
  {
    chipStyle: {
      background: '#F3E5F5',
      borderColor: '#E1BEE7',
      color: '#4A148C',
    },
  },
  {
    chipStyle: {
      background: '#FFFDE7',
      borderColor: '#FFF9C4',
      color: '#F57F17',
    },
  },
  {
    chipStyle: {
      background: '#E0F2F1',
      borderColor: '#B2DFDB',
      color: '#004D40',
    },
  },
  {
    chipStyle: {
      background: '#FCE4EC',
      borderColor: '#F8BBD0',
      color: '#880E4F',
    },
  },
  {
    chipStyle: {
      background: '#E0F7FA',
      borderColor: '#B2EBF2',
      color: '#006064',
    },
  },
]

export const getAppTagTone = (tag: string): AppTagTone => {
  const normalizedTag = tag.trim().toLowerCase()
  let hash = 0

  for (let index = 0; index < normalizedTag.length; index += 1) {
    hash = (hash * 31 + normalizedTag.charCodeAt(index)) >>> 0
  }

  return TAG_TONES[hash % TAG_TONES.length] ?? TAG_TONES[0]
}
