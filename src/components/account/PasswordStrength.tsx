import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// Adapted from interior.dev/password-strength; the extra rules are guidance, not signup requirements.
const RULES = [
  { label: 'Pelo menos 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Maiúsculas e minúsculas', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'Um número', test: (value: string) => /\d/.test(value) },
  { label: 'Um símbolo', test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value) },
]
const LABELS = ['Comece sua senha', 'Fraca', 'Razoável', 'Boa', 'Forte']
const COMMON = /^(?:password|passw0rd|senha|qwerty|letmein|welcome|admin|iloveyou|abc123|123456)/i
const RUN = /(.)\1{3,}|0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf/i
const SPRING = { type: 'spring', stiffness: 520, damping: 34, mass: 0.45 } as const

export default function PasswordStrength({ value }: { value: string }) {
  const reduced = useReducedMotion()
  const rules = RULES.map(rule => ({ ...rule, met: rule.test(value) }))
  const guessable = !!value && (COMMON.test(value) || RUN.test(value))
  const score = !value ? 0 : guessable ? 1 : Math.max(1, rules.filter(rule => rule.met).length)
  const label = LABELS[score]
  const tone = score === 0 ? 'empty' : score === 1 ? 'weak' : score === 2 ? 'fair' : 'strong'
  const [announcement, setAnnouncement] = useState('')
  const description = value ? `Força da senha: ${label}.${guessable ? ' Padrão fácil de adivinhar.' : ''}` : ''
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(description), 700)
    return () => window.clearTimeout(timer)
  }, [description])
  return <div className="password-strength" data-tone={tone}>
    <div className="password-strength-meter" role="meter" aria-label="Força da senha" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={label}>
      {RULES.map((rule, index) => <span key={rule.label}><motion.span initial={false} animate={{ scaleX: index < score ? 1 : 0 }} transition={reduced ? { duration: 0 } : { ...SPRING, delay: index < score ? index * .03 : 0 }} /></span>)}
    </div>
    <div className="password-strength-caption"><span>{label}</span>{guessable ? <span>Padrão fácil de adivinhar</span> : null}</div>
    <ul>{rules.map(rule => <li key={rule.label} data-met={rule.met}><motion.span aria-hidden="true" initial={false} animate={{ scale: rule.met ? 1 : .85 }} transition={reduced ? { duration: 0 } : SPRING}>{rule.met ? '✓' : '○'}</motion.span>{rule.label}</li>)}</ul>
    <small>O mínimo é 8 caracteres. Os outros itens ajudam a fortalecer a senha.</small>
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </div>
}
