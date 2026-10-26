import { translate as t, useLocale } from '../hooks/useLocale'
import { useEffect, useRef, useState } from 'react'
import { openDialog, trapDialogFocus } from '../lib/dialogFocus'
import { ageFromBirthdate } from '../lib/birthdate'
import { useCurrentDate } from '../hooks/useCurrentDate'

type Props = {
  open: boolean
  busy?: boolean
  onConfirm: (birthdateISO: string) => void
  onCancel: () => void
}

export default function AgeGateModal({ open, onConfirm, onCancel, busy = false }: Props) {
  useLocale()
  const [birthdate, setBirthdate] = useState<string>('')
  const [touched, setTouched] = useState(false)
  const today = useCurrentDate()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (open) return openDialog(element)
  }, [open])

  const age = birthdate ? ageFromBirthdate(birthdate, today) : null
  const valid = !!birthdate && age !== null

  if (!open) return null

  return (
    <dialog ref={dialog} className="m-auto max-h-[90dvh] overflow-auto rounded-2xl bg-neutral-900 p-0 text-white backdrop:bg-black/60" aria-labelledby="age-gate-title" onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); onCancel() }} onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel()
    }}>
      <div className="relative z-10 w-[min(92vw,28rem)] rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-4 text-white">
        <h3 id="age-gate-title" className="text-lg font-semibold">{t("Confirme sua idade")}</h3>
        <p className="text-sm text-white/70 mt-1">{t("Sua data fica privada. O filtro 18+ fica disponível quando você completa 18 anos.")}</p>

        <label className="block mt-4 text-sm">{t("Data de nascimento")}<input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            onBlur={() => setTouched(true)}
            className="mt-1 w-full rounded-md bg-white/10 px-2 py-1 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            min="1900-01-01"
            max={today}
            disabled={busy}
          />
        </label>

        {touched && !!birthdate && age !== null && age < 18 ? (
          <p className="mt-2 text-rose-300 text-sm">{t("Você precisa ter 18 anos ou mais.")}</p>
        ) : null}
        {touched && !birthdate ? (
          <p className="mt-2 text-amber-300 text-sm">{t("Informe a data para continuar.")}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button disabled={busy} onClick={onCancel} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15">{t("Cancelar")}</button>
          <button
            onClick={() => valid && onConfirm(birthdate)}
            disabled={!valid || busy}
            className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >{t("Confirmar")}</button>
        </div>
      </div>
    </dialog>
  )
}
