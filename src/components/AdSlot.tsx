// src/components/AdSlot.tsx
import { useEffect, useRef, useState } from 'react'



declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}
let adsenseLoading: Promise<void> | null = null
function ensureAdsense(client: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // já existe?
  const existing = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]') as HTMLScriptElement | null
  if (existing) return Promise.resolve()
  if (adsenseLoading) return adsenseLoading

  adsenseLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    s.setAttribute('crossorigin', 'anonymous')
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('adsense load error'))
    document.head.appendChild(s)
  })
  return adsenseLoading
}

type AdSlotProps = {
  id: string
  className?: string
  width?: number
  height?: number
  // AdSense (opcional até aprovar)
  adClient?: string
  adSlot?: string
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal'
  fullWidthResponsive?: boolean
  // Fallback (house-ad)
  fallbackHref?: string
  fallbackImgSrc?: string
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
  fallbackHref,
  fallbackImgSrc,
}: AdSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const insRef = useRef<HTMLDivElement | null>(null)
  const pushedRef = useRef(false) // evita push duplicado

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
      if (!visible) return

      // sem IDs? vai direto para o fallback
      if (!adClient || !adSlot) { setUseFallback(true); return }

      // carrega a tag do AdSense sob demanda
      ensureAdsense(adClient)
        .then(() => {
          try {
            if (!pushedRef.current) {
              (window.adsbygoogle = window.adsbygoogle || []).push({})
              pushedRef.current = true
            }
          } catch {
            setUseFallback(true)
            return
          }

          // se o slot não preencher, troca para fallback
          const t = setTimeout(() => {
            const el = (insRef.current as unknown as HTMLElement | null)
            const empty = !el || el.childElementCount === 0 || el.offsetHeight < 20
            if (empty) setUseFallback(true)
          }, 1800)
          return () => clearTimeout(t)
        })
        .catch(() => { setUseFallback(true) })
    }, [visible, adClient, adSlot])

  // Placeholder simpático (house-ad). Depois você pode trocar pelo script do provedor aqui.
  const Inner = useFallback ? (
    <a
      href={fallbackHref || '#'}
      target={fallbackHref ? '_blank' : undefined}
      rel={fallbackHref ? 'noreferrer noopener' : undefined}
    >
      <div
        className="rounded-xl ring-1 ring-white/15 bg-gradient-to-br from-neutral-800 to-neutral-700 overflow-hidden shadow grid place-items-center"
        style={{ width, height }}
      >
        {fallbackImgSrc ? (
          <img src={fallbackImgSrc} alt="Anúncio" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-white/50">Anúncio</div>
            <div className="mt-1 text-white/80 text-sm">Em breve publicidade aqui</div>
          </div>
        )}
      </div>
    </a>
  ) : (
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
