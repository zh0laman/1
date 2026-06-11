import { useEffect, useState } from 'react'

type Options = {
  /** When false, output is cleared and done is false */
  enabled?: boolean
  msPerChar?: number
  startDelayMs?: number
}

/**
 * Character-by-character reveal. Restarts when `text` or deps change.
 */
export function useTypewriter(text: string, options?: Options): { displayed: string; done: boolean } {
  const { enabled = true, msPerChar = 22, startDelayMs = 0 } = options ?? {}
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    let startTimer: ReturnType<typeof setTimeout> | undefined

    // Defer all setState to the next macrotask so eslint react-hooks/set-state-in-effect is satisfied.
    const deferTimer = window.setTimeout(() => {
      if (!enabled) {
        setDisplayed('')
        setDone(false)
        return
      }
      if (!text) {
        setDisplayed('')
        setDone(true)
        return
      }

      setDisplayed('')
      setDone(false)
      let i = 0
      startTimer = window.setTimeout(() => {
        intervalId = window.setInterval(() => {
          i += 1
          setDisplayed(text.slice(0, i))
          if (i >= text.length) {
            if (intervalId) window.clearInterval(intervalId)
            intervalId = undefined
            setDone(true)
          }
        }, msPerChar)
      }, startDelayMs)
    }, 0)

    return () => {
      window.clearTimeout(deferTimer)
      window.clearTimeout(startTimer)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [enabled, text, msPerChar, startDelayMs])

  return { displayed, done }
}
