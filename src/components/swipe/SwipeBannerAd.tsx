import { useState } from 'react'
import { X } from 'lucide-react'
import { translate as t, useLocale } from '../../hooks/useLocale'
import AdSlot from '../AdSlot'

export default function SwipeBannerAd({ sessionId }: { sessionId: string }) {
  useLocale()
  const key = 'mm:banner-dismissed:' + sessionId
  const [closed, setClosed] = useState(() => {
    try { return sessionStorage.getItem(key) === '1' } catch { return false }
  })
  if (closed) return null
  return <aside className="swipe-mobile-ad" aria-label={t('Publicidade')}>
    <header><span>{t('Publicidade')}</span><button type="button" aria-label={t('Fechar anúncio do topo')} onClick={() => {
      setClosed(true)
      try { sessionStorage.setItem(key, '1') } catch { /* Closing still works in memory. */ }
      document.querySelector<HTMLButtonElement>('.cinema-vote-button.is-like')?.focus({ preventScroll: true })
    }}><X size={16} aria-hidden="true" /></button></header>
    <AdSlot id={'ad-mobile-' + sessionId} adClient="ca-pub-8257200313072326" adSlot="8357155401" width={300} height={50} />
  </aside>
}
