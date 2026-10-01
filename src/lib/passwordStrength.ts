// Extra rules guide strength; signup still requires only eight characters.
const RULES = [
  { label: 'Pelo menos 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Maiúsculas e minúsculas', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'Um número', test: (value: string) => /\d/.test(value) },
  { label: 'Um símbolo', test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value) },
]
export function passwordStrength(value: string) {
  const rules = RULES.map(rule => ({ label: rule.label, met: rule.test(value) }))
  const guessable = !!value && (/^(?:password|passw0rd|senha|qwerty|letmein|welcome|admin|iloveyou|abc123|123456)/i.test(value) || /(.)\1{3,}|0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf/i.test(value))
  const score = !value ? 0 : guessable ? 1 : Math.max(1, rules.filter(rule => rule.met).length)
  return { rules, guessable, score, complete: score === 4 }
}
