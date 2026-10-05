import { translate as t, useLocale } from '../../hooks/useLocale'
import FilterButton from './FilterButton'
import { X } from 'lucide-react'

export type ActiveFilterItem = { key: string; label: string; onRemove: () => void }

export default function ActiveFiltersSummary({ items }: { items: ActiveFilterItem[] }) {
  useLocale()
  return <div className="filter-summary">
    <span className="filter-eyebrow">{t("Seleção atual")}</span>
    {items.length ? <div className="filter-summary-chips">{items.map(item => <FilterButton key={item.key} type="button" onClick={item.onRemove} title={t("Remover filtro: {0}", [item.label])} aria-label={t("Remover filtro: {0}", [item.label])}>
      <span>{item.label}</span><X size={12} aria-hidden="true" />
    </FilterButton>)}</div> : <p>{t("Recomendações amplas")}</p>}
  </div>
}
