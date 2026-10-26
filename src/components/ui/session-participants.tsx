import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, UserRound, X } from 'lucide-react'
import { translate as t, useLocale } from '../../hooks/useLocale'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type Participant = { key: string | number; avatar?: string }
type Props = { participants: Participant[]; children: ReactNode }

export default function SessionParticipants({ participants, children }: Props) {
  useLocale()
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const nativePopover = typeof HTMLElement.prototype.showPopover === 'function' && typeof HTMLElement.prototype.hidePopover === 'function'
  const dismiss = useCallback(() => {
    const popup = panel.current
    if (!popup) return
    if (nativePopover) { popup.hidePopover(); return }
    const restoreFocus = popup.contains(document.activeElement)
    popup.hidden = true
    setOpen(false)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }, [nativePopover])

  useEffect(() => {
    window.addEventListener('resize', dismiss)
    if (nativePopover) return () => window.removeEventListener('resize', dismiss)
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) dismiss()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !panel.current || panel.current.hidden) return
      event.preventDefault()
      event.stopPropagation()
      dismiss()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('resize', dismiss)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [dismiss, nativePopover])

  function reveal(animate: boolean) {
    const popup = panel.current, button = trigger.current
    if (!popup || !button) return
    if (nativePopover ? popup.matches(':popover-open') : !popup.hidden) { dismiss(); return }
    popup.getAnimations({ subtree: true }).forEach(animation => animation.cancel())
    popup.dataset.animated = String(animate && !reducedMotion)
    const origin = button.getBoundingClientRect()
    const starts = [...button.querySelectorAll('.session-member-face')].map(el => el.getBoundingClientRect())
    if (nativePopover) popup.showPopover()
    else { popup.hidden = false; setOpen(true) }
    const bounds = popup.getBoundingClientRect()
    popup.style.left = Math.max(12, Math.min(origin.x + origin.width / 2 - bounds.width / 2, innerWidth - bounds.width - 12)) + 'px'
    popup.style.top = Math.max(12, Math.min(origin.bottom + 8, innerHeight - bounds.height - 12)) + 'px'
    if (animate && !reducedMotion) {
      popup.querySelectorAll('.member-avatar-trigger > span').forEach((avatar, index) => {
        const end = avatar.getBoundingClientRect(), start = starts[Math.min(index, starts.length - 1)]
        if (!start) return
        avatar.animate([{ transform: 'translate(' + (start.x - end.x) + 'px,' + (start.y - end.y) + 'px) scale(.75)', opacity: index < 3 ? 1 : 0 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: 250, easing: 'cubic-bezier(.23,1,.32,1)' })
      })
      popup.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' })
    }
    popup.querySelector<HTMLButtonElement>('.session-participants-close')?.focus({ preventScroll: true })
  }

  return <div className="session-participants" role="group" aria-label={t('Participantes da sessão')}>
    <button ref={trigger} type="button" className="session-participants-trigger" aria-label={t('Ver participantes da sessão')} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} popoverTarget={nativePopover ? id : undefined} onClick={event => { event.preventDefault(); reveal(event.detail !== 0) }}>
      <span className="session-participants-faces" aria-hidden="true">{participants.slice(0, 3).map(person => <span className="session-member-face" key={person.key}><UserRound size={18} />{person.avatar ? <img src={person.avatar} alt="" onError={event => { event.currentTarget.hidden = true }} /> : null}<i /></span>)}</span>
      {participants.length > 3 ? <small>+{participants.length - 3}</small> : null}<ChevronDown size={14} aria-hidden="true" />
    </button>
    <div id={id} ref={panel} popover={nativePopover ? 'auto' : undefined} hidden={nativePopover ? undefined : !open} role="dialog" aria-label={t('Participantes da sessão')} className="session-participants-panel" onToggle={event => setOpen(event.newState === 'open')} onBeforeToggle={event => { if (event.newState === 'closed' && panel.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true }) }} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(event.key)) event.stopPropagation() }}>
      <header><div><h2>{t('Participantes da sessão')}</h2><p>{participants.length} {t('online')}</p></div><button type="button" className="session-participants-close" aria-label={t('Fechar participantes')} onClick={dismiss}><X size={18} aria-hidden="true" /></button></header>
      <div className="session-participants-grid">{children}</div>
    </div>
  </div>
}
