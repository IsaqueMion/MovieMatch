import { useEffect, useId, useMemo, useRef, useState, type ComponentProps } from 'react'

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
    steps.push(`${(progress * 100).toFixed(2)}%{transform:translate3d(${(direction * rail * rasterRatio).toFixed(2)}cqw,0,${depth.toFixed(2)}cqw) rotateY(${(-direction * turn).toFixed(2)}deg)}`)
  }
  return `@keyframes ${name}{${steps.join('')}}`
}

export type StreamImage = { src: string; alt?: string }
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
    const observer = typeof IntersectionObserver !== 'undefined' && element
      ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
      : null
    if (element) observer?.observe(element)
    const updateVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  return (
    <div ref={rootRef} className={`image-stream-hero ${className}`} {...props} style={{ containerType: 'inline-size', ...style }}>
      <style>{css}</style>
      <div aria-hidden="true" className="image-stream-corridor" style={{ perspective: `${geometry.perspective}cqw`, perspectiveOrigin: `50% ${axis}%` }}>
        <div className="image-stream-rails">
          {[right, left].map((name, railIndex) => Array.from({ length: count }, (_, index) => {
            const image = uniqueImages[railIndex * count + index]
            return (
              <div key={`${name}-${index}`} className={`image-stream-card ${cardClass}`} style={{
                left: '50%', top: `${axis}%`, width: `${rasterWidth}cqw`, height: `${rasterHeight}cqw`,
                marginLeft: `${-rasterWidth / 2}cqw`, marginTop: `${-rasterHeight / 2}cqw`,
                borderRadius: `${geometry.cardRadius * rasterHeight / geometry.cardHeight}cqw`, animation: `${name} ${duration}s linear infinite`,
                animationDelay: `${-(index * duration) / count}s`, animationPlayState: paused || !visible || !pageVisible ? 'paused' : 'running',
                backfaceVisibility: 'hidden',
              }}>
                {image ? <picture>
                  {image.src.startsWith('https://image.tmdb.org/t/p/w500/') ? <>
                    <source media="(min-width: 1024px) and (min-resolution: 1.5dppx)" srcSet={image.src.replace('/w500/', '/original/')} />
                    <source media="(max-width: 639px) and (max-resolution: 2dppx)" srcSet={image.src} />
                  </> : null}
                  <img src={image.src.replace('https://image.tmdb.org/t/p/w500/', 'https://image.tmdb.org/t/p/w780/')} alt="" width={780} height={1170} decoding="async" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
                </picture> : null}
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
