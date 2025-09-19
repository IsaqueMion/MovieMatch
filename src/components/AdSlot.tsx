// src/components/AdSlot.tsx
import { useEffect, useRef, useState } from 'react'

type AdSlotProps = {
  id: string
  href?: string
  imgSrc?: string
  className?: string
  // dica de tamanho; você pode ajustar por CSS fora também
  width?: number
  height?: number
}

export default function AdSlot({
  id,
  href,
  imgSrc,
  className = '',
  width = 160,
  height = 160,
}: AdSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  // Lazy render quando entrar na viewport
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setVisible(true)
      })
    }, { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Placeholder simpático (house-ad). Depois você pode trocar pelo script do provedor aqui.
  const Inner = (
    <div
      className="rounded-xl ring-1 ring-white/15 bg-gradient-to-br from-neutral-800 to-neutral-700 overflow-hidden shadow"
      style={{ width, height }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt="Ad" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-white/50">Anúncio</div>
            <div className="mt-1 text-white/80 text-sm">Seu banner aqui</div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div ref={ref} id={id} className={className} style={{ width, height }}>
      {visible ? (href ? <a href={href} target="_blank" rel="noreferrer noopener">{Inner}</a> : Inner) : null}
    </div>
  )
}
