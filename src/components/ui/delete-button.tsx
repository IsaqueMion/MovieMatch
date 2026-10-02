import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion'
import { Check, Trash2, X } from 'lucide-react'
import { useRef } from 'react'
import { useLocale } from '../../hooks/useLocale'

// Motion from Moumen Soliman's NativeDelete, adapted to an icon-only trigger.
// https://21st.dev/@moumensoliman/components/delete-button
export default function DeleteButton({ label, confirming, disabled, onConfirm, onDelete, onCancel }: {
  label: string
  confirming: boolean
  disabled: boolean
  onConfirm: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  const { t } = useLocale()
  const trigger = useRef<HTMLButtonElement>(null)
  const reduced = useReducedMotion()
  function cancel() { onCancel(); trigger.current?.focus() }
  return <MotionConfig reducedMotion="user" transition={reduced ? { duration: 0 } : { type: 'spring', bounce: 0, duration: .35 }}>
    <motion.div layout className="home-room-delete-controls" onKeyDown={event => {
      if (event.key === 'Escape' && confirming && !disabled) { event.preventDefault(); cancel() }
    }}>
      <motion.div layout whileHover={disabled || reduced ? undefined : { scale: 1.02 }} whileTap={disabled || reduced ? undefined : { scale: .98 }}>
        <button ref={trigger} type="button" className="home-room-delete" disabled={disabled} aria-label={confirming ? t('Remover da minha lista') : label} aria-expanded={confirming} title={confirming ? t('Remover da minha lista') : t('Deixar de salvar')} onClick={confirming ? onDelete : onConfirm}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={confirming ? 'check' : 'trash'} aria-hidden="true" initial={{ opacity: 0, scale: reduced ? 1 : .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : .8 }} transition={{ duration: reduced ? 0 : .15 }}>
              {confirming ? <Check size={16} /> : <Trash2 size={16} />}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {confirming && <motion.span key="confirm" initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: reduced ? 0 : .15 }}>{t('Confirmar')}</motion.span>}
          </AnimatePresence>
        </button>
      </motion.div>
      <AnimatePresence mode="popLayout">
        {confirming && <motion.div key="cancel" layout initial={{ opacity: 0, scale: reduced ? 1 : .8, x: reduced ? 0 : -8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: reduced ? 1 : .8, x: reduced ? 0 : -8 }} whileHover={reduced ? undefined : { scale: 1.05 }} whileTap={reduced ? undefined : { scale: .95 }}>
          <button type="button" className="home-room-delete-cancel" disabled={disabled} aria-label={t('Cancelar')} title={t('Cancelar')} onClick={cancel}><X size={16} aria-hidden="true" /></button>
        </motion.div>}
      </AnimatePresence>
    </motion.div>
  </MotionConfig>
}
