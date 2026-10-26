import { useEffect, useState } from 'react'
import { todayISO } from '../lib/birthdate'

export function useCurrentDate() {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    let timer: number
    const refresh = () => {
      window.clearTimeout(timer)
      setToday(todayISO())
      const now = new Date()
      timer = window.setTimeout(refresh, Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime() + 100)
    }
    const onVisible = () => { if (!document.hidden) refresh() }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return today
}
