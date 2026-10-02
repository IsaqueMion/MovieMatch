import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function BackToTop() {
  useLocale()
  const [visible, setVisible] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 300 && document.documentElement.scrollHeight > innerHeight + 300)
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [pathname])

  if (!visible) return null
  return <button type="button" className="cinema-back-to-top" aria-label={t("Voltar ao topo")} onClick={() => {
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main')
    if (heading) {
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1')
        heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true })
      }
      heading.focus({ preventScroll: true })
    }
  }}>
    <svg viewBox="0 0 384 512" aria-hidden="true"><path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z" /></svg>
    <span aria-hidden="true">{t("Voltar ao topo")}</span>
  </button>
}
