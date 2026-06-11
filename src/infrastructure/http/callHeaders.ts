import { WebCallSessionStore } from '../storage/WebCallSessionStore'
import { WebDeviceSessionStore } from '../storage/WebDeviceSessionStore'

const webDeviceSessionStore = new WebDeviceSessionStore()
const webCallSessionStore = new WebCallSessionStore()

export const withCallHeaders = (headersInit: HeadersInit | undefined = undefined): Headers => {
  const headers = new Headers(headersInit)
  const webDeviceId = webDeviceSessionStore.getOrCreateCurrentDeviceId()
  const callSessionId = webCallSessionStore.getOrCreateSessionId()

  if (!headers.has('X-Web-Device-ID')) {
    headers.set('X-Web-Device-ID', webDeviceId)
  }

  if (!headers.has('X-Call-Session-ID')) {
    headers.set('X-Call-Session-ID', callSessionId)
  }

  return headers
}
