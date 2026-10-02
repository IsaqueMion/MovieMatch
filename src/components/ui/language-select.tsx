import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, X } from 'lucide-react'
import { useLocale } from '../../hooks/useLocale'

const languages = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
] as const

export default function LanguageSelect() {
  const { language, setLanguage, t } = useLocale()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const reduced = useReducedMotion()
  const selected = languages.find(item => item.code === language)!
  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function close() { setOpen(false); trigger.current?.focus() }
  return <div className="language-select" ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false) }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); close() }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      const items = [...root.current!.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
      const index = items.indexOf(document.activeElement as HTMLElement)
      items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus()
    }
  }}>
    <button ref={trigger} type="button" className="language-trigger" aria-label={t('Idioma da interface')} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}><span aria-hidden="true">{selected.flag}</span>{selected.label}<ChevronDown size={13} aria-hidden="true" /></button>
    <AnimatePresence>{open ? <motion.div id={id} className="language-menu" role="menu" aria-label={t('Idioma da interface')} initial={{ opacity: 0, scale: reduced ? 1 : .96, y: reduced ? 0 : 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: reduced ? 1 : .96 }} transition={{ duration: reduced ? 0 : .15 }}>
      <div className="language-menu-heading"><span>{t('Idioma da interface')}</span><button type="button" aria-label={t('Fechar')} onClick={close}><X size={14} aria-hidden="true" /></button></div>
      {languages.map(item => <button type="button" key={item.code} role="menuitemradio" aria-checked={language === item.code} onClick={() => { setLanguage(item.code); close() }}><span aria-hidden="true">{item.flag}</span><span>{item.label}</span>{language === item.code ? <motion.span initial={{ scale: reduced ? 1 : 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}><Check size={14} aria-hidden="true" /></motion.span> : null}</button>)}
    </motion.div> : null}</AnimatePresence>
  </div>
}
