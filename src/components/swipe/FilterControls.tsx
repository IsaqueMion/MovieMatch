import { translate as t } from '../../hooks/useLocale'
import FilterButton from './FilterButton'
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
  return (
    <FilterButton
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="filter-chip"
      data-tone={tone}
    >
      {children}
    </FilterButton>
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
    <label className="filter-number-field">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
        {label}
      </span>

      <div className="filter-number-input">
        <FilterButton
          type="button"
          onClick={() => adjust(-step)}
          disabled={value <= min}
          className="grid w-10 shrink-0 place-items-center border-r border-white/10 text-base text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          aria-label={t("Diminuir {0}", [label])}
        >
          −
        </FilterButton>

        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            aria-label={label}
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

        <FilterButton
          type="button"
          onClick={() => adjust(step)}
          disabled={value >= max}
          className="grid w-10 shrink-0 place-items-center border-l border-white/10 text-base text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          aria-label={t("Aumentar {0}", [label])}
        >
          +
        </FilterButton>
      </div>
    </label>
  )
}
