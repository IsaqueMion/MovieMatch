import { translate as t, useLocale } from '../../hooks/useLocale'
import FilterButton from './FilterButton'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarRange,
  ArrowUpRight,
  Check,
  Film,
  Gauge,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Star,
  Tags,
  Tv,
  X,
} from 'lucide-react'

import type {
  DiscoverFilters,
  MonetizationType,
} from '../../lib/functions'
import { filtersSig } from '../../lib/swipeProgress'
import { trapDialogFocus } from '../../lib/dialogFocus'
import '../../styles/filters.css'
import ActiveFiltersSummary, {
  type ActiveFilterItem,
} from './ActiveFiltersSummary'
import { FilterChip, NumberField } from './FilterControls'
import FilterSection from './FilterSection'
import {
  GENRES,
  LANGUAGES,
  MONETIZATION_OPTIONS,
  PROVIDERS_BR,
  REGIONS,
  SORT_OPTIONS,
} from './filterOptions'

type Props = {
  open: boolean
  filters: DiscoverFilters
  defaultFilters: DiscoverFilters
  currentYear: number
  isAdult: boolean
  onRequestAdultVerification: () => void
  onClose: () => void
  onApply: (filters: DiscoverFilters) => void | false | Promise<void | false>
}

function cloneFilters(
  filters: DiscoverFilters,
): DiscoverFilters {
  const includedGenres = [
    ...(filters.genres ?? []),
  ]

  const includedSet = new Set(includedGenres)

  const excludedGenres = [
    ...(filters.excludeGenres ?? []),
  ].filter(
    (genreId) => !includedSet.has(genreId),
  )

  return {
    ...filters,
    genres: includedGenres,
    excludeGenres: excludedGenres,
    providers: [...(filters.providers ?? [])],
    monetization: [
      ...(filters.monetization ?? []),
    ],
  }
}

function arraysEqual<T>(left: T[] = [], right: T[] = []): boolean {
  if (left.length !== right.length) return false

  const normalizedLeft = [...left].sort()
  const normalizedRight = [...right].sort()

  return normalizedLeft.every(
    (value, index) => value === normalizedRight[index],
  )
}

function providerLabel(ids: number[]): string {
  if (ids.length === 1) {
    return (
      PROVIDERS_BR.find((provider) => provider.id === ids[0])?.name ??
      '1 streaming'
    )
  }

  return t("{0} streamings", [ids.length])
}

function languageLabel(value: string): string {
  return LANGUAGES.find((option) => option.value === value)?.label ?? value
}

