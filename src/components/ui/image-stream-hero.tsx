import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react'
import { PosterImage } from './poster-image'
import { observeElementResize } from '../../lib/browserEvents'

export type CorridorPath = {
  perspective?: number
  cardWidth?: number
  cardHeight?: number
  cardRadius?: number
  birthHeight?: number
  exitHeight?: number
  railBirth?: number
  railExit?: number
  fan?: number
  turnBirth?: number
  turnExit?: number
  stops?: number
}

const DEFAULT_PATH: Required<CorridorPath> = {
  perspective: 30, cardWidth: 18, cardHeight: 27, cardRadius: 0.4,
  birthHeight: 2.6, exitHeight: 46, railBirth: -11, railExit: 44,
  fan: 3.3, turnBirth: 6, turnExit: 28, stops: 24,
}

function keyframes(direction: 1 | -1, name: string, path: Required<CorridorPath>) {
  // Rasterize at the largest visible size, then project down. This avoids
  // magnifying the browser's small composited texture as a card approaches.
  const rasterHeight = Math.max(path.cardHeight, path.exitHeight) * 1.1
  const rasterRatio = rasterHeight / path.cardHeight
  const steps: string[] = []
  for (let step = 0; step <= path.stops; step++) {
    const progress = step / path.stops
    const scale = (path.birthHeight / rasterHeight) * Math.pow(path.exitHeight / path.birthHeight, progress)
    const depth = path.perspective * (1 - 1 / scale)
    const rail = path.railExit - (path.railExit - path.railBirth) * Math.pow(1 - progress, path.fan)
    const turn = path.turnBirth + (path.turnExit - path.turnBirth) * progress
    steps.push(`${(progress * 100).toFixed(2)}%{transform:translate3d(calc(${(direction * rail * rasterRatio).toFixed(2)} * var(--image-stream-unit)),0,calc(${depth.toFixed(2)} * var(--image-stream-unit))) rotateY(${(-direction * turn).toFixed(2)}deg)}`)
  }
  return `@keyframes ${name}{${steps.join('')}}`
}

export type StreamImage = { src: string; alt?: string; preview?: string }
export type ImageStreamHeroProps = ComponentProps<'div'> & {
  images: StreamImage[]
  cards?: number
  speed?: number
  axis?: number
  path?: CorridorPath
  paused?: boolean
}

/** Adapted from the user's ImageStreamHero reference, with 2:3 posters. */
export function ImageStreamHero({ images, cards = 9, speed = 24, axis = 57, path, paused = false, children, className = '', style, ...props }: ImageStreamHeroProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)
  const right = `ish-r-${id}`
  const left = `ish-l-${id}`
  const cardClass = `ish-c-${id}`
  const geometry = useMemo(() => ({ ...DEFAULT_PATH, ...path }), [path])
  const rasterHeight = Math.max(geometry.cardHeight, geometry.exitHeight) * 1.1
  const rasterWidth = rasterHeight * geometry.cardWidth / geometry.cardHeight
  const uniqueImages = useMemo(() => [...new Map(images.map(image => [image.src, image])).values()], [images])
  const count = Math.max(0, Math.min(24, Math.floor(cards), Math.floor(uniqueImages.length / 2)))
  const duration = Math.max(1, speed)
  const css = useMemo(() => `${keyframes(1, right, geometry)}${keyframes(-1, left, geometry)}@media(prefers-reduced-motion:reduce){.${cardClass}{animation-play-state:paused!important}}`, [right, left, cardClass, geometry])

  useEffect(() => {
    const element = rootRef.current
    let stopSizing: (() => void) | undefined
    if (element && (typeof CSS === 'undefined' || !CSS.supports('width', '1cqw'))) {
      const measure = () => element.style.setProperty('--image-stream-unit', `${element.clientWidth / 100}px`)
      measure()
      stopSizing = observeElementResize(element, measure)
    }
    const observer = typeof IntersectionObserver !== 'undefined' && element
      ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
      : null
    if (element) observer?.observe(element)
    const updateVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      observer?.disconnect()
      stopSizing?.()
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  return (
    <div ref={rootRef} className={`image-stream-hero ${className}`} {...props} style={{ '--image-stream-unit': '1cqw', containerType: 'inline-size', ...style } as CSSProperties}>
      <style>{css}</style>
      <div aria-hidden="true" className="image-stream-corridor" style={{ perspective: `calc(${geometry.perspective} * var(--image-stream-unit))`, perspectiveOrigin: `50% ${axis}%` }}>
        <div className="image-stream-rails">
          {[right, left].map((name, railIndex) => Array.from({ length: count }, (_, index) => {
            const image = uniqueImages[railIndex * count + index]
            return (
              <div key={`${name}-${index}`} className={`image-stream-card ${cardClass}`} style={{
                left: '50%', top: `${axis}%`, width: `calc(${rasterWidth} * var(--image-stream-unit))`, height: `calc(${rasterHeight} * var(--image-stream-unit))`,
                marginLeft: `calc(${-rasterWidth / 2} * var(--image-stream-unit))`, marginTop: `calc(${-rasterHeight / 2} * var(--image-stream-unit))`,
                borderRadius: `calc(${geometry.cardRadius * rasterHeight / geometry.cardHeight} * var(--image-stream-unit))`, animation: `${name} ${duration}s linear infinite`,
                animationDelay: `${-(index * duration) / count}s`, animationPlayState: paused || !visible || !pageVisible ? 'paused' : 'running',
                backfaceVisibility: 'hidden',
              }}>
                {image ? <PosterImage key={image.src} src={image.src} preview={image.preview} alt="" corridor priority={index === count - 2 || index === count - 3} /> : null}
              </div>
            )
          }))}
        </div>
      </div>
      {children}
    </div>
  )
}

export default ImageStreamHero
