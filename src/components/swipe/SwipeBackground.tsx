import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type Point = { x: number; y: number }
const pointOnCurve = (t: number, points: Point[]) => {
  const u = 1 - t
  return {
    x: u ** 3 * points[0].x + 3 * u ** 2 * t * points[1].x + 3 * u * t ** 2 * points[2].x + t ** 3 * points[3].x,
    y: u ** 3 * points[0].y + 3 * u ** 2 * t * points[1].y + 3 * u * t ** 2 * points[2].y + t ** 3 * points[3].y,
  }
}

/** Native, cached rendering of the gateway motif; registered reference sources stay untouched. */
export default function SwipeBackground() {
  const root = useRef<HTMLDivElement>(null)
  const lines = useRef<HTMLCanvasElement>(null)
  const particles = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = root.current, lineCanvas = lines.current, particleCanvas = particles.current
    const lineContext = lineCanvas?.getContext('2d'), ctx = particleCanvas?.getContext('2d')
    if (!container || !lineCanvas || !particleCanvas || !lineContext || !ctx) return
    let width = 0, height = 0, raf = 0, last = 0, elapsed = 0, visible = true, modal = false
    let paths: Point[][] = []
    let bursts: { x: number; y: number; started: number }[] = []
    const paintParticles = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(255,255,255,.65)'
      paths.forEach((path, i) => {
        if (i % 2) return
        const p = pointOnCurve((i * .137 + elapsed * (.07 + i % 5 * .012)) % 1, path)
        for (const burst of bursts) {
          const age = elapsed - burst.started
          const dx = p.x - burst.x, dy = p.y - burst.y, distance = Math.hypot(dx, dy)
          const force = Math.max(0, 1 - Math.abs(distance - age * 900) / 120) * Math.max(0, 1 - age)
          if (distance > 0) { p.x += dx / distance * force * 80; p.y += dy / distance * force * 80 }
        }
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
      })
      bursts = bursts.filter(b => elapsed - b.started < 1)
    }
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / 30) return
      elapsed += Math.min((now - last) / 1000, .1)
      last = now
      paintParticles()
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      const active = visible && !modal && !document.hidden && !reducedMotion
      container.dataset.animated = String(active)
      if (active) { last = performance.now(); raf = requestAnimationFrame(frame) }
    }
    const resize = () => {
      width = container.clientWidth; height = container.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      for (const [canvas, context] of [[lineCanvas, lineContext], [particleCanvas, ctx]] as const) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      paths = Array.from({ length: 64 }, (_, i) => {
        const left = i % 2 === 0, y = i / 64 * height * 1.4 - height * .2
        return [{ x: left ? 0 : width, y }, { x: left ? width * .25 : width * .75, y }, { x: left ? width * .4 : width * .6, y: height / 2 }, { x: width / 2, y: height / 2 }]
      })
      lineContext.strokeStyle = 'rgba(255,255,255,.24)'
      lineContext.lineWidth = 1.2; lineContext.setLineDash([1, 4])
      paths.forEach(p => { lineContext.beginPath(); lineContext.moveTo(p[0].x, p[0].y); lineContext.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y); lineContext.stroke() })
      paintParticles()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container); resize()
    const visibility = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); sync() })
    visibility.observe(container)
    const checkModal = () => {
      const next = !!document.querySelector('dialog[open], [role="dialog"]')
      if (next !== modal) { modal = next; sync() }
    }
    const modals = new MutationObserver(checkModal)
    modals.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] })
    const click = (event: MouseEvent) => {
      if (reducedMotion || modal || document.hidden) return
      const bounds = container.getBoundingClientRect()
      bursts.push({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, started: elapsed })
      bursts = bursts.slice(-3)
    }
    window.addEventListener('click', click)
    document.addEventListener('visibilitychange', sync)
    checkModal(); sync()
    return () => {
      cancelAnimationFrame(raf); resizeObserver.disconnect(); visibility.disconnect(); modals.disconnect()
      window.removeEventListener('click', click); document.removeEventListener('visibilitychange', sync)
    }
  }, [reducedMotion])

  return <div ref={root} className="swipe-background" aria-hidden="true" inert>
    <canvas ref={lines} className="swipe-flow-lines" />
    <canvas ref={particles} className="swipe-flow-particles" />
  </div>
}
