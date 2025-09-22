// src/components/AdSlot.tsx
import { useEffect, useRef, useState } from 'react'

type AdSlotProps = {
  id: string
  className?: string
  width?: number
  height?: number
  // AdSense
  adClient: string          // ex.: 'ca-pub-123...'
  adSlot: string            // ex.: '1234567890'
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal'
  fullWidthResponsive?: boolean
}

export default function AdSlot({
  id,
  className = '',
  width = 160,
  height = 160,
  adClient,
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
}: AdSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const insRef = useRef<HTMLDivElement | null>(null)
  const pushedRef = useRef(false) // evita push duplicado
  declare global { interface Window { adsbygoogle?: any[] } }


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

  useEffect(() => {
  if (!visible || pushedRef.current) return
  const w = window as any
  try {
    (w.adsbygoogle = w.adsbygoogle || []).push({})
    pushedRef.current = true
  } catch (e) {
    // falha silenciosa (ex.: adblock)
  }
}, [visible])


  // Placeholder simpático (house-ad). Depois você pode trocar pelo script do provedor aqui.
  const Inner = (
    <ins
      className="adsbygoogle block overflow-hidden rounded-xl ring-1 ring-white/15 bg-neutral-800/40"
      style={{ width, height }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      ref={insRef as any}
    />
  )
  return (
  <div ref={ref} id={id} className={className} style={{ width, height }}>
    {visible ? Inner : null}
  </div>
)

}
