export type MessageFrom = 'me' | 'them' | string

export interface ChatMessage {
  id: number
  from: MessageFrom
  text: string
  time: string
  status: 'read' | 'delivered'
  isCall?: boolean
}

export interface Contact {
  id: number
  name: string
  sub: string
  time: string
  avatar: string
  seed: number
  online: boolean
  unread: number
  isGroup: boolean
  isSupport: boolean
  messages: ChatMessage[]
}

export interface ContactInfoRow {
  icon: string
  label: string
  value: string
}

export interface SharedFileRow {
  name: string
  size: string
  icon: string
  color: string
}
