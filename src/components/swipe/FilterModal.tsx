import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarRange,
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
import Select from '../Select'
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
  onApply: (filters: DiscoverFilters) => void | Promise<void>
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

  return `${ids.length} streamings`
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
  const [draft, setDraft] = useState<DiscoverFilters>(() =>
    cloneFilters(filters),
  )

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
    { label: 'Clássicos', range: [1950, 1979] },
    { label: 'Anos 90', range: [1990, 1999] },
    { label: '2000+', range: [2000, currentYear] },
    {
      label: 'Últimos 5 anos',
      range: [Math.max(1900, currentYear - 5), currentYear],
    },
  ]

  const runtimePresets = [
    { label: 'Até 100 min', range: [40, 100] },
    { label: '100–140 min', range: [100, 140] },
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
            ? '1 gênero'
            : `${draft.genres?.length ?? 0} gêneros`,
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
            ? '1 gênero excluído'
            : `${draft.excludeGenres?.length ?? 0} gêneros excluídos`,
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
        label: `Nota ${draft.ratingMin}+`,
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
        label: languageLabel(draft.language ?? ''),
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
        label: regionLabel(draft.watchRegion ?? 'BR'),
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
        label: `${draft.monetization?.length ?? 0} tipos de oferta`,
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
        label: `${draft.voteCountMin}+ votos`,
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
        label: sortLabel(draft.sortBy ?? 'popularity.desc'),
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
        label: 'Conteúdo adulto',
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

  function apply() {
    void onApply(cloneFilters(draft))
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Fechar filtros"
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="filters-title"
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="relative z-10 flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-neutral-950 shadow-[0_-24px_80px_rgba(0,0,0,0.5)] sm:h-auto sm:max-h-[90dvh] sm:w-[min(94vw,54rem)] sm:rounded-[28px] sm:shadow-2xl"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

            <header className="shrink-0 border-b border-white/10 bg-neutral-950/95 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6 sm:pb-5 sm:pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/15">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>

                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
                      Personalizar
                    </span>
                  </div>

                  <h2
                    id="filters-title"
                    className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]"
                  >
                    Encontre o filme certo
                  </h2>

                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/50">
                    Ajuste apenas o que importa. As opções extras ficam
                    organizadas abaixo para não poluir a tela.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4">
                <ActiveFiltersSummary items={activeItems} />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5">
              <div className="mx-auto space-y-3">
                <FilterSection
                  title="Onde assistir"
                  description="Streaming, região e forma de disponibilidade."
                  icon={<Tv className="h-4 w-4" />}
                  badge={streamingBadge}
                  defaultOpen
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-medium text-white/85">
                          Seus streamings
                        </h5>
                        <p className="text-xs text-white/40">
                          Selecione um ou mais. A busca usa OU entre eles.
                        </p>
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
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                        Tipo de oferta
                      </span>

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
                              {label}
                            </FilterChip>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                        Região do catálogo
                      </span>

                      <Select
                        value={draft.watchRegion ?? 'BR'}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            watchRegion: value,
                          }))
                        }
                        options={REGIONS}
                      />
                    </div>
                  </div>
                </FilterSection>

                <FilterSection
                  title="Gêneros"
                  description="Escolha o que quer ver e o que prefere evitar."
                  icon={<Tags className="h-4 w-4" />}
                  badge={genresBadge}
                  defaultOpen
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-sm font-medium text-white/80">
                          Quero ver
                        </span>
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
                              {genre.name}
                            </FilterChip>
                          )
                        })}
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        <span className="text-sm font-medium text-white/80">
                          Quero evitar
                        </span>
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
                              {genre.name}
                            </FilterChip>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </FilterSection>

                <FilterSection
                  title="Período e duração"
                  description="Defina quando o filme foi lançado e quanto tempo ele pode durar."
                  icon={<CalendarRange className="h-4 w-4" />}
                  badge={periodBadge}
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white/80">
                          Ano de lançamento
                        </span>
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
                          label="De"
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
                          label="Até"
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
                        <span className="text-sm font-medium text-white/80">
                          Duração
                        </span>
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
                          label="Mínimo"
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
                          label="Máximo"
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

                <FilterSection
                  title="Qualidade e idioma"
                  description="Nota mínima, idioma original e forma de ordenar os resultados."
                  icon={<Star className="h-4 w-4" />}
                  badge={qualityBadge}
                >
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                        Nota mínima
                      </span>

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
                            {value === 0 ? 'Qualquer' : `${value}+`}
                          </FilterChip>
                        ))}
                      </div>

                      <div className="mt-3">
                        <NumberField
                          label="Personalizado"
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
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                        Idioma original
                      </span>

                      <Select
                        value={draft.language ?? ''}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            language: value,
                          }))
                        }
                        options={LANGUAGES}
                      />
                    </div>

                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                        Ordenar resultados
                      </span>

                      <Select
                        value={draft.sortBy ?? 'popularity.desc'}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            sortBy: value,
                          }))
                        }
                        options={SORT_OPTIONS}
                      />
                    </div>
                  </div>
                </FilterSection>

                <FilterSection
                  title="Avançado"
                  description="Ajustes menos usados para refinar ainda mais a busca."
                  icon={<Settings2 className="h-4 w-4" />}
                  badge={advancedBadge}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-white/40" />
                        <span className="text-sm font-medium text-white/80">
                          Popularidade mínima
                        </span>
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
                            {value === 0 ? 'Sem mínimo' : `${value}+ votos`}
                          </FilterChip>
                        ))}
                      </div>

                      <div className="mt-3">
                        <NumberField
                          label="Personalizado"
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
                        <span className="text-sm font-medium text-white/80">
                          Conteúdo adulto
                        </span>
                      </div>

                      <p className="mb-3 text-xs leading-relaxed text-white/45">
                        Requer confirmação de maioridade. A data de nascimento
                        não é armazenada.
                      </p>

                      <button
                        type="button"
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
                          <span className="block text-sm font-medium text-white/85">
                            Permitir conteúdo 18+
                          </span>
                          <span className="mt-0.5 block text-xs text-white/40">
                            {draft.includeAdult
                              ? 'Ativado nesta seleção'
                              : 'Desativado'}
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
                      </button>
                    </div>
                  </div>
                </FilterSection>
              </div>
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-neutral-950/95 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-xl sm:px-5 sm:pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.075] hover:text-white"
                  title="Limpar filtros"
                  aria-label="Limpar filtros"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="hidden h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/65 transition hover:bg-white/[0.075] hover:text-white sm:block"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={apply}
                  disabled={!isDirty}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 shadow-[0_10px_30px_rgba(52,211,153,0.16)] transition hover:bg-emerald-300 disabled:cursor-default disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none"
                >
                  <Check className="h-4 w-4" />
                  {isDirty
                    ? `Aplicar ${activeItems.length || ''} ${
                        activeItems.length === 1 ? 'filtro' : 'filtros'
                      }`.trim()
                    : 'Filtros aplicados'}
                </button>
              </div>

              {isDirty ? (
                <p className="mt-2 text-center text-[11px] text-amber-200/55">
                  Você tem alterações que ainda não foram aplicadas.
                </p>
              ) : null}
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
