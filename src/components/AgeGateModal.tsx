import { useState } from 'react'

type Props = {
  open: boolean
  onConfirm: (birthdateISO: string) => void
  onCancel: () => void
}

export default function AgeGateModal({ open, onConfirm, onCancel }: Props) {
  if (!open) return null

  const [birthdate, setBirthdate] = useState<string>('')
  const [touched, setTouched] = useState(false)

  const age = birthdate ? calcAge(birthdate) : null
  const valid = !!birthdate && age !== null && age >= 18 && age <= 120

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-10 w-[min(92vw,28rem)] rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-4 text-white">
        <h3 className="text-lg font-semibold">Confirme sua idade</h3>
        <p className="text-sm text-white/70 mt-1">
          Para ativar conteúdo adulto, informe sua data de nascimento (18+).
        </p>

        <label className="block mt-4 text-sm">
          Data de nascimento
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            onBlur={() => setTouched(true)}
            className="mt-1 w-full rounded-md bg-white/10 px-2 py-1 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            min="1900-01-01"
            max={todayISO()}
          />
        </label>

        {touched && !!birthdate && age !== null && age < 18 ? (
          <p className="mt-2 text-rose-300 text-sm">Você precisa ter 18 anos ou mais.</p>
        ) : null}
        {touched && !birthdate ? (
          <p className="mt-2 text-amber-300 text-sm">Informe a data para continuar.</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15">
            Cancelar
          </button>
          <button
            onClick={() => valid && onConfirm(birthdate)}
            disabled={!valid}
            className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function calcAge(birthISO: string): number {
  const today = new Date()
  const dob = new Date(birthISO)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function todayISO(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18) // máximo permitido = hoje - 18 anos
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

