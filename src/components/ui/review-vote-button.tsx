import { useLocale, currentLocale } from '../../hooks/useLocale'
// Based on the supplied button-21: paired directions, server-controlled state,
// hover/focus counts and mirrored particles for downvotes.
import { useId, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

const COLORS = ['#f97316', '#fbbf24', '#facc15', '#fb923c']
const PARTICLES = Array.from({ length: 6 }, (_, i) => {
  const rad = (-150 + i / 5 * 120) * Math.PI / 180
  const distance = 30 + i % 2 * 15
  return { id: i, x: Math.cos(rad) * distance, y: Math.sin(rad) * distance, color: COLORS[i % 4], size: 4 + i % 2, duration: .5 + i % 3 * .07 }
})

export default function ReviewVoteButton({ direction, active, count, disabled, busy, onVote }: { direction: 'up' | 'down'; active: boolean; count: number; disabled: boolean; busy: boolean; onVote: () => Promise<boolean> }) {
  useLocale()
  const reduced = usePrefersReducedMotion()
  const tipId = useId()
  const [burst, setBurst] = useState(0)
  const Icon = direction === 'up' ? ArrowBigUp : ArrowBigDown
  const label = direction === 'up' ? 'Upvote' : 'Downvote'
  const sign = direction === 'up' ? 1 : -1
  async function click() {
    if (disabled) return
    const nextActive = !active
    if (await onVote() && nextActive && !reduced) setBurst(previous => previous + 1)
  }
  return <div className={`review-vote-control is-${direction}`}>
    <AnimatePresence>{burst > 0 && !reduced ? PARTICLES.map(p => <motion.span key={`${p.id}-${burst}`} className="review-vote-particle" style={{ width: p.size, height: p.size, background: p.color, left: '50%', top: '50%', marginLeft: -p.size / 2, marginTop: -p.size / 2 }} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: p.x, y: [0, p.y * .6 * sign, p.y * sign], opacity: [1, 1, 0], scale: .5 }} transition={{ duration: p.duration, ease: [.22, 1, .36, 1] }} />) : null}</AnimatePresence>
    <motion.button type="button" className="review-vote-button" onClick={() => void click()} disabled={disabled} aria-label={`${label}: ${count}`} aria-describedby={tipId} aria-pressed={active} aria-busy={busy || undefined} whileHover={reduced ? undefined : { scale: 1.04 }} whileTap={reduced ? undefined : { scale: .88 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
      <AnimatePresence initial={false}>{burst > 0 && !reduced ? <motion.span key={burst} className="review-vote-ripple" initial={{ scale: 0, opacity: 1 }} animate={{ scale: 5, opacity: 0 }} transition={{ duration: .65, ease: 'easeOut' }} /> : null}</AnimatePresence>
      <motion.span key={`icon-${burst}`} animate={reduced ? { y: 0 } : burst > 0 ? { y: [0, -4 * sign, sign, -2 * sign, 0] } : { y: 0 }} transition={{ duration: .4, ease: 'easeOut' }}><Icon size={21} fill={active ? 'currentColor' : 'none'} strokeWidth={1.75} aria-hidden="true" /></motion.span>
    </motion.button>
    <span id={tipId} role="tooltip" className="review-vote-count"><span>{label}</span><AnimatePresence mode="wait" initial={false}><motion.strong key={count} initial={reduced ? false : { y: 8 * sign, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduced ? undefined : { y: -8 * sign, opacity: 0 }} transition={{ duration: .18 }}>{count.toLocaleString(currentLocale())}</motion.strong></AnimatePresence></span>
  </div>
}
