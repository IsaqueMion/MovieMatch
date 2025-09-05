// src/components/AgeGateModal.tsx
import { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  onConfirm: (birthdateISO?: string) => void
  onCancel: () => void
}

export default function AgeGateModal({ open, onConfirm, onCancel }: Props) {
  const [birthdate, setBirthdate] = useState<string>('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        ref={dialogRef}
        className="relative z-10 w-[min(92vw,28rem)] rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-5 text-white"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-semibold">Confirme sua idade</h3>
        <p className="mt-1 text-sm text-white/80">
          Para habilitar títulos com conteúdo adulto (18+), confirme que você é maior de idade.
          Informar sua data de nascimento é opcional, mas ajuda a registrar a verificação.
        </p>

        <label className="mt-4 block text-sm">
          Data de nascimento (opcional)
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-2 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(birthdate || undefined)}
            className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Tenho 18+
          </button>
        </div>
      </div>
    </div>
  )
}
