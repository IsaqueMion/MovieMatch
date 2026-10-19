import { translate as t, useLocale } from '../../hooks/useLocale'
import AdSlot from '../AdSlot'
import { useRef, type PointerEvent } from 'react'
import { swipeDirection } from './swipeMotion'

/** Ads remain stationary and mounted; voting gestures never begin over the creative. */
export default function AdSwipeCard({ id, active, onAdvance, onDragState }: { id: string; active: boolean; onAdvance: (direction: 1 | -1) => void; onDragState: (dragging: boolean) => void }) {
  useLocale()
  const drag = useRef<{ id: number; x: number; y: number; started: number } | null>(null)
  function cancel() { drag.current = null; onDragState(false) }
  function end(event: PointerEvent<HTMLElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    cancel()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const x = event.clientX - start.x, y = event.clientY - start.y
    const direction = Math.abs(x) >= 12 && Math.abs(x) > Math.abs(y) ? swipeDirection(x, x * 1000 / Math.max(1, performance.now() - start.started)) : null
    if (direction !== null) onAdvance(direction)
  }
  return <section className="swipe-ad-card" hidden={!active} aria-label={t('Publicidade')} onPointerDown={event => {
    // The creative keeps its own clicks and gestures; swiping starts on the surrounding frame.
    if (!active || drag.current || !event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('iframe,ins,[id^="ad-interlude-"],button,a')) return
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now() }
    event.currentTarget.setPointerCapture(event.pointerId); onDragState(true)
  }} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}>
    <div className="swipe-ad-interlude">
      <p className="cinema-eyebrow">{t('Publicidade')}</p>
      <AdSlot className="swipe-ad-interlude-full" id={id} adClient="ca-pub-8257200313072326" adSlot="8357155401" width={300} height={250} />
      <AdSlot className="swipe-ad-interlude-compact" id={id + '-compact'} adClient="ca-pub-8257200313072326" adSlot="8357155401" width={300} height={50} />
      <p className="swipe-ad-unavailable" role="status">{t('Publicidade indisponível. Você pode continuar.')}</p>
      <p className="swipe-ad-hint">{t('Deslize ou use os botões para continuar.')}</p>
    </div>
  </section>
}
