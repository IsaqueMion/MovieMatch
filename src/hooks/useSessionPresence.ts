import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'

const HEARTBEAT_INTERVAL_MS = 15_000

export function useSessionPresence(
  sessionId: string | null,
  enabled = true,
) {
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!sessionId || !enabled) {
      setOnlineCount(0)
      return
    }

    let cancelled = false
    let running = false

    const touchPresence = async () => {
      if (running) return

      running = true

      try {
        const { data, error } = await supabase.rpc(
          'touch_session_presence',
          {
            p_session_id: sessionId,
          },
        )

        if (cancelled) return

        if (error) {
          console.warn(
            'presence heartbeat failed:',
            error,
          )
          return
        }

        const count = Number(data)

        if (Number.isFinite(count)) {
          setOnlineCount(Math.max(0, count))
        }
      } finally {
        running = false
      }
    }

    const refresh = () => {
      void touchPresence()
    }

    void touchPresence()

    const intervalId = window.setInterval(
      refresh,
      HEARTBEAT_INTERVAL_MS,
    )

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    window.addEventListener('focus', refresh)
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [sessionId, enabled])

  return onlineCount
}
