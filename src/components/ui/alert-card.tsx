import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type Props = {
  icon: ReactNode
  title: string
  description: string
  buttonText: string
  dismissLabel: string
  isVisible: boolean
  onDismiss: () => void
}

export function AlertCard({ icon, title, description, buttonText, dismissLabel, isVisible, onDismiss }: Props) {
  const reducedMotion = usePrefersReducedMotion()
  return <AnimatePresence>{isVisible ? <motion.aside className="adblock-notice" role="status" aria-label={title}
    initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 6 }} transition={{ duration: reducedMotion ? 0 : .18 }}
    onKeyDown={event => event.stopPropagation()}>
    <span className="adblock-notice-icon" aria-hidden="true">{icon}</span>
    <div className="adblock-notice-copy"><h3>{title}</h3><p>{description}</p></div>
    <button type="button" className="adblock-notice-action" onClick={onDismiss}>{buttonText}</button>
    <button type="button" className="adblock-notice-dismiss" aria-label={dismissLabel} onClick={onDismiss}><X size={17} aria-hidden="true" /></button>
  </motion.aside> : null}</AnimatePresence>
}
