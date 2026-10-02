import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDemoSession(sessionId: string | null) {
  const [demoId, setDemoId] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (sessionId) void supabase.rpc('is_demo_session', { p_session_id: sessionId }).then(({ data, error }) => {
      if (active) setDemoId(!error && data === true ? sessionId : null)
    })
    return () => { active = false }
  }, [sessionId])
  return !!sessionId && demoId === sessionId
}
