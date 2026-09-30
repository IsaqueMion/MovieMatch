import { Sparkles, X } from 'lucide-react'

export type ActiveFilterItem = {
  key: string
  label: string
  onRemove: () => void
}

type Props = {
  items: ActiveFilterItem[]
}

export default function ActiveFiltersSummary({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <Sparkles className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90">
            Recomendações amplas
          </p>
          <p className="text-xs text-white/50">
            Nenhum filtro adicional está limitando os resultados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          <span className="text-xs font-medium text-white/70">
            Seleção atual
          </span>
        </div>

        <span className="text-[11px] text-white/40">
          {items.length} {items.length === 1 ? 'ajuste' : 'ajustes'}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onRemove}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-neutral-950/45 px-2.5 py-1.5 text-xs text-white/80 transition hover:border-white/20 hover:bg-neutral-950/70"
            title={`Remover filtro: ${item.label}`}
          >
            <span>{item.label}</span>
            <X className="h-3 w-3 text-white/45" />
          </button>
        ))}
      </div>
    </div>
  )
}
