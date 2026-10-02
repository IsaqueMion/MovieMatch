import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

/** Adapted from Efferd auth-2: https://legacy.efferd.com/r/auth-2.json */
export default function FloatingPaths({ position }: { position: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const visible = useInView(ref)
  const reduced = useReducedMotion()
  const still = reduced || !visible
  return <svg ref={ref} className="account-floating-paths" fill="none" viewBox="0 0 696 316" aria-hidden="true">
    {Array.from({ length: 36 }, (_, i) => <motion.path
      key={i}
      d={`M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`}
      stroke="currentColor" strokeOpacity={0.1 + i * 0.03} strokeWidth={0.5 + i * 0.03}
      initial={false}
      animate={still ? { pathLength: 1, opacity: 0.4, pathOffset: 0 } : { pathLength: [0.55, 1, 0.55], opacity: [0.5, 0.8, 0.5], pathOffset: [i / 36, 1 + i / 36, i / 36] }}
      transition={still ? { duration: 0 } : { duration: 20 + i % 11, repeat: Infinity, ease: 'linear', delay: -(i % 11) }}
    />)}
  </svg>
}
