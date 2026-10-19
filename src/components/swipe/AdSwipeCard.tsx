import { translate as t, useLocale } from '../../hooks/useLocale'
import AdSlot from '../AdSlot'

/** Ads remain stationary and mounted; voting gestures never begin over the creative. */
export default function AdSwipeCard({ id, active }: { id: string; active: boolean }) {
  useLocale()
  return <section className="swipe-ad-card" hidden={!active} aria-label={t('Publicidade')}>
    <div className="swipe-ad-interlude">
      <p className="cinema-eyebrow">{t('Publicidade')}</p>
      <AdSlot className="swipe-ad-interlude-full" id={id} adClient="ca-pub-8257200313072326" adSlot="8357155401" width={300} height={250} />
      <AdSlot className="swipe-ad-interlude-compact" id={id + '-compact'} adClient="ca-pub-8257200313072326" adSlot="8357155401" width={300} height={50} />
      <p className="swipe-ad-unavailable" role="status">{t('Publicidade indisponível. Você pode continuar.')}</p>
    </div>
  </section>
}
