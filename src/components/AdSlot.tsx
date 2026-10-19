import { translate as t, useLocale } from '../hooks/useLocale'
import { useEffect, useRef, useState } from 'react'



declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>
  }
}
let adsenseLoading: Promise<void> | null = null
function ensureAdsense(client: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (adsenseLoading) return adsenseLoading
  // já existe?
  const existing = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]') as HTMLScriptElement | null
  if (existing) return Promise.resolve()

  adsenseLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    s.setAttribute('crossorigin', 'anonymous')
    s.onload = () => resolve()
    s.onerror = () => {
      s.remove()
      adsenseLoading = null
      reject(new Error('adsense load error'))
    }
    document.head.appendChild(s)
  })
  return adsenseLoading
}

type AdSlotProps = {
  id: string
  className?: string
  width?: number
  height?: number
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
  adFormat,
  fullWidthResponsive,
  fallbackHref,
  fallbackImgSrc,
}: AdSlotProps) {
  useLocale()
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const insRef = useRef<HTMLModElement | null>(null)
  const pushedRef = useRef(false) // evita push duplicado

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const visibility = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0))
    }, { rootMargin: '120px' })
    visibility.observe(el)
    return () => visibility.disconnect()
  }, [])

  useEffect(() => {
    if (!adClient || !adSlot) {
      setUseFallback(true)
      return
    }
    let cancelled = false
    const observer = new MutationObserver(() => {
      if (insRef.current?.getAttribute('data-ad-status') === 'unfilled') setUseFallback(true)
    })
    if (insRef.current) observer.observe(insRef.current, { attributes: true, attributeFilter: ['data-ad-status'] })

    if (visible) {
      ensureAdsense(adClient)
        .then(() => {
          if (cancelled || pushedRef.current || !insRef.current?.getClientRects().length) return
          try {
            (window.adsbygoogle = window.adsbygoogle || []).push({})
            pushedRef.current = true
          } catch {
            setUseFallback(true)
          }
        })
        .catch(() => {
          if (!cancelled) setUseFallback(true)
        })
    }

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [visible, adClient, adSlot])

  // Show a house campaign only when both its image and destination are configured.
  const Inner = useFallback ? (
    fallbackImgSrc && fallbackHref ? <a
      href={fallbackHref}
      target="_blank"
      rel="noreferrer noopener"
    >
      <div
        className="rounded-xl ring-1 ring-white/15 bg-gradient-to-br from-neutral-800 to-neutral-700 overflow-hidden shadow grid place-items-center"
        style={{ width, height }}
      >
        <img src={fallbackImgSrc} alt={t("Anúncio")} className="w-full h-full object-cover" />
      </div>
    </a> : null
  ) : (
    <ins
      className="adsbygoogle"
      style={{ display: 'inline-block', width, height }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={fullWidthResponsive}
      ref={insRef}
    />
  )
  return (
  <div ref={ref} id={id} className={className} data-ad-empty={useFallback && !(fallbackImgSrc && fallbackHref) ? 'true' : undefined} style={{ width, height }}>
    {/* Preserve initialized units across viewport changes; keep other hidden units out of the queue. */}
    {visible || pushedRef.current ? Inner : null}
  </div>
)

}
