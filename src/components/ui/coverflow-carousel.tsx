import { translate as t, useLocale } from '../../hooks/useLocale'
import { usePrefersReducedMotion as useReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import '../../styles/coverflow.css'

export interface CoverflowSlide {
  id: string | number
  src: string | null
  alt: string
  title?: string
  subtitle?: string
  meta?: { label: string; value: string }[]
}
export interface CoverflowCarouselProps {
  slides: CoverflowSlide[]
  rotate?: number
  depth?: number
  perspective?: number
  falloff?: number
  fade?: number
  cardWidth?: string
  gap?: number
  loop?: boolean
  label?: string
  className?: string
  showNavigation?: boolean
  showCaption?: boolean
  renderSlide?: (slide: CoverflowSlide, index: number, active: boolean) => ReactNode
  renderCaption?: (slide: CoverflowSlide, index: number) => ReactNode
  onActivate?: (index: number) => void
}

/** Adapted from the supplied coverflow reference for vertical cinema posters. */
export function CoverflowCarousel({ slides, rotate = 44, depth = .6, perspective = 3, falloff = .56, fade = .1, cardWidth = 'clamp(168px, 22vw, 260px)', gap = .05, loop = true, label = 'Filmes do grupo', className = '', showNavigation = true, showCaption = true, renderSlide, renderCaption, onActivate }: CoverflowCarouselProps) {
  useLocale()
  const count = slides.length
  // Two items cannot form a ring without teleporting a visible neighbour.
  const isLooping = loop && count > 2
  const reducedMotion = useReducedMotion()
  const frameId = useId()
  const frameRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const widthRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const dragRef = useRef<{ id: number; x: number; pos: number; v: number; t: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [selected, setSelected] = useState(0)
  const indexAt = useCallback((pos: number) => count ? ((Math.round(pos) % count) + count) % count : 0, [count])
  const clamp = useCallback((pos: number) => isLooping ? pos : Math.max(0, Math.min(count - 1, pos)), [count, isLooping])

  const paint = useCallback(() => {
    const width = widthRef.current
    if (!width || !count) return
    const pitch = width * (1 + gap)
    cardRefs.current.forEach((card, index) => {
      if (!card || index >= count) return
      let offset = index - posRef.current
      if (isLooping) {
        offset = ((offset % count) + count) % count
        if (offset > count / 2) offset -= count
      }
      const distance = Math.abs(offset)
      const ramp = Math.pow(distance, falloff)
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset)
      card.style.transform = `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`
      const edge = isLooping ? Math.min(1, Math.max(0, count / 2 - distance)) : 1
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge)
      card.style.zIndex = String(100 - Math.round(distance))
      // Distant cards cannot intercept a click intended for a visible poster.
      card.style.pointerEvents = distance < 3 ? 'auto' : 'none'
    })
  }, [count, depth, fade, falloff, gap, isLooping, rotate])

  const settle = useCallback((target: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    targetRef.current = target
    setSelected(indexAt(target))
    if (reducedMotion) { posRef.current = target; paint(); return }
    const step = () => {
      const remaining = target - posRef.current
      if (Math.abs(remaining) < .0004) { posRef.current = target; paint(); rafRef.current = null; return }
      posRef.current += remaining * .16
      paint()
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [indexAt, paint, reducedMotion])
  const goTo = useCallback((index: number) => {
    const target = isLooping ? index + Math.round((targetRef.current - index) / count) * count : index
    settle(clamp(target))
  }, [clamp, count, isLooping, settle])
  const nudge = (by: number) => settle(clamp(Math.round(targetRef.current) + by))

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => { widthRef.current = cardRefs.current[0]?.offsetWidth ?? 0; paint() }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [paint])
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])
  useEffect(() => {
    if (!reducedMotion || rafRef.current === null) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    posRef.current = targetRef.current
    paint()
  }, [reducedMotion, paint])
  // Realtime can remove a selected match. Never leave the position outside the list.
  useLayoutEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    dragRef.current = null
    const next = Math.min(indexAt(targetRef.current), Math.max(0, count - 1))
    posRef.current = next
    targetRef.current = next
    paint()
  }, [count, indexAt, paint])

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (count < 2 || event.button !== 0) return
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    suppressClick.current = false
    targetRef.current = posRef.current
    dragRef.current = { id: event.pointerId, x: event.clientX, pos: posRef.current, v: 0, t: performance.now(), moved: false }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const pitch = widthRef.current * (1 + gap)
    if (!pitch) return
    if (!drag.moved && Math.abs(event.clientX - drag.x) < 6) return
    if (!drag.moved) { event.currentTarget.setPointerCapture(event.pointerId); drag.moved = true }
    suppressClick.current = true
    const now = performance.now()
    const previous = posRef.current
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch)
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000
    drag.t = now
    paint()
  }
  function endDrag(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!drag.moved) return
    const carried = cancelled || performance.now() - drag.t > 100 ? 0 : Math.max(-2, Math.min(2, drag.v * .18))
    settle(clamp(Math.round(posRef.current + carried)))
  }
  const activeIndex = Math.min(selected, Math.max(0, count - 1))
  const active = slides[activeIndex]
  if (!active) return null

  return <div className={`coverflow-carousel ${className}`} style={{ '--cf-card': cardWidth } as CSSProperties} role="region" aria-roledescription="carrossel" aria-label={label}>
    <div className="coverflow-stage">
      <div id={frameId} className="coverflow-frame" ref={frameRef} tabIndex={count > 1 ? 0 : -1} aria-label={t("Use as setas para escolher um filme")} style={{ perspective: `calc(var(--cf-card) * ${perspective})`, touchAction: 'pan-y' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => endDrag(event)} onPointerCancel={event => endDrag(event, true)} onClickCapture={event => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
      }} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || count < 2) return
        event.preventDefault()
        frameRef.current?.focus({ preventScroll: true })
        if (event.key === 'Home') goTo(0)
        else if (event.key === 'End') goTo(count - 1)
        else nudge(event.key === 'ArrowLeft' ? -1 : 1)
      }}>
        <div className="coverflow-track">
          {slides.map((slide, index) => <div key={slide.id} ref={node => { cardRefs.current[index] = node }} className="coverflow-card" role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${count}`} aria-hidden={index !== activeIndex}>
            <button type="button" className="coverflow-open matches-spotlight-poster" aria-label={index === activeIndex ? t("Ver detalhes de {0}", [slide.title]) : `Selecionar ${slide.title}`} tabIndex={index === activeIndex ? 0 : -1} onClick={() => index === activeIndex ? onActivate?.(index) : goTo(index)}>
              {renderSlide ? renderSlide(slide, index, index === activeIndex) : <img src={slide.src || ''} alt={slide.alt} width={500} height={750} draggable={false} loading={Math.abs(index - activeIndex) <= 2 ? 'eager' : 'lazy'} />}
            </button>
          </div>)}
        </div>
      </div>
      {showNavigation && count > 1 ? <div className="coverflow-navigation"><button type="button" aria-label={t("Filme anterior")} aria-controls={frameId} onClick={() => nudge(-1)} disabled={!isLooping && activeIndex === 0}><ChevronLeft size={20} aria-hidden="true" /></button><span aria-hidden="true">{String(activeIndex + 1).padStart(2, '0')} <i>/</i> {String(count).padStart(2, '0')}</span><button type="button" aria-label={t("Próximo filme")} aria-controls={frameId} onClick={() => nudge(1)} disabled={!isLooping && activeIndex === count - 1}><ChevronRight size={20} aria-hidden="true" /></button></div> : null}
    </div>
    <p className="sr-only" role="status" aria-live="polite">{t("Filme") + " "}{activeIndex + 1}{" " + t("de") + " "}{count}: {active.title}</p>
    {showCaption ? <div className="coverflow-caption">{renderCaption ? renderCaption(active, activeIndex) : <><h3>{active.title}</h3><p>{active.subtitle}</p>{active.meta?.length ? <dl>{active.meta.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : null}</>}</div> : null}
  </div>
}
