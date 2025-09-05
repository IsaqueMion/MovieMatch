import React, { useState } from 'react'

type Props = {
  open: boolean
  /** Fecha o modal sem confirmar */
  onClose: () => void
  /**
   * Confirmação com data de nascimento em formato YYYY-MM-DD.
   * O componente valida 18+ antes de chamar.
   */
  onConfirmed: (birthdateStr: string) => void
}

function isAdult(birthdateStr: string): boolean {
  const d = new Date(birthdateStr)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age >= 18
}

export default function AgeGateModal({ open, onClose, onConfirmed }: Props) {
  const [birthdate, setBirthdate] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleConfirm = () => {
    if (!birthdate) { setError('Informe sua data de nascimento.'); return }
    if (!isAdult(birthdate)) { setError('É necessário ter 18 anos ou mais.'); return }
    setError(null)
    onConfirmed(birthdate)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-interactive="true"
      aria-modal
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,28rem)] rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-4 text-white">
        <h3 className="text-lg font-semibold">Conteúdo adulto (18+)</h3>
        <p className="mt-2 text-sm text-white/80">
          Para habilitar títulos com conteúdo adulto, confirme sua data de nascimento.
        </p>

        <div className="mt-4">
          <label className="text-sm text-white/80">Data de nascimento</label>
          <input
            type="date"
            className="mt-1 w-full rounded-md bg-white/10 text-white px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-emerald-500/50"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            data-interactive="true"
          />
          {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
