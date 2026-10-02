import { useEffect, useRef, useState } from 'react'
import { Check, Eye, EyeOff, LockKeyhole } from 'lucide-react'

// Matching dots follow the assisted-password-confirmation reference without displaying the secret.
export function PasswordMatchDots({ password, value }: { password: string; value: string }) {
  return <div className="password-confirmation-dots" aria-hidden="true">{Array.from({ length: password.length }, (_, index) => <span key={index} data-state={index >= value.length ? 'pending' : value[index] === password[index] ? 'matched' : 'mismatch'} />)}{password && value === password ? <Check size={16} /> : null}</div>
}

export default function PasswordConfirmation({ password, value, onChange, onFocus, disabled }: { password: string; value: string; onChange: (value: string) => void; onFocus: () => void; disabled: boolean }) {
  const [visible, setVisible] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const matches = !!password && value === password
  const mismatch = !!value && !password.startsWith(value)
  const status = !value ? 'Digite a mesma senha novamente.' : matches ? 'As senhas coincidem.' : mismatch ? 'As senhas não coincidem.' : 'Continue para confirmar a senha.'
  useEffect(() => { input.current?.setCustomValidity(value && value !== password ? 'As senhas não coincidem.' : '') }, [value, password])
  return <div className="account-field password-confirmation" data-state={matches ? 'matched' : mismatch ? 'mismatch' : 'pending'}>
    <label htmlFor="account-password-confirmation">Confirmar senha</label>
    <div className="account-input-group"><LockKeyhole size={18} aria-hidden="true" /><input ref={input} id="account-password-confirmation" onFocus={onFocus} type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} placeholder="Repita sua senha" autoComplete="new-password" required minLength={8} maxLength={128} aria-invalid={mismatch || undefined} aria-describedby="account-confirmation-hint" disabled={disabled} /><button className="account-password-toggle" type="button" aria-label={visible ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
    <small id="account-confirmation-hint" role="status">{status}</small>
  </div>
}
