import type { ReactNode } from 'react'

type FilterChipProps = {
  active: boolean
  children: ReactNode
  onClick: () => void
}

export function FilterChip({
  active,
  children,
  onClick,
}: FilterChipProps) {
  const base =
    'rounded-full px-3 py-1 text-xs font-medium transition'

  const selected =
    'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'

  const idle =
    'bg-white/10 text-white/80 hover:bg-white/15'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? selected : idle}`}
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
  const clamp = (val: number) =>
    Math.min(max, Math.max(min, val))

  const adjust = (delta: number) => {
    const next = clamp(
      Number((value + delta).toFixed(3)),
    )

    onChange(next)
  }

  const inputPadding = suffix ? 'pr-9' : 'pr-2'

  return (
    <label className="flex flex-col gap-1 text-xs text-white/70">
      <span>{label}</span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={value <= min}
          className="h-8 w-8 rounded-md bg-white/10 text-white/80 transition hover:bg-white/15 disabled:opacity-40"
        >
          -
        </button>

        <div className="relative flex-1">
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
            className={`w-full rounded-md bg-white/10 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 ${inputPadding}`}
          />

          {suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-white/60">
              {suffix}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={value >= max}
          className="h-8 w-8 rounded-md bg-white/10 text-white/80 transition hover:bg-white/15 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </label>
  )
}