function sortLabel(value: string): string {
  return SORT_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function regionLabel(value: string): string {
  return REGIONS.find((option) => option.value === value)?.label ?? value
}

export default function FilterModal({
  open,
  filters,
  defaultFilters,
  currentYear,
  isAdult,
  onRequestAdultVerification,
  onClose,
  onApply,
}: Props) {
  const { locale } = useLocale()
  const reducedMotion = usePrefersReducedMotion()
  const [draft, setDraft] = useState<DiscoverFilters>(() =>
    cloneFilters(filters),
  )
  const regionCodes: string[] = REGIONS.map(option => option.value)
  if (draft.watchRegion && /^[A-Z]{2}$/.test(draft.watchRegion) && !regionCodes.includes(draft.watchRegion)) regionCodes.push(draft.watchRegion)

  const [category, setCategory] = useState('streaming')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    if (open && dialog && !dialog.open) dialog.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [open])
  useEffect(() => { contentRef.current?.scrollTo(0, 0) }, [category])
  const wasOpenRef = useRef(false)
  const previousIsAdultRef = useRef(isAdult)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(cloneFilters(filters))
    }

    wasOpenRef.current = open
  }, [open, filters])

  useEffect(() => {
    const becameAdult =
      open &&
      !previousIsAdultRef.current &&
      isAdult

    if (becameAdult) {
      setDraft((current) => ({
        ...current,
        includeAdult: true,
      }))
    }

    previousIsAdultRef.current = isAdult
  }, [isAdult, open])

  const yearMin = draft.yearMin ?? 1990
  const yearMax = draft.yearMax ?? currentYear
  const runtimeMin = draft.runtimeMin ?? 60
  const runtimeMax = draft.runtimeMax ?? 220
  const voteCountMin = draft.voteCountMin ?? 0
  const ratingMin = draft.ratingMin ?? 0

  const isDirty = filtersSig(draft) !== filtersSig(filters)

  const yearPresets = [
    { label: t("Clássicos"), range: [1950, 1979] },
    { label: t("Anos 90"), range: [1990, 1999] },
    { label: '2000+', range: [2000, currentYear] },
    {
      label: t("Últimos 5 anos"),
      range: [Math.max(1900, currentYear - 5), currentYear],
    },
  ]

  const runtimePresets = [
    { label: t("Até 100 min"), range: [40, 100] },
    { label: t("100–140 min"), range: [100, 140] },
    { label: '140+ min', range: [140, 300] },
  ]

  const voteCountPresets = [0, 50, 100, 250, 500, 1000]
  const ratingPresets = [0, 6, 7, 8]

  const activeItems = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = []

    if ((draft.providers?.length ?? 0) > 0) {
      items.push({
        key: 'providers',
        label: providerLabel(draft.providers ?? []),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            providers: [],
          })),
      })
    }

    if ((draft.genres?.length ?? 0) > 0) {
      items.push({
        key: 'genres',
        label:
          draft.genres?.length === 1
            ? t("1 gênero")
            : t("{0} gêneros", [draft.genres?.length ?? 0]),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            genres: [],
          })),
      })
    }

    if ((draft.excludeGenres?.length ?? 0) > 0) {
      items.push({
        key: 'excludeGenres',
        label:
          draft.excludeGenres?.length === 1
            ? t("1 gênero excluído")
            : t("{0} gêneros excluídos", [draft.excludeGenres?.length ?? 0]),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            excludeGenres: [],
          })),
      })
    }

    if (
      yearMin !== (defaultFilters.yearMin ?? 1990) ||
      yearMax !== (defaultFilters.yearMax ?? currentYear)
    ) {
      items.push({
        key: 'year',
        label: `${yearMin}–${yearMax}`,
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            yearMin: defaultFilters.yearMin ?? 1990,
            yearMax: defaultFilters.yearMax ?? currentYear,
          })),
      })
    }

    if ((draft.ratingMin ?? 0) > (defaultFilters.ratingMin ?? 0)) {
      items.push({
        key: 'rating',
        label: t("Nota {0}+", [draft.ratingMin]),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            ratingMin: defaultFilters.ratingMin ?? 0,
          })),
      })
    }

    if (
      runtimeMin !== (defaultFilters.runtimeMin ?? 60) ||
      runtimeMax !== (defaultFilters.runtimeMax ?? 220)
    ) {
      items.push({
        key: 'runtime',
        label: `${runtimeMin}–${runtimeMax} min`,
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            runtimeMin: defaultFilters.runtimeMin ?? 60,
            runtimeMax: defaultFilters.runtimeMax ?? 220,
          })),
      })
    }

    if ((draft.language ?? '') !== (defaultFilters.language ?? '')) {
      items.push({
        key: 'language',
        label: new Intl.DisplayNames([locale], { type: 'language' }).of(draft.language ?? 'en') ?? languageLabel(draft.language ?? ''),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            language: defaultFilters.language ?? '',
          })),
      })
    }

    if ((draft.watchRegion ?? 'BR') !== (defaultFilters.watchRegion ?? 'BR')) {
      items.push({
        key: 'region',
        label: new Intl.DisplayNames([locale], { type: 'region' }).of(draft.watchRegion ?? 'BR') ?? regionLabel(draft.watchRegion ?? 'BR'),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            watchRegion: defaultFilters.watchRegion ?? 'BR',
          })),
      })
    }

    if (
      !arraysEqual(
        draft.monetization ?? [],
        defaultFilters.monetization ?? [],
      )
    ) {
      items.push({
        key: 'monetization',
        label: t("{0} tipos de oferta", [draft.monetization?.length ?? 0]),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            monetization: [
              ...(defaultFilters.monetization ?? ['flatrate']),
            ],
          })),
      })
    }

    if (
      (draft.voteCountMin ?? 0) !==
      (defaultFilters.voteCountMin ?? 0)
    ) {
      items.push({
        key: 'votes',
        label: t("{0}+ votos", [draft.voteCountMin]),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            voteCountMin: defaultFilters.voteCountMin ?? 0,
          })),
      })
    }

    if (
      (draft.sortBy ?? 'popularity.desc') !==
      (defaultFilters.sortBy ?? 'popularity.desc')
    ) {
      items.push({
        key: 'sort',
        label: t(sortLabel(draft.sortBy ?? 'popularity.desc')),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            sortBy: defaultFilters.sortBy ?? 'popularity.desc',
          })),
      })
    }

    if (draft.includeAdult) {
      items.push({
        key: 'adult',
        label: t("Conteúdo adulto"),
        onRemove: () =>
          setDraft((current) => ({
            ...current,
            includeAdult: false,
          })),
      })
    }

    return items
  }, [
    currentYear,
    locale,
    defaultFilters,
    draft,
    runtimeMax,
    runtimeMin,
    yearMax,
    yearMin,
  ])

  const streamingBadge =
    (draft.providers?.length ?? 0) +
    ((draft.watchRegion ?? 'BR') !==
    (defaultFilters.watchRegion ?? 'BR')
      ? 1
      : 0) +
    (!arraysEqual(
      draft.monetization ?? [],
      defaultFilters.monetization ?? [],
    )
      ? 1
      : 0)

  const genresBadge =
    (draft.genres?.length ?? 0) +
    (draft.excludeGenres?.length ?? 0)

  const periodBadge =
    (yearMin !== (defaultFilters.yearMin ?? 1990) ||
    yearMax !== (defaultFilters.yearMax ?? currentYear)
      ? 1
      : 0) +
    (runtimeMin !== (defaultFilters.runtimeMin ?? 60) ||
    runtimeMax !== (defaultFilters.runtimeMax ?? 220)
      ? 1
      : 0)

  const qualityBadge =
    ((draft.ratingMin ?? 0) !==
    (defaultFilters.ratingMin ?? 0)
      ? 1
      : 0) +
    ((draft.language ?? '') !==
    (defaultFilters.language ?? '')
      ? 1
      : 0) +
    ((draft.sortBy ?? 'popularity.desc') !==
    (defaultFilters.sortBy ?? 'popularity.desc')
      ? 1
      : 0)

  const advancedBadge =
    ((draft.voteCountMin ?? 0) !==
    (defaultFilters.voteCountMin ?? 0)
      ? 1
      : 0) +
    (draft.includeAdult ? 1 : 0)

  function resetAll() {
    setDraft(cloneFilters(defaultFilters))
  }

  async function apply() {
    if (applying) return
    setApplying(true); setApplyError('')
    try {
      if (await onApply(cloneFilters(draft)) === false) setApplyError(t("Não foi possível aplicar os filtros. Tente novamente."))
    } catch { setApplyError(t("Não foi possível aplicar os filtros. Tente novamente.")) }
    finally { setApplying(false) }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.dialog
          ref={dialogRef}
          aria-labelledby="filters-title"
          aria-describedby="filters-description"
          aria-busy={applying}
          className="filter-dialog"
          onKeyDown={trapDialogFocus}
          onCancel={event => { event.preventDefault(); onClose() }}
          onClick={event => {
            if (event.target !== event.currentTarget) return
            const rect = event.currentTarget.getBoundingClientRect()
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
          }}
          initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          <header className="filter-header">
            <div><span className="filter-eyebrow"><SlidersHorizontal size={14} aria-hidden="true" />{t("O catálogo do seu jeito")}</span>
              <h2 id="filters-title">{t("Encontre o filme certo")}</h2>
              <p id="filters-description">{t("As escolhas valem para todos nesta sala.")}</p>
            </div>
            <FilterButton type="button" className="filter-close" onClick={onClose} aria-label={t("Fechar")}><X size={18} /></FilterButton>
          </header>
          <div className="filter-workspace">
            <nav className="filter-navigation" aria-label={t("Categorias de filtros")}>
              {[
                { id: 'streaming', title: t("Onde assistir"), icon: Tv, badge: streamingBadge },
                { id: 'genres', title: t("Gêneros"), icon: Tags, badge: genresBadge },
                { id: 'period', title: t("Período e duração"), icon: CalendarRange, badge: periodBadge },
                { id: 'quality', title: t("Qualidade e idioma"), icon: Star, badge: qualityBadge },
                { id: 'advanced', title: t("Avançado"), icon: Settings2, badge: advancedBadge },
              ].map(({ id, title, icon: Icon, badge }) => <FilterButton type="button" key={id} aria-current={category === id ? 'true' : undefined} onClick={() => setCategory(id)}>
                <Icon size={16} aria-hidden="true" /><span>{title}</span>{badge > 0 ? <small>{badge}</small> : null}
              </FilterButton>)}
            </nav>
            <div className="filter-content" ref={contentRef}>
                <FilterSection active={category === 'streaming'}
                  title={t("Onde assistir")}
                  description={t("Streaming, região e forma de disponibilidade.")}
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-white/85">{t("Seus streamings")}</h4>
                        <p className="text-xs text-white/40">{t("Escolha os serviços que você usa.")}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {PROVIDERS_BR.map((provider) => {
                        const checked =
                          (draft.providers ?? []).includes(provider.id)

                        return (
                          <FilterChip
                            key={provider.id}
                            active={checked}
                            tone="sky"
                            onClick={() => {
                              setDraft((current) => {
                                const selected = new Set<number>(
                                  current.providers ?? [],
                                )

                                if (checked) selected.delete(provider.id)
                                else selected.add(provider.id)

                                return {
                                  ...current,
                                  providers: Array.from(selected),
                                }
                              })
                            }}
                          >
                            {provider.name}
                          </FilterChip>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{t("Tipo de oferta")}</span>

                      <div className="flex flex-wrap gap-2">
                        {MONETIZATION_OPTIONS.map(({ k, label }) => {
                          const checked =
                            (draft.monetization ?? []).includes(k)

                          return (
                            <FilterChip
                              key={k}
                              active={checked}
                              onClick={() => {
                                setDraft((current) => {
                                  const selected =
                                    new Set<MonetizationType>(
                                      current.monetization ?? [],
                                    )

                                  if (checked) selected.delete(k)
                                  else selected.add(k)

                                  return {
                                    ...current,
                                    monetization: Array.from(selected),
                                  }
                                })
                              }}
                            >
                              {t(label)}
                            </FilterChip>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{t("Região do catálogo")}</span>

                      <label className="filter-select"><span className="sr-only">{t("Região do catálogo")}</span><select value={draft.watchRegion ?? 'BR'} onChange={event => setDraft(current => ({ ...current, watchRegion: event.target.value }))}>
                        {regionCodes.map(value => <option key={value} value={value}>{new Intl.DisplayNames([locale], { type: 'region' }).of(value)} ({value})</option>)}
                      </select></label>
                    </div>
                  </div>
                </FilterSection>

                <FilterSection active={category === 'genres'}
                  title={t("Gêneros")}
                  description={t("Escolha o que quer ver e o que prefere evitar.")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-sm font-medium text-white/80">{t("Quero ver")}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {GENRES.map((genre) => {
                          const checked =
                            draft.genres?.includes(genre.id) ?? false

                          return (
                            <FilterChip
                              key={`include-${genre.id}`}
                              active={checked}
                              onClick={() => {
                                setDraft((current) => {
                                  const included = new Set<number>(
                                    current.genres ?? [],
                                  )

                                  const excluded = new Set<number>(
                                    current.excludeGenres ?? [],
                                  )

                                  if (included.has(genre.id)) {
                                    included.delete(genre.id)
                                  } else {
                                    included.add(genre.id)

                                    // Um gênero incluído não pode estar
                                    // simultaneamente na lista de exclusão.
                                    excluded.delete(genre.id)
                                  }

                                  return {
                                    ...current,
                                    genres: Array.from(included),
                                    excludeGenres: Array.from(excluded),
                                  }
                                })
                              }}
                            >
                              {t(genre.name)}
                            </FilterChip>
                          )
                        })}
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        <span className="text-sm font-medium text-white/80">{t("Quero evitar")}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {GENRES.map((genre) => {
                          const checked =
                            draft.excludeGenres?.includes(genre.id) ?? false

                          return (
                            <FilterChip
                              key={`exclude-${genre.id}`}
                              active={checked}
                              tone="rose"
                              onClick={() => {
                                setDraft((current) => {
                                  const included = new Set<number>(
                                    current.genres ?? [],
                                  )

                                  const excluded = new Set<number>(
                                    current.excludeGenres ?? [],
                                  )

                                  if (excluded.has(genre.id)) {
                                    excluded.delete(genre.id)
                                  } else {
                                    excluded.add(genre.id)

                                    // Um gênero excluído não pode continuar
                                    // simultaneamente na lista de inclusão.
                                    included.delete(genre.id)
                                  }

                                  return {
                                    ...current,
                                    genres: Array.from(included),
                                    excludeGenres: Array.from(excluded),
                                  }
                                })
                              }}
                            >
                              {t(genre.name)}
                            </FilterChip>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </FilterSection>

                <FilterSection active={category === 'period'}
                  title={t("Período e duração")}
                  description={t("Defina quando o filme foi lançado e quanto tempo ele pode durar.")}
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white/80">{t("Ano de lançamento")}</span>
                        <span className="rounded-lg bg-white/[0.055] px-2 py-1 text-xs tabular-nums text-white/50">
                          {yearMin}–{yearMax}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {yearPresets.map(({ label, range }) => (
                          <FilterChip
                            key={label}
                            active={
                              yearMin === range[0] &&
                              yearMax === range[1]
                            }
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                yearMin: range[0],
                                yearMax: range[1],
                              }))
                            }
                          >
                            {label}
                          </FilterChip>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <NumberField
                          label={t("De")}
                          value={yearMin}
                          min={1900}
                          max={yearMax}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              yearMin: Math.min(
                                value,
                                current.yearMax ?? currentYear,
                              ),
                            }))
                          }
                        />

                        <NumberField
                          label={t("Até")}
                          value={yearMax}
                          min={yearMin}
                          max={currentYear}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              yearMax: Math.max(
                                value,
                                current.yearMin ?? 1900,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white/80">{t("Duração")}</span>
                        <span className="rounded-lg bg-white/[0.055] px-2 py-1 text-xs tabular-nums text-white/50">
                          {runtimeMin}–{runtimeMax} min
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {runtimePresets.map(({ label, range }) => (
                          <FilterChip
                            key={label}
                            active={
                              runtimeMin === range[0] &&
                              runtimeMax === range[1]
                            }
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                runtimeMin: range[0],
                                runtimeMax: range[1],
                              }))
                            }
                          >
                            {label}
                          </FilterChip>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <NumberField
                          label={t("Mínimo")}
                          value={runtimeMin}
                          min={40}
                          max={runtimeMax}
                          step={5}
                          suffix="min"
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              runtimeMin: Math.min(
                                value,
                                current.runtimeMax ?? 300,
                              ),
                            }))
                          }
                        />

                        <NumberField
                          label={t("Máximo")}
                          value={runtimeMax}
                          min={runtimeMin}
                          max={300}
                          step={5}
                          suffix="min"
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              runtimeMax: Math.max(
                                value,
                                current.runtimeMin ?? 40,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </FilterSection>

                <FilterSection active={category === 'quality'}
                  title={t("Qualidade e idioma")}
                  description={t("Nota mínima, idioma original e forma de ordenar os resultados.")}
                >
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{t("Nota mínima")}</span>

                      <div className="flex flex-wrap gap-2">
                        {ratingPresets.map((value) => (
                          <FilterChip
                            key={value}
                            active={Math.abs(ratingMin - value) < 0.01}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                ratingMin: value,
                              }))
                            }
                          >
                            {value === 0 ? t("Qualquer") : `${value}+`}
                          </FilterChip>
                        ))}
                      </div>

                      <div className="mt-3">
                        <NumberField
                          label={t("Personalizado")}
                          value={ratingMin}
                          min={0}
                          max={10}
                          step={0.5}
                          suffix="/10"
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              ratingMin: value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{t("Idioma original")}</span>

                      <label className="filter-select"><span className="sr-only">{t("Idioma original")}</span><select value={draft.language ?? ''} onChange={event => setDraft(current => ({ ...current, language: event.target.value }))}>
                        {LANGUAGES.map(option => <option key={option.value} value={option.value}>{option.value ? new Intl.DisplayNames([locale], { type: 'language' }).of(option.value) ?? option.label : t(option.label)}</option>)}
                      </select></label>
                    </div>

                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{t("Ordenar resultados")}</span>

                      <label className="filter-select"><span className="sr-only">{t("Ordenar resultados")}</span><select value={draft.sortBy ?? 'popularity.desc'} onChange={event => setDraft(current => ({ ...current, sortBy: event.target.value }))}>
                        {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                      </select></label>
                    </div>
                  </div>
                </FilterSection>

                <FilterSection active={category === 'advanced'}
                  title={t("Avançado")}
                  description={t("Ajustes menos usados para refinar ainda mais a busca.")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-white/40" />
                        <span className="text-sm font-medium text-white/80">{t("Popularidade mínima")}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {voteCountPresets.map((value) => (
                          <FilterChip
                            key={value}
                            active={voteCountMin === value}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                voteCountMin: value,
                              }))
                            }
                          >
                            {value === 0 ? t("Sem mínimo") : t("{0}+ votos", [value])}
                          </FilterChip>
                        ))}
                      </div>

                      <div className="mt-3">
                        <NumberField
                          label={t("Personalizado")}
                          value={voteCountMin}
                          min={0}
                          max={5000}
                          step={50}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              voteCountMin: value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="sm:border-l sm:border-white/10 sm:pl-5">
                      <div className="mb-2 flex items-center gap-2">
                        <Film className="h-4 w-4 text-white/40" />
                        <span className="text-sm font-medium text-white/80">{t("Conteúdo adulto")}</span>
                      </div>

                      <p className="mb-3 text-xs leading-relaxed text-white/45">{t("Requer confirmação de maioridade. A data de nascimento não é armazenada.")}</p>

                      <FilterButton
                        type="button"
                        aria-pressed={!!draft.includeAdult}
                        onClick={() => {
                          if (!draft.includeAdult && !isAdult) {
                            onRequestAdultVerification()
                            return
                          }

                          setDraft((current) => ({
                            ...current,
                            includeAdult: !current.includeAdult,
                          }))
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                          draft.includeAdult
                            ? 'border-emerald-400/30 bg-emerald-400/10'
                            : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-medium text-white/85">{t("Permitir conteúdo 18+")}</span>
                          <span className="mt-0.5 block text-xs text-white/40">
                            {draft.includeAdult
                              ? t("Ativado nesta seleção")
                              : t("Desativado")}
                          </span>
                        </span>

                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full border ${
                            draft.includeAdult
                              ? 'border-emerald-400/40 bg-emerald-400 text-neutral-950'
                              : 'border-white/15 bg-white/[0.04] text-transparent'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </FilterButton>
                    </div>
                  </div>
                </FilterSection>
            </div>
          </div>

          <div className="filter-selection"><ActiveFiltersSummary items={activeItems} />{applyError ? <p className="filter-error" role="alert">{applyError}</p> : null}</div>
          <footer className="filter-footer">
            <FilterButton type="button" className="filter-reset" onClick={resetAll} title={t("Limpar filtros")} aria-label={t("Limpar filtros")}><RotateCcw size={16} /><span>{t("Limpar filtros")}</span></FilterButton>
            <FilterButton type="button" className="filter-cancel" onClick={onClose}>{t("Cancelar")}</FilterButton>
            <FilterButton type="button" className="filter-apply" disabled={!isDirty || applying} onClick={() => void apply()}>
              <span>{applying ? t("Aplicando filtros…") : isDirty ? t("Aplicar filtros") : t("Filtros aplicados")}</span><ArrowUpRight size={20} aria-hidden="true" />
            </FilterButton>
          </footer>
        </motion.dialog>
      ) : null}
    </AnimatePresence>
  )
}
