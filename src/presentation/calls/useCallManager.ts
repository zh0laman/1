import { useContext } from 'react'
import {
  CallManagerContext,
  type CallManagerContextValue,
} from './callManagerShared'

export const useCallManager = (): CallManagerContextValue => {
  const context = useContext(CallManagerContext)
  if (!context) {
    throw new Error('useCallManager must be used within CallManagerProvider')
  }

  return context
}
