import { translate as t, useLocale } from '../hooks/useLocale'
import { useEffect, useState } from 'react'
import { HeartHandshake } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { AlertCard } from './ui/alert-card'
import '../styles/adblock-notice.css'

type Props = { enabled?: boolean }

// shortcut: Network-only blockers are not detected; expand only with reliable evidence beyond failed ad requests.
export default function AdblockWall({ enabled = true }: Props) {
  useLocale()
  const { pathname } = useLocation()
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const [blockedAt, setBlockedAt] = useState<string | null>(null)
  const dismissed = dismissedAt === pathname

  useEffect(() => {
    if (!enabled || dismissed) return
    const bait = document.createElement('div'), control = document.createElement('div')
    bait.className = 'adsbox ad-banner ad-unit'
    for (const element of [bait, control]) {
      element.setAttribute('aria-hidden', 'true')
      element.style.cssText = 'width:1px;height:1px;position:absolute;left:-9999px;pointer-events:none;'
      document.body.appendChild(element)
    }
    const check = () => {
      const style = getComputedStyle(bait), controlStyle = getComputedStyle(control)
      const controlVisible = control.isConnected && control.offsetHeight > 0 && control.offsetWidth > 0 && controlStyle.visibility !== 'hidden'
      const suppressed = !bait.isConnected || style.display === 'none' || style.visibility === 'hidden' || bait.offsetHeight === 0 || bait.offsetWidth === 0
      setBlockedAt(controlVisible && suppressed ? pathname : null)
    }
    const visible = () => { if (!document.hidden) check() }
    const timer = window.setTimeout(check, 2000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', visible)
      bait.remove(); control.remove()
    }
  }, [enabled, dismissed, pathname])

  function dismiss() {
    const keyboardFocus = document.activeElement?.closest('.adblock-notice')
    setDismissedAt(pathname)
    if (keyboardFocus) document.querySelector<HTMLButtonElement>('.cinema-vote-button.is-like:not(:disabled), .swipe-header button:not(:disabled)')?.focus()
  }

  return <AlertCard isVisible={enabled && !dismissed && blockedAt === pathname} icon={<HeartHandshake size={23} />}
    title={t('Ajude a manter o MovieMatch gratuito')}
    description={t('Parece que seu bloqueador está ocultando os anúncios. Se puder, desative-o neste site para apoiar o projeto. Você pode continuar votando normalmente.')}
    buttonText={t('Continuar votando')} dismissLabel={t('Dispensar aviso de publicidade')} onDismiss={dismiss} />
}
