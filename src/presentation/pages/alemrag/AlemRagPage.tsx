import { useMemo } from 'react'
import AlemAIChat from '../alemai/AlemAIChat'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'

export default function AlemRagPage() {
  const sessionStore = useMemo(() => new LocalStorageAuthSessionStore(), [])
  const accessToken = sessionStore.getTokens()?.accessToken || ''

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <AlemAIChat authToken={accessToken} />
    </div>
  )
}
