import { translate as t, useLocale } from '../hooks/useLocale'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const DISMISSED_KEY = 'mm:ads-notice-dismissed:v1'
type Props = { enabled?: boolean }

function wasDismissed() {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
}

/** Best-effort detection is informational: ad failures never gate the session. */
export default function AdblockWall({ enabled = true }: Props) {
  useLocale()
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [unavailable, setUnavailable] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!enabled || dismissed) return
    const bait = document.createElement('div')
    bait.className = 'adsbox ad-banner ad-unit'
    bait.setAttribute('aria-hidden', 'true')
    bait.style.cssText = 'width:1px;height:1px;position:absolute;left:-9999px;pointer-events:none;'
    document.body.appendChild(bait)
    const blocked = () => setUnavailable(true)
    const scriptError = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLScriptElement && target.src.includes('pagead2.googlesyndication.com')) blocked()
    }
    window.addEventListener('error', scriptError, true)
    const timer = window.setTimeout(() => {
      const style = getComputedStyle(bait)
      if (style.display === 'none' || style.visibility === 'hidden' || bait.offsetHeight === 0 || bait.offsetWidth === 0) blocked()
      bait.remove()
    }, 2000)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('error', scriptError, true)
      bait.remove()
    }
  }, [enabled, dismissed])

  function dismiss() {
    // Move keyboard focus back to the session rather than losing it with the notice.
    const keyboardFocus = document.activeElement === closeRef.current
    setDismissed(true)
    try { sessionStorage.setItem(DISMISSED_KEY, '1') } catch { /* In-memory dismissal still works. */ }
    if (keyboardFocus) document.querySelector<HTMLButtonElement>('button[aria-label="Abrir filtros"]')?.focus()
  }

  if (!enabled || dismissed || !unavailable) return null
  return (
    <aside className="mm-ad-notice" aria-label={t("Informação sobre publicidade")}>
      <p role="status">{t("Os anúncios ajudam a manter o MovieMatch gratuito. Se estiverem indisponíveis, você pode continuar normalmente.") + " "}<a href="/ads.html" target="_blank" rel="noreferrer">{t("Saiba mais")}</a></p>
      <button ref={closeRef} type="button" onClick={dismiss} aria-label={t("Dispensar aviso de publicidade")}><X size={16} aria-hidden="true" /></button>
    </aside>
  )
}
