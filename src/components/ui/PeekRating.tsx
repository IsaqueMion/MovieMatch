// React Bits PeekRating, adapted from the source supplied with the design request.
// Portuguese labels, native disabled controls and assistive-technology clicks.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent, type KeyboardEvent } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { FavouriteIcon, FlashIcon, StarIcon } from '@hugeicons/core-free-icons'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export type PeekRatingShape = 'star' | 'heart' | 'bolt'
export interface PeekRatingProps {
  value?: number; defaultValue?: number; onChange?: (value: number) => void
  onPreview?: (value: number | null) => void; count?: number; shape?: PeekRatingShape
  icon?: ReactNode; labels?: string[]; activeColor?: string; idleColor?: string
  tipColor?: string; tipTextColor?: string; size?: number; lift?: number; magnify?: number
  riseDuration?: number; popScale?: number; showTip?: boolean; allowClear?: boolean
  readOnly?: boolean; disabled?: boolean; ariaLabel?: string; className?: string
}
interface GestureState { hover: number | null; pressing: boolean; pointerId: number | null; settled: boolean; rect: DOMRect | null; rtl: boolean }
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const SHAPES: Record<PeekRatingShape, IconSvgElement> = { star: StarIcon, heart: FavouriteIcon, bolt: FlashIcon }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function PeekRating({ value: valueProp, defaultValue = 0, onChange, onPreview, count = 5, shape = 'star', icon, labels = [], activeColor = '#f5b400', idleColor = '#52525b', tipColor = '#27272a', tipTextColor = '#f5f5f5', size = 28, lift = 6, magnify = 1.15, riseDuration = 320, popScale = 1.3, showTip = true, allowClear = true, readOnly = false, disabled = false, ariaLabel = 'Sua nota', className = '' }: PeekRatingProps) {
  const [inner, setInner] = useState(defaultValue)
  const value = clamp(valueProp ?? inner, 0, count)
  const interactive = !readOnly && !disabled
  const still = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null), rowRef = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLSpanElement>(null)
  const starEls = useRef<(HTMLElement | null)[]>([]), liftEls = useRef<(HTMLSpanElement | null)[]>([]), glyphEls = useRef<(HTMLSpanElement | null)[]>([])
  const st = useRef<GestureState>({ hover: null, pressing: false, pointerId: null, settled: false, rect: null, rtl: false })

  const paint = () => {
    const { hover, settled, rtl } = st.current
    const previewing = interactive && hover !== null && !settled
    const shown = previewing ? hover + 1 : value
    for (let i = 0; i < count; i++) {
      const liftEl = liftEls.current[i], glyphEl = glyphEls.current[i]
      if (!liftEl || !glyphEl) continue
      const lifted = previewing && !still && i <= hover
      liftEl.style.transform = lifted ? `translateY(${-lift}px) scale(${i === hover ? magnify : 1})` : 'translateY(0px) scale(1)'
      glyphEl.dataset.lit = String(i < shown)
    }
    const tip = tipEl.current
    if (!tip) return
    if (previewing && showTip) {
      const slot = rowRef.current ? rowRef.current.clientWidth / count : size
      const visual = rtl ? count - 1 - hover : hover
      const wasHidden = tip.dataset.show !== 'true'
      if (wasHidden) tip.style.transition = 'none'
      tip.textContent = labels[hover] ?? String(hover + 1)
      tip.style.transform = `translate(calc(${slot * (visual + .5)}px - 50%), 0)`
      if (wasHidden) { void tip.offsetWidth; tip.style.transition = '' }
      tip.dataset.show = 'true'
    } else tip.dataset.show = 'false'
  }
  useLayoutEffect(paint)
  const setHover = (index: number | null) => {
    if (index === st.current.hover) return
    st.current.hover = index
    if (index !== null) st.current.settled = false
    paint(); onPreview?.(index === null ? null : index + 1)
  }
  const setHoverRef = useRef(setHover)
  setHoverRef.current = setHover
  const measure = () => {
    const row = rowRef.current
    if (!row) return
    st.current.rect = row.getBoundingClientRect(); st.current.rtl = getComputedStyle(row).direction === 'rtl'
  }
  const indexAt = (x: number, y: number): number | null => {
    const { rect, pressing, rtl } = st.current
    if (!rect || !rect.width || (pressing && (y < rect.top - size || y > rect.bottom + size))) return null
    const index = clamp(Math.floor(((x - rect.left) / rect.width) * count), 0, count - 1)
    return rtl ? count - 1 - index : index
  }
  const commit = (next: number, pop = true) => {
    if (valueProp === undefined) setInner(next)
    onChange?.(next); st.current.settled = true; paint()
    const glyph = glyphEls.current[next - 1]
    if (pop && next > 0 && popScale > 1 && glyph && typeof glyph.animate === 'function' && !still) {
      glyph.getAnimations().forEach(animation => animation.cancel())
      glyph.animate([{ transform: 'scale(1)', easing: EASE_OUT }, { transform: `scale(${popScale})`, offset: .35, easing: EASE_OUT }, { transform: 'scale(1)' }], { duration: 300 })
    }
  }
  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== 'mouse') return
    rootRef.current?.removeAttribute('data-instant'); measure()
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0 || st.current.pointerId !== null) return
    rootRef.current?.removeAttribute('data-instant')
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Unsupported capture falls back to pointer events. */ }
    st.current.pointerId = event.pointerId; st.current.pressing = true; measure(); setHover(indexAt(event.clientX, event.clientY))
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return
    const { pressing, pointerId } = st.current
    if ((event.pointerType !== 'mouse' && !pressing) || (pressing && event.pointerId !== pointerId)) return
    if (!pressing && !st.current.rect) measure()
    setHover(indexAt(event.clientX, event.clientY))
  }
  const endPress = (event: PointerEvent<HTMLDivElement>) => {
    const { pressing, pointerId, hover } = st.current
    if (!pressing || event.pointerId !== pointerId) return
    st.current.pressing = false; st.current.pointerId = null
    if (interactive && event.type === 'pointerup' && hover !== null) {
      const next = hover + 1; commit(allowClear && next === value ? 0 : next)
    }
    if (event.pointerType !== 'mouse') setHover(null)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    const min = allowClear ? 0 : 1
    const current = value || Math.max(1, starEls.current.indexOf(event.target as HTMLElement) + 1)
    let next: number
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': next = clamp(current + 1, min, count); break
      case 'ArrowLeft': case 'ArrowDown': next = clamp(current - 1, min, count); break
      case 'Home': next = 1; break
      case 'End': next = count; break
      case 'Backspace': case 'Delete': if (!allowClear) return; next = 0; break
      case ' ': case 'Enter': {
        const index = starEls.current.indexOf(event.target as HTMLElement)
        if (index === -1) return
        next = allowClear && index + 1 === value ? 0 : index + 1; break
      }
      default: return
    }
    event.preventDefault(); event.stopPropagation(); rootRef.current?.setAttribute('data-instant', 'true'); st.current.hover = null
    commit(next, false); starEls.current[Math.max(next, 1) - 1]?.focus()
  }
  useEffect(() => {
    const reset = () => { st.current.pressing = false; st.current.pointerId = null; setHoverRef.current(null) }
    const onVisibility = () => { if (document.hidden) reset() }
    const glyphs = glyphEls.current
    document.addEventListener('visibilitychange', onVisibility); window.addEventListener('blur', reset)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', reset); glyphs.forEach(glyph => glyph?.getAnimations().forEach(animation => animation.cancel())) }
  }, [])
  useEffect(() => { if (still) glyphEls.current.forEach(glyph => glyph?.getAnimations().forEach(animation => animation.cancel())) }, [still])
  const Slot = readOnly ? 'span' : 'button'
  const tipRoom = interactive && showTip ? Math.round(size * .9) : 0
  const vars = { '--pr-active': activeColor, '--pr-idle': idleColor, '--pr-tip': tipColor, '--pr-tip-text': tipTextColor, '--pr-size': `${size}px`, '--pr-gap': `${Math.round(size * .22)}px`, '--pr-room': `${lift + tipRoom}px`, '--pr-rise': `${riseDuration}ms`, '--pr-ease-out': EASE_OUT } as CSSProperties
  return <div ref={rootRef} role={readOnly ? 'img' : 'radiogroup'} aria-label={readOnly ? `${value} de ${count} estrelas` : ariaLabel} aria-disabled={disabled || undefined} className={`peek-rating group inline-flex font-[inherit] text-inherit aria-disabled:pointer-events-none aria-disabled:opacity-50 ${className}`} style={vars} onKeyDown={readOnly ? undefined : handleKeyDown}>
    <div ref={rowRef} className="relative inline-flex touch-pan-y select-none items-end pt-[var(--pr-room)] [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]" onPointerEnter={handlePointerEnter} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endPress} onPointerCancel={endPress} onLostPointerCapture={endPress} onPointerLeave={() => { if (!st.current.pressing) setHover(null) }}>
      {interactive && showTip ? <span ref={tipEl} className="peek-rating-tip pointer-events-none absolute left-0 top-0 inline-flex h-[calc(var(--pr-size)*0.6)] items-center whitespace-nowrap rounded-full px-[calc(var(--pr-size)*0.3)] text-[length:calc(var(--pr-size)*0.38)] font-semibold leading-none tracking-[0.01em] opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.18)] [background:var(--pr-tip)] [color:var(--pr-tip-text)] [transition:transform_var(--pr-rise)_var(--pr-ease-out),opacity_180ms_ease] data-[show=true]:opacity-100 group-data-[instant=true]:[transition-duration:0ms] motion-reduce:transition-none" aria-hidden="true" /> : null}
      {Array.from({ length: count }, (_, i) => {
        const checked = value === i + 1
        return <Slot key={i} ref={el => { starEls.current[i] = el }} type={readOnly ? undefined : 'button'} disabled={readOnly ? undefined : disabled} className="m-0 grid min-h-11 min-w-11 h-[calc(var(--pr-size)_+_8px)] w-[calc(var(--pr-size)_+_var(--pr-gap))] touch-manipulation place-items-center border-0 bg-transparent p-0 font-[inherit] text-inherit outline-none [@media(hover:hover)_and_(pointer:fine)]:cursor-pointer focus-visible:rounded-md focus-visible:outline-offset-2 focus-visible:[outline:2px_solid_var(--pr-active)]" role={readOnly ? undefined : 'radio'} aria-checked={readOnly ? undefined : checked} aria-label={readOnly ? undefined : `${i + 1} de ${count} estrelas`} title={labels[i]} aria-hidden={readOnly || undefined} tabIndex={!interactive ? -1 : (value === 0 ? i === 0 : checked) ? 0 : -1} onClick={readOnly ? undefined : event => { if (interactive && event.detail === 0) commit(allowClear && checked ? 0 : i + 1) }}>
          <span ref={el => { liftEls.current[i] = el }} className="block origin-bottom [transition:transform_var(--pr-rise)_var(--pr-ease-out)] group-data-[instant=true]:[transition-duration:0ms] motion-reduce:transition-none"><span ref={el => { glyphEls.current[i] = el }} className="peek-rating-glyph block h-[var(--pr-size)] w-[var(--pr-size)] text-[var(--pr-idle)] [transition:color_160ms_ease] data-[lit=true]:text-[var(--pr-active)] group-data-[instant=true]:[transition-duration:0ms] [&>svg]:block [&>svg]:h-full [&>svg]:w-full">{icon ?? <HugeiconsIcon icon={SHAPES[shape]} size={size} fill="currentColor" strokeWidth={1.5} />}</span></span>
        </Slot>
      })}
    </div>
  </div>
}
