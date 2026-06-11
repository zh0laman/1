/** WS-события, при которых не нужно перезагружать весь список чатов (REST + UI). */
export const MESSENGER_WS_EVENTS_WITHOUT_CHAT_RELOAD = new Set([
  'new_message',
  'new_channel_post',
  'chat_message',
  'message_created',
  'typing',
  'user_status',
  'initial_online_list',
  'message_reactions_updated',
  'pong',
  'ping',
  'read',
  'read_receipt',
  'message_deleted',
  'message_edited',
])

export function shouldReloadMessengerChatList(eventType: string | undefined): boolean {
  if (!eventType) {
    return false
  }
  return !MESSENGER_WS_EVENTS_WITHOUT_CHAT_RELOAD.has(eventType.toLowerCase())
}
