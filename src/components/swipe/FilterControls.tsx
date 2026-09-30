import type { ReactNode } from 'react'

type FilterChipProps = {
  active: boolean
  children: ReactNode
  onClick: () => void
  tone?: 'emerald' | 'rose' | 'sky'
}

export function FilterChip({
  active,
  children,
  onClick,
  tone = 'emerald',
}: FilterChipProps) {
  const activeClass = {
    emerald:
      'border-emerald-400/35 bg-emerald-400/15 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.04)]',
    rose:
      'border-rose-400/35 bg-rose-400/15 text-rose-100 shadow-[0_0_0_1px_rgba(251,113,133,0.04)]',
    sky:
      'border-sky-400/35 bg-sky-400/15 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.04)]',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? activeClass
          : 'border-white/10 bg-white/[0.045] text-white/65 hover:border-white/20 hover:bg-white/[0.075] hover:text-white/90'
      }`}
    >
      {children}
    </button>
  )
}

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: NumberFieldProps) {
  const clamp = (number: number) =>
    Math.min(max, Math.max(min, number))

  const adjust = (delta: number) => {
    const next = clamp(Number((value + delta).toFixed(3)))
    onChange(next)
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
        {label}
      </span>

      <div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-white/10 bg-neutral-950/30 transition focus-within:border-emerald-400/35 focus-within:ring-2 focus-within:ring-emerald-400/10">
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={value <= min}
          className="grid w-10 shrink-0 place-items-center border-r border-white/10 text-base text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          aria-label={`Diminuir ${label}`}
        >
          −
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            value={Number(value.toFixed(2))}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const raw = Number(event.target.value)
              if (Number.isNaN(raw)) return
              onChange(clamp(raw))
            }}
            className={`h-full w-full bg-transparent px-2 text-center text-sm font-medium text-white outline-none ${
              suffix ? 'pr-9' : ''
            }`}
          />

          {suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-white/35">
              {suffix}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={value >= max}
          className="grid w-10 shrink-0 place-items-center border-l border-white/10 text-base text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </label>
  )
}
