// src/pages/Swipe.tsx
import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  discoverMovies,
  getMovieDetails,
  type MovieDetails,
  type DiscoverFilters,
  type MonetizationType,
} from '../lib/functions'
import { Heart, X as XIcon, Share2, Star, Undo2, SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Toaster, toast } from 'sonner'
import AgeGateModal from '../components/AgeGateModal'
import AdSlot from '../components/AdSlot'
import AdblockWall from '../components/AdblockWall'
import confetti from 'canvas-confetti'
import { ensureAnonymousUser } from '../lib/auth'
import SwipeCard, {
  type SwipeCardHandle,
  type SwipeMovie,
} from '../components/swipe/SwipeCard'
import AdSwipeCard from '../components/swipe/AdSwipeCard'
import {
  clearProgress,
  filtersSig,
  loadProgress,
  saveProgress,
} from '../lib/swipeProgress'

import {
  hash32,
  shuffleWithinWindows,
} from '../lib/swipeShuffle'

import FilterModal from '../components/swipe/FilterModal'

type Movie = SwipeMovie

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (isRecord(error)) {
    const message = error.message

    if (typeof message === 'string' && message.length > 0) {
      return message
    }

    try {
      return JSON.stringify(error)
    } catch {
      return 'Erro desconhecido'
    }
  }

  return String(error)
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback
}

function toString(value: unknown, fallback: string): string {
  return typeof value === 'string'
    ? value
    : fallback
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []

  return value
    .map(Number)
    .filter(Number.isFinite)
}

const MONETIZATION_TYPES = new Set<MonetizationType>([
  'flatrate',
  'free',
  'ads',
  'rent',
  'buy',
])

function toMonetizationTypes(
  value: unknown,
): MonetizationType[] {
  if (!Array.isArray(value)) {
    return ['flatrate']
  }

  return value.filter(
    (item): item is MonetizationType =>
      typeof item === 'string' &&
      MONETIZATION_TYPES.has(
        item as MonetizationType,
      ),
  )
}

// tempo pro exit terminar antes de liberar clique
const EXIT_DURATION_MS = 400

type OnlineUser = { id: string; name: string }

function Swipe() {
  const { code } = useParams()
  const bootVersionRef = useRef(0)

  // estado
  const [movies, setMovies] = useState<Movie[]>([])
  const [i, setI] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [discoverHint, setDiscoverHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)

  // sessão/usuário
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName] = useState('Guest')

  // cache TMDB
  const [detailsCache, setDetailsCache] = useState<Record<number, MovieDetails>>({})

  // aux
  const matchedRef = useRef(new Set<number>())
  const seenRef = useRef(new Set<number>())
  const userIdRef = useRef<string | null>(null)
  const adsShown = useRef(0)
  const consumedAdStepsRef = useRef(new Set<number>())
  const suppressAdForMovieIndexRef = useRef<number | null>(null)
  const reactedTmdbRef = useRef(new Set<number>()) // tmdb_ids já swipados pelo usuário na sessão
  const matchChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // histórico p/ UNDO (guarda movie.id real)
  const historyRef = useRef<number[]>([])

  // banner UNDO
  const [undoMsg, setUndoMsg] = useState<string | null>(null)

  // modal de match
  const [matchModal, setMatchModal] = useState<{ title: string; poster_url: string | null; year?: number | null } | null>(null)

  // guard para clicks rápidos
  const clickGuardRef = useRef(false)

  // presença
  const [online, setOnline] = useState<OnlineUser[]>([])

  // filtros
  const currentYear = new Date().getFullYear()
  const DEFAULT_FILTERS: DiscoverFilters = {
    genres: [],
    excludeGenres: [],
    yearMin: 1990,
    yearMax: currentYear,
    ratingMin: 0,
    voteCountMin: 0,
    runtimeMin: 60,
    runtimeMax: 220,
    language: '',
    sortBy: 'popularity.desc',
    includeAdult: false,
    providers: [],
    watchRegion: 'BR',
    monetization: ['flatrate'],
  }

  const [filters, setFilters] = useState<DiscoverFilters>({ ...DEFAULT_FILTERS })
  const [openFilters, setOpenFilters] = useState(false)

  // verificação de idade
  const [isAdult, setIsAdult] = useState(false)
  const [showAgeGate, setShowAgeGate] = useState(false)

  const [isPremium, setIsPremium] = useState(false)

  // “novo match” (badge na estrela)
  const [latestMatchAt, setLatestMatchAt] = useState<number>(0)
  const LS_KEY = sessionId ? `mm:lastSeenMatch:${sessionId}` : ''
  const lastSeenMatchAt = useMemo(() => (LS_KEY ? Number(localStorage.getItem(LS_KEY) || 0) : 0), [LS_KEY])
  const hasNewMatch = !!(latestMatchAt && latestMatchAt > lastSeenMatchAt)

  const current = movies[i]


  const adSeed = `${sessionId ?? 's'}:${userIdRef.current ?? 'u'}:${filtersSig(filters)}`
  const adInterval = 8 + (hash32(adSeed) % 5) // 8..12 por usuário/sessão/filtros
  const adOffset = hash32(adSeed + ':o') % adInterval
  const totalSteps = i + adsShown.current
  const isAdStep =
    !isPremium &&
    totalSteps > 0 &&
    suppressAdForMovieIndexRef.current !== i &&
    (
      (totalSteps - adOffset) %
        adInterval ===
      0
    ) &&
    !consumedAdStepsRef.current.has(
      totalSteps,
    )

  const filtersCount = [
    (filters.genres?.length ?? 0) > 0,

    (filters.excludeGenres?.length ?? 0) > 0,

    filters.yearMin !==
      DEFAULT_FILTERS.yearMin,

    filters.yearMax !==
      DEFAULT_FILTERS.yearMax,

    filters.ratingMin !==
      DEFAULT_FILTERS.ratingMin,

    filters.voteCountMin !==
      DEFAULT_FILTERS.voteCountMin,

    filters.runtimeMin !==
      DEFAULT_FILTERS.runtimeMin,

    filters.runtimeMax !==
      DEFAULT_FILTERS.runtimeMax,

    filters.language !==
      DEFAULT_FILTERS.language,

    filters.sortBy !==
      DEFAULT_FILTERS.sortBy,

    filters.includeAdult !==
      DEFAULT_FILTERS.includeAdult,

    (filters.providers?.length ?? 0) > 0,

    filters.watchRegion !==
      DEFAULT_FILTERS.watchRegion,

    [...(filters.monetization ?? [])]
      .sort()
      .join(',') !==
      [...(DEFAULT_FILTERS.monetization ?? [])]
        .sort()
        .join(','),
  ].filter(Boolean).length

    type LoadPageResult = {
      added: number
      hasMore: boolean
    }

  const loadPage = useCallback(
    async (
      pageToLoad: number,
      f: DiscoverFilters = filters,
    ): Promise<LoadPageResult> => {
      try {
        const data = await discoverMovies({
          page: pageToLoad,
          filters: f,
        })

        if (pageToLoad === 1) {
          setDiscoverHint(data?.hint ?? null)
        }

        const sourceResults = data?.results ?? []

        const baseSeed =
          `${sessionId ?? 'nosess'}:` +
          `${userIdRef.current ?? 'nouser'}`

        const filtered = sourceResults.filter(
          (movie: Movie) => {
            const tmdbId = Number(movie.tmdb_id)

            return (
              !seenRef.current.has(movie.movie_id) &&
              !reactedTmdbRef.current.has(tmdbId)
            )
          },
        )

        const unique = shuffleWithinWindows(
          filtered,
          baseSeed,
        )

        unique.forEach((movie: Movie) => {
          seenRef.current.add(movie.movie_id)
        })

        if (unique.length > 0) {
          setMovies((previous) => [
            ...previous,
            ...unique,
          ])

          setPage(pageToLoad)
        }

        const totalPages = Number(
          data?.total_pages,
        )

        const hasMore =
          sourceResults.length > 0 &&
          (
            !Number.isFinite(totalPages) ||
            pageToLoad < totalPages
          )

        return {
          added: unique.length,
          hasMore,
        }
      } catch (error: unknown) {
        console.error(
          'discoverMovies error:',
          error,
        )

        toast.error(
          `Falha ao buscar filmes: ${getErrorMessage(error)}`,
        )

        return {
          added: 0,
          hasMore: false,
        }
      }
    },
    [filters, sessionId],
  )

  const resetAndLoad = useCallback(
    async (
      resume = false,
      f?: DiscoverFilters,
      sessionRef?: string | null,
    ) => {
      const effective = f ?? filters
      const sid = sessionRef ?? sessionId
      const myVersion =
        bootVersionRef.current

      setLoading(true)

      adsShown.current = 0
      consumedAdStepsRef.current.clear()
      suppressAdForMovieIndexRef.current = null

      setNoResults(false)
      setDiscoverHint(null)

      setMovies([])
      setI(0)
      setPage(1)

      seenRef.current.clear()

      try {
        const target = resume
          ? loadProgress(
              sid,
              userIdRef.current,
              effective,
            )
          : 0

        let accumulated = 0
        let pageToLoad = 1
        let anyAdded = false

        while (
          accumulated <= target &&
          pageToLoad <= 30
        ) {
          if (
            bootVersionRef.current !==
            myVersion
          ) {
            return
          }

          const result = await loadPage(
            pageToLoad,
            effective,
          )

          if (
            bootVersionRef.current !==
            myVersion
          ) {
            return
          }

          if (result.added > 0) {
            anyAdded = true
            accumulated += result.added
          }

          // A API realmente não tem mais páginas.
          if (!result.hasMore) {
            break
          }

          // Mesmo que esta página tenha trazido
          // zero filmes NOVOS, tenta a próxima.
          pageToLoad += 1
        }

        if (!anyAdded) {
          setNoResults(true)
          setI(0)
          return
        }

        const safeMax = Math.max(
          0,
          accumulated - 1,
        )

        const resolved = resume
          ? Math.min(target, safeMax)
          : 0

        setI(resolved)
      } catch (error: unknown) {
        console.error(error)

        toast.error(
          `Erro ao carregar filmes: ${getErrorMessage(error)}`,
        )
      } finally {
        if (
          bootVersionRef.current ===
          myVersion
        ) {
          setLoading(false)
        }
      }
    },
    [filters, sessionId, loadPage],
  )

  useEffect(() => {
    let cancelled = false
    const myVersion = ++bootVersionRef.current

    ;(async () => {
      try {
        // ⚠️ sanitiza o código da URL
        const CODE = String(code ?? '').trim().toUpperCase()
        if (!CODE) {
          setFatalError('Código da sessão ausente ou inválido.')
          setLoading(false)
          return
        }

        const authUser = await ensureAnonymousUser()
        const uid = authUser.id

        userIdRef.current = uid
        if (bootVersionRef.current !== myVersion || cancelled) return
        setUserId(uid)

        const { error: profileError } = await supabase
          .from('users')
          .update({ display_name: displayName })
          .eq('id', uid)

        if (profileError) throw profileError

        // ler se já é adulto
        const { data: prof } = await supabase
          .from('users')
          .select('is_adult, is_premium')
          .eq('id', uid)
          .maybeSingle()
        setIsAdult(!!prof?.is_adult)
        setIsPremium(!!prof?.is_premium)

        // ⚠️ busca da sessão com single + limit(1)
        const { data: sessionRows, error: sessErr } = await supabase.rpc(
          'join_session',
          {
            p_code: CODE,
          },
        )

        const sess = Array.isArray(sessionRows) ? sessionRows[0] : null

        if (sessErr || !sess?.id) {
          setFatalError('Sessão não encontrada. Verifique o código.')
          setLoading(false)
          return
        }

        if (bootVersionRef.current !== myVersion || cancelled) return

        setSessionId(sess.id)

        // Carrega filmes já avaliados pelo usuário nesta sessão
        // para evitar que apareçam novamente.
        try {
          const { data: rxRows, error: reactionsError } = await supabase
            .from('reactions')
            .select('movie_id')
            .eq('session_id', sess.id)
            .eq('user_id', uid)

          if (reactionsError) throw reactionsError

          const ids = (rxRows ?? []).map((row) => row.movie_id)

          if (ids.length) {
            const { data: mvRows, error: moviesError } = await supabase
              .from('movies')
              .select('id, tmdb_id')
              .in('id', ids)

            if (moviesError) throw moviesError

            reactedTmdbRef.current = new Set(
              (mvRows ?? []).map((movie) => Number(movie.tmdb_id)),
            )
          }
        } catch (error) {
          console.warn('falha ao carregar reações antigas:', error)
        }

        // filtros salvos
        let effectiveFilters: DiscoverFilters = { ...DEFAULT_FILTERS }
        try {
          const { data: sf } = await supabase
            .from('session_filters')
            .select('*')
            .eq('session_id', sess.id)
            .maybeSingle()
          if (sf) {
            effectiveFilters = {
              genres: sf.genres ?? [],
              excludeGenres: sf.exclude_genres ?? [],
              yearMin: sf.year_min ?? 1990,
              yearMax: sf.year_max ?? currentYear,
              ratingMin: typeof sf.rating_min === 'number' ? Number(sf.rating_min) : 0,
              voteCountMin: typeof sf.vote_count_min === 'number' ? Number(sf.vote_count_min) : 0,
              runtimeMin: typeof sf.runtime_min === 'number' ? Number(sf.runtime_min) : 60,
              runtimeMax: typeof sf.runtime_max === 'number' ? Number(sf.runtime_max) : 220,
              language: sf.language ?? '',
              sortBy: sf.sort_by ?? 'popularity.desc',
              includeAdult: !!sf.include_adult,
              providers: Array.isArray(sf.providers) ? sf.providers : [],
              watchRegion: sf.watch_region ?? 'BR',
              monetization: Array.isArray(sf.monetization) ? sf.monetization : ['flatrate'],
            }
          }
        } catch {
          // Se os filtros salvos não puderem ser lidos, mantém os filtros padrão.
        }

        if (bootVersionRef.current !== myVersion || cancelled) return
        setFilters(effectiveFilters)

        // retomar progresso de forma segura
        await resetAndLoad(true, effectiveFilters, sess.id)
      } catch (error: unknown) {
        console.error(error)
        const msg = getErrorMessage(error)
        setFatalError(msg)
        toast.error(`Erro ao preparar a sessão: ${msg}`)
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, displayName])


  // carrega detalhes do atual
  useEffect(() => {
    (async () => {
      if (!current) return
      const key = current.tmdb_id
      if (detailsCache[key]) return
      try {
        const det = await getMovieDetails(key, { region: filters.watchRegion ?? 'BR' })
        setDetailsCache(prev => {
          const next: Record<number, MovieDetails> = { ...prev, [key]: det }
          const keys = Object.keys(next)
          if (keys.length > 300) delete next[Number(keys[0]) as unknown as number]
          return next
        })
      } catch (e) {
        console.error('details error', e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.tmdb_id])

  // PREFETCH dos PRÓXIMOS
  useEffect(() => {
    if (!movies.length) return
    const toPrefetch = [i + 1, i + 2]
    toPrefetch.forEach(idx => {
      const m = movies[idx]
      if (!m) return
      const key = m.tmdb_id
      if (!detailsCache[key]) {
        getMovieDetails(key, { region: filters.watchRegion ?? 'BR' })
          .then(det => {
            setDetailsCache(prev => {
              const next: Record<number, MovieDetails> = { ...prev, [key]: det }
              const keys = Object.keys(next)
              if (keys.length > 300) delete next[Number(keys[0]) as unknown as number]
              return next
            })
          })
          .catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, movies])

  const checkMatch = useCallback(
    async (movieId: number, notifyPeers = true) => {
      if (!sessionId || matchedRef.current.has(movieId)) return

      // A decisão de match fica no banco:
      // todos os integrantes da sessão precisam ter dado like.
      const {
        data: matchRows,
        error: matchError,
      } = await supabase.rpc(
        'check_session_match',
        {
          p_session_id: sessionId,
          p_movie_id: movieId,
        },
      )

      if (matchError) {
        console.error(
          'match check failed:',
          matchError,
        )
        return
      }

      const matchResult = Array.isArray(matchRows)
        ? matchRows[0]
        : null

      if (!matchResult?.is_match) return

      // Evita duas chamadas concorrentes abrirem o mesmo match.
      if (matchedRef.current.has(movieId)) return
      matchedRef.current.add(movieId)

      const { data: movie, error: movieError } = await supabase
        .from('movies')
        .select('title, year, poster_url')
        .eq('id', movieId)
        .maybeSingle()

      if (movieError) {
        matchedRef.current.delete(movieId)
        console.error(
          'match movie lookup failed:',
          movieError,
        )
        return
      }

      setMatchModal({
        title: movie?.title ?? `Filme #${movieId}`,
        poster_url: movie?.poster_url ?? null,
        year: movie?.year ?? null,
      })

      setLatestMatchAt(Date.now())

      if (notifyPeers && matchChannelRef.current) {
        void matchChannelRef.current.send({
          type: 'broadcast',
          event: 'match_found',
          payload: {
            movie_id: movieId,
          },
        })
      }
    },
    [sessionId],
  )

  // realtime de match
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`sess-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!isRecord(payload.new)) return

          if (Number(payload.new.value) !== 1) return

          const movieId = Number(payload.new.movie_id)

          if (!movieId) return

          void checkMatch(movieId)
        },
      )
      .on(
        'broadcast',
        {
          event: 'match_found',
        },
        (message) => {
          const payload =
            isRecord(message) && isRecord(message.payload)
              ? message.payload
              : null

          if (!payload) return

          const movieId = Number(payload.movie_id)

          if (!movieId) return

          // Confirma no banco antes de mostrar o match recebido.
          void checkMatch(movieId, false)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          matchChannelRef.current = channel
        }
      })

    return () => {
      if (matchChannelRef.current === channel) {
        matchChannelRef.current = null
      }

      void supabase.removeChannel(channel)
    }
  }, [sessionId, checkMatch])

  // presença
  useEffect(() => {
    if (!sessionId || !userId) return
    const ch = supabase.channel(`presence-${sessionId}`, { config: { presence: { key: userId } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, unknown[]>
      const arr: OnlineUser[] = []

      Object.values(state).forEach((metas) => {
        metas.forEach((meta) => {
          if (!isRecord(meta)) return

          arr.push({
            id: String(meta.user_id ?? meta.key ?? ''),
            name: String(meta.display_name ?? 'Guest'),
          })
        })
      })

      const dedup = Array.from(
        new Map(arr.map((user) => [user.id, user])).values(),
      )

      setOnline(dedup)
    })

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.track({ user_id: userId, display_name: displayName, joined_at: new Date().toISOString() })
      }
    })
    return () => {
      void ch.untrack().catch((error) => {
        console.error('presence untrack failed:', error)
      })

      void supabase.removeChannel(ch)
    }
  }, [sessionId, userId, displayName])

  // Sincronização dos filtros pelo próprio banco.
  //
  // session_filters faz parte da publicação
  // supabase_realtime. Assim, a alteração persistida
  // no PostgreSQL é também a fonte do evento enviado
  // aos outros participantes.
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`filters-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_filters',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          try {
            if (!isRecord(payload.new)) return

            const row = payload.new

            // Quem fez a alteração já aplicará os
            // filtros localmente após o upsert.
            // Ignorar o próprio evento evita um
            // segundo reset desnecessário.
            if (
              row.updated_by &&
              userId &&
              String(row.updated_by) ===
                String(userId)
            ) {
              return
            }

            const nextFilters: DiscoverFilters = {
              genres: toNumberArray(
                row.genres,
              ),

              excludeGenres: toNumberArray(
                row.exclude_genres,
              ),

              yearMin: toNumber(
                row.year_min,
                1990,
              ),

              yearMax: toNumber(
                row.year_max,
                new Date().getFullYear(),
              ),

              ratingMin: toNumber(
                row.rating_min,
                0,
              ),

              voteCountMin: toNumber(
                row.vote_count_min,
                0,
              ),

              runtimeMin: toNumber(
                row.runtime_min,
                60,
              ),

              runtimeMax: toNumber(
                row.runtime_max,
                220,
              ),

              language: toString(
                row.language,
                '',
              ),

              sortBy: toString(
                row.sort_by,
                'popularity.desc',
              ),

              includeAdult: Boolean(
                row.include_adult,
              ),

              providers: toNumberArray(
                row.providers,
              ),

              watchRegion: toString(
                row.watch_region,
                'BR',
              ),

              monetization:
                toMonetizationTypes(
                  row.monetization,
                ),
            }

            setFilters(nextFilters)

            // A região e os provedores podem alterar
            // os detalhes disponíveis dos filmes.
            setDetailsCache({})

            clearProgress(
              sessionId,
              userIdRef.current,
              nextFilters,
            )

            void resetAndLoad(
              false,
              nextFilters,
              sessionId,
            )
          } catch (error) {
            console.error(
              'erro ao aplicar filtros via realtime:',
              error,
            )
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(
            'falha no realtime de filtros',
          )
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    sessionId,
    userId,
    resetAndLoad,
  ])

  useEffect(() => {
    if (!matchModal) return
    const t = setTimeout(() => {
      confetti({ particleCount: 100, spread: 70, startVelocity: 45, origin: { y: 0.3 } })
    }, 120)
    return () => clearTimeout(t)
  }, [matchModal])

  // ===== animação imperativa p/ botões/teclas =====
  const cardRef = useRef<SwipeCardHandle | null>(null)

  // ============== FUNÇÕES ESTÁVEIS ==============
  const goNext = useCallback(async () => {
    const nextIndex = i + 1

    if (nextIndex < movies.length) {
      setI(nextIndex)

      saveProgress(
        sessionId,
        userIdRef.current,
        filters,
        nextIndex,
      )

      return
    }

    if (loadingMore) return

    setLoadingMore(true)

    try {
      let nextPage = page + 1

      let result = await loadPage(
        nextPage,
      )

      let attempts = 0

      while (
        result.added === 0 &&
        result.hasMore &&
        attempts < 10
      ) {
        attempts += 1
        nextPage += 1

        result = await loadPage(
          nextPage,
        )
      }

      if (result.added > 0) {
        const newIndex = movies.length

        setI(newIndex)

        saveProgress(
          sessionId,
          userIdRef.current,
          filters,
          newIndex,
        )
      }
    } finally {
      setLoadingMore(false)
    }
  }, [
    i,
    movies.length,
    sessionId,
    filters,
    loadingMore,
    loadPage,
    page,
  ])

  const react = useCallback(
    async (
      value: 1 | -1,
      options?: { skipAnimation?: boolean },
    ) => {
      if (!sessionId || !userId || !current) return

      // ===== CARD DE ANÚNCIO =====
      if (isAdStep) {
        if (!options?.skipAnimation) {
          cardRef.current?.swipe(value)
        }

        clickGuardRef.current = true
        setBusy(true)

        const releaseDelay = options?.skipAnimation
          ? 360
          : EXIT_DURATION_MS

        try {
          // Anúncio não gera reação no banco.
        } finally {
          await new Promise((res) =>
            setTimeout(res, 16),
          )

          consumedAdStepsRef.current.add(
            totalSteps,
          )

          adsShown.current += 1

          setTimeout(() => {
            clickGuardRef.current = false
            setBusy(false)
          }, releaseDelay + 60)
        }

        return
      }

      // ===== CARD DE FILME =====
      if (clickGuardRef.current || busy) return

      if (!options?.skipAnimation) {
        cardRef.current?.swipe(value)
      }

      clickGuardRef.current = true
      setBusy(true)

      const releaseDelay = options?.skipAnimation
        ? 360
        : EXIT_DURATION_MS

      // Só vamos avançar para o próximo filme
      // se a reação realmente for salva.
      let reactionSaved = false

      try {
        const {
          data: insertedMovie,
          error: movieErr,
        } = await supabase
          .from('movies')
          .upsert(
            {
              tmdb_id: current.tmdb_id,
              title: current.title,
              year: current.year ?? null,
              poster_url:
                current.poster_url ?? null,
            },
            {
              onConflict: 'tmdb_id',
              ignoreDuplicates: true,
            },
          )
          .select('id')
          .maybeSingle()

        if (movieErr) throw movieErr

        let movieId = Number(
          insertedMovie?.id,
        )

        // Se o filme já existia, o upsert com
        // ignoreDuplicates pode não retornar o ID.
        if (!movieId) {
          const {
            data: existingMovie,
            error: existingMovieError,
          } = await supabase
            .from('movies')
            .select('id')
            .eq(
              'tmdb_id',
              current.tmdb_id,
            )
            .maybeSingle()

          if (existingMovieError) {
            throw existingMovieError
          }

          movieId = Number(
            existingMovie?.id,
          )
        }

        if (!movieId) {
          throw new Error(
            'Falha ao obter movie.id',
          )
        }

        const { error: rxErr } =
          await supabase
            .from('reactions')
            .upsert(
              {
                session_id: sessionId,
                user_id: userId,
                movie_id: movieId,
                value,
              },
              {
                onConflict:
                  'session_id,user_id,movie_id',
              },
            )

        if (rxErr) throw rxErr

        // A partir daqui sabemos que a reação
        // realmente foi gravada no banco.
        reactionSaved = true

        if (value === 1) {
          await checkMatch(movieId)
        }

        historyRef.current.push(movieId)

        reactedTmdbRef.current.add(
          Number(current.tmdb_id),
        )
      } catch (error: unknown) {
        console.error(
          'reactions upsert error:',
          error,
        )

        toast.error(
          `Erro ao salvar reação: ${getErrorMessage(error)}`,
        )

        // Se a reação não foi salva, traz o
        // card de volta para o centro.
        cardRef.current?.reset()
      } finally {
        if (reactionSaved) {
          // Se este filme veio de um Undo,
          // a supressão de anúncio termina
          // somente após a reação ser salva.
          if (
            suppressAdForMovieIndexRef.current ===
            i
          ) {
            suppressAdForMovieIndexRef.current =
              null
          }

          await new Promise((res) =>
            setTimeout(res, 16),
          )

          await goNext()
        }

        setTimeout(() => {
          clickGuardRef.current = false
          setBusy(false)
        }, releaseDelay + 60)
      }
    },
    [
      sessionId,
      userId,
      current,
      busy,
      goNext,
      i,
      isAdStep,
      totalSteps,
      checkMatch,
    ],
  )

  const undo = useCallback(async () => {
    if (
      !sessionId ||
      !userId ||
      busy ||
      isAdStep
    ) {
      return
    }

    // IMPORTANTE:
    // aqui NÃO usamos pop() ainda.
    // Primeiro verificamos qual foi a última
    // reação.
    const last =
      historyRef.current[
        historyRef.current.length - 1
      ]

    if (!last) return

    setBusy(true)

    try {
      // Primeiro apagamos a reação do banco.
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('movie_id', last)

      if (error) throw error

      // Somente depois de confirmar que o
      // banco apagou a reação retiramos do
      // histórico local.
      historyRef.current.pop()

      setI((index) => {
        const previousIndex =
          Math.max(0, index - 1)

        // Garante que o filme restaurado
        // pelo Undo não vire um anúncio.
        suppressAdForMovieIndexRef.current =
          previousIndex

        saveProgress(
          sessionId,
          userIdRef.current,
          filters,
          previousIndex,
        )

        return previousIndex
      })

      try {
        const { data: mv } =
          await supabase
            .from('movies')
            .select('tmdb_id')
            .eq('id', last)
            .maybeSingle()

        if (mv?.tmdb_id != null) {
          reactedTmdbRef.current.delete(
            Number(mv.tmdb_id),
          )
        }
      } catch (error) {
        console.error(
          'failed to restore reacted movie state:',
          error,
        )
      }

      setUndoMsg(
        'Último swipe desfeito',
      )

      setTimeout(
        () => setUndoMsg(null),
        1800,
      )
    } catch (error: unknown) {
      console.error(error)

      toast.error(
        `Não foi possível desfazer: ${getErrorMessage(error)}`,
      )
    } finally {
      setBusy(false)
    }
  }, [
    sessionId,
    userId,
    busy,
    filters,
    isAdStep,
  ])

  // atalhos de teclado
  const reactRef = useRef(react)
  const undoRef = useRef(undo)
  useEffect(() => { reactRef.current = react }, [react])
  useEffect(() => { undoRef.current = undo }, [undo])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || dragging) return
      if (e.key === 'ArrowRight') { e.preventDefault(); reactRef.current?.(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); reactRef.current?.(-1) }
      else if (e.key === 'Backspace') { e.preventDefault(); undoRef.current?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, dragging])
  // ===============================================

  async function shareInvite() {
  const invite = `${window.location.origin}/join?code=${(code ?? '').toUpperCase()}`
  const title = 'MovieMatch — junte-se à minha sessão'
  const text = `Entre com o código ${String(code ?? '').toUpperCase()} no MovieMatch`

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url: invite })
      return
    }
    await navigator.clipboard.writeText(invite)
    toast('Link copiado!', { description: invite })
  } catch {
    try {
      await navigator.clipboard.writeText(invite)
      toast('Link copiado!', { description: invite })
    } catch (error) {
      console.error('clipboard write failed:', error)
      toast.error('Não foi possível copiar o link.')
    }
  }
}

  // A verificação apenas autoriza o usuário a selecionar conteúdo adulto.
  // O filtro só é efetivamente aplicado pelo FilterModal ao clicar em Aplicar.
  const confirmAdult = async (birthdateISO?: string) => {
    if (!birthdateISO) {
      toast.error(
        'Informe sua data de nascimento para ativar conteúdo adulto.',
      )
      setIsAdult(false)
      setShowAgeGate(true)
      return
    }

    const age = calcAge(birthdateISO)

    if (age < 18) {
      toast.error(
        'Você precisa ter 18+ para ver esse conteúdo.',
      )
      setIsAdult(false)
      setShowAgeGate(false)
      return
    }

    try {
      if (userId) {
        const { error } = await supabase
          .from('users')
          .update({ is_adult: true })
          .eq('id', userId)

        if (error) throw error
      } else {
        try {
          localStorage.setItem('mm:isAdult', '1')
        } catch (error) {
          console.error(
            'failed to persist adult status locally:',
            error,
          )
        }
      }

      setIsAdult(true)
      setShowAgeGate(false)

      toast.success(
        'Verificação concluída. Conteúdo adulto autorizado.',
      )
    } catch (error: unknown) {
      toast.error(
        `Falha ao confirmar maioridade: ${getErrorMessage(error)}`,
      )
      setIsAdult(false)
      setShowAgeGate(true)
    }
  }

  const cancelAdult = () => {
    setShowAgeGate(false)
  }

  async function applyFilters(
    filterSnapshot: DiscoverFilters,
  ) {
    const nextFilters: DiscoverFilters = {
      ...filterSnapshot,

      genres: [
        ...(filterSnapshot.genres ?? []),
      ],

      excludeGenres: [
        ...(filterSnapshot.excludeGenres ?? []),
      ],

      providers: [
        ...(filterSnapshot.providers ?? []),
      ],

      monetization: [
        ...(filterSnapshot.monetization ?? []),
      ],
    }

    // Em uma sessão ativa precisamos conseguir
    // identificar tanto a sessão quanto o usuário
    // antes de alterar os filtros compartilhados.
    if (!sessionId || !userId) {
      toast.error(
        'Não foi possível identificar a sessão para salvar os filtros.',
      )
      return
    }

    try {
      // Primeiro salva no banco.
      //
      // Somente depois de o Supabase confirmar
      // a gravação vamos alterar a interface local.
      const { error: filtersError } =
        await supabase
          .from('session_filters')
          .upsert(
            {
              session_id: sessionId,

              genres:
                nextFilters.genres ?? [],

              exclude_genres:
                nextFilters.excludeGenres ?? [],

              year_min:
                nextFilters.yearMin ?? 1990,

              year_max:
                nextFilters.yearMax ??
                currentYear,

              rating_min:
                nextFilters.ratingMin ?? 0,

              vote_count_min:
                nextFilters.voteCountMin ?? 0,

              runtime_min:
                nextFilters.runtimeMin ?? 60,

              runtime_max:
                nextFilters.runtimeMax ?? 220,

              language:
                nextFilters.language ?? '',

              sort_by:
                nextFilters.sortBy ??
                'popularity.desc',

              include_adult:
                !!nextFilters.includeAdult,

              updated_by: userId,

              providers:
                nextFilters.providers ?? [],

              watch_region:
                nextFilters.watchRegion ?? 'BR',

              monetization:
                nextFilters.monetization ?? [],
            },
            {
              onConflict: 'session_id',
            },
          )

      if (filtersError) {
        throw filtersError
      }

      // Somente depois do sucesso no banco
      // alteramos o estado local.
      setFilters(nextFilters)
      setOpenFilters(false)

      // Alguns detalhes dependem da região
      // e do catálogo selecionado.
      setDetailsCache({})

      clearProgress(
        sessionId,
        userIdRef.current,
        nextFilters,
      )

      // Recarrega usando exatamente os filtros
      // que acabaram de ser persistidos.
      await resetAndLoad(
        false,
        nextFilters,
        sessionId,
      )
    } catch (error: unknown) {
      console.error(
        'failed to save session filters:',
        error,
      )

      toast.error(
        `Não foi possível sincronizar os filtros: ${getErrorMessage(error)}`,
      )

      // IMPORTANTE:
      // não fecha o modal,
      // não troca os filtros locais
      // e não recarrega a lista.
    }
  }

  // —— estados de carregamento / erro —— 
  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 overflow-hidden">
        <p className="text-white/90">Carregando sessão…</p>
        {/* Anti-adblock — só mostra para não-premium */}
        <AdblockWall enabled={!isPremium} />
        <Toaster richColors position="bottom-center" />
      </main>
    )
  }

  if (fatalError) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-neutral-900 text-white">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">Não foi possível iniciar a sessão</h2>
          <p className="text-white/80 mb-4">{fatalError}</p>
          <button
            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
        <Toaster richColors position="bottom-center" />
      </main>
    )
  }

  const det = current ? detailsCache[current.tmdb_id] : undefined

  return (
    <main className="h-dvh max-h-dvh flex flex-col overflow-hidden overscroll-none bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800">
      {/* Top bar */}
      <div className="relative z-20 shrink-0 px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-2">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10 backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs text-white/80">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-white">
              <span className="hidden sm:inline">
                Sessão
              </span>

              <span className="font-semibold tracking-wide">
                {code}
              </span>
            </span>

            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {online.length} online
            </span>

            {filtersCount > 0 ? (
              <button
                type="button"
                onClick={() => setOpenFilters(true)}
                className="min-w-0 truncate rounded-full bg-white/10 px-2 py-1 text-[11px] transition hover:bg-white/15"
                title="Editar filtros"
              >
                {filtersCount} filtros
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpenFilters(true)}
              title="Filtros"
              className="rounded-md bg-white/10 p-1.5 text-white transition hover:bg-white/15"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={shareInvite}
              title="Compartilhar link"
              className="rounded-md bg-white/10 p-1.5 text-white transition hover:bg-white/15"
            >
              <Share2 className="h-4 w-4" />
            </button>

            <Link
              to={`/s/${code}/matches`}
              onClick={() => {
                if (LS_KEY) {
                  localStorage.setItem(
                    LS_KEY,
                    String(Date.now()),
                  )
                }
              }}
              data-new-match={
                hasNewMatch ? '1' : undefined
              }
              title="Ver matches"
              className="relative rounded-md bg-emerald-500 p-1.5 text-white transition hover:bg-emerald-600"
            >
              <Star className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* centro */}
      <div className="relative z-0 flex-1 min-h-0 overflow-hidden px-3 sm:px-4">
        <div className="mx-auto h-full min-h-0 w-full max-w-md">
          <div className="h-full flex flex-col">
            <div className="relative flex-1 min-h-0 overflow-hidden">
                {current ? (
                  // se for hora do anúncio, mostra AdSwipeCard; senão, o SwipeCard normal
                  isAdStep ? (
                    <AdSwipeCard
                      ref={cardRef}
                      key={`ad-${i}-${adsShown.current}`}
                      onDragState={setDragging}
                      onDecision={(v) => react(v, { skipAnimation: true })}
                    />
                  ) :
                  <SwipeCard
                    ref={cardRef}
                    key={`movie-${current.tmdb_id}`}
                    movie={current}
                    details={det}
                    onDragState={setDragging}
                    onDecision={(v) => react(v, { skipAnimation: true })}
                  />
                ) : current ? (
                  <motion.div
                    key="loading-det"
                    className="h-full grid place-items-center text-white/80"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="text-center">
                      <p>Carregando detalhes…</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="h-full grid place-items-center text-white/80"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="text-center max-w-sm">
                      {noResults ? (
                        <>
                          <p className="font-medium">Nenhum resultado com os filtros atuais.</p>
                          {discoverHint === 'relax_providers' ? (
                            <p className="text-white/60 mt-1">Dica: remova ou reduza os catálogos de streaming selecionados.</p>
                          ) : (
                            <p className="text-white/60 mt-1">Tente relaxar alguns critérios ou limpar tudo.</p>
                          )}
                          <div className="mt-3 flex items-center justify-center gap-2">
                            {/* botões existentes permanecem iguais */}
                          </div>
                        </>
                      ) : (
                        <>
                          <p>Acabaram os filmes deste lote 😉</p>
                          {loadingMore ? <p className="text-white/60 mt-1">Buscando mais filmes…</p> : null}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Banners sutis (só para não-premium) */}
      {!isPremium ? (
        <>
          <div className="hidden sm:block fixed top-3 left-3 z-40">
            <AdSlot
              id={`ad-tl-${sessionId ?? 's'}`}
              adClient="ca-pub-8257200313072326"
              adSlot="8357155401"
              width={180}
              height={180}
            />
          </div>
          <div className="hidden sm:block fixed bottom-3 right-3 z-40">
            <AdSlot
              id={`ad-br-${sessionId ?? 's'}`}
              adClient="ca-pub-8257200313072326"
              adSlot="4497801440"
              width={180}
              height={180}
            />
          </div>
        </>
      ) : null}

      {/* Ações */}
      <div className="relative z-30 shrink-0 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
        <div className="mx-auto flex max-w-md items-center justify-center gap-4 sm:gap-5">
          <motion.button
            onClick={() => react(-1)}
            disabled={busy || dragging || !current}
            className="w-12 h-12 sm:w-16 sm:h-16 grid place-items-center rounded-full bg-red-500 text-white shadow-xl disabled:opacity-60"
            aria-label="Deslike"
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <XIcon className="w-7 h-7 sm:w-8 sm:h-8" />
          </motion.button>

          <motion.button
            onClick={() => undo()}
            disabled={ busy || dragging || isAdStep || historyRef.current.length === 0}
            
            className="w-10 h-10 sm:w-12 sm:h-12 grid place-items-center rounded-full bg-white/10 text-white shadow-lg disabled:opacity-40"
            aria-label="Desfazer"
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            title="Desfazer (Backspace)"
          >
            <Undo2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>

          <motion.button
            onClick={() => react(1)}
            disabled={busy || dragging || !current}
            className="w-12 h-12 sm:w-16 sm:h-16 grid place-items-center rounded-full bg-emerald-500 text-white shadow-xl disabled:opacity-60"
            aria-label="Like"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92, rotate: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <Heart className="w-7 h-7 sm:w-8 sm:h-8" />
          </motion.button>
        </div>
      </div>

      {/* Banner UNDO */}
      <AnimatePresence>
        {undoMsg && (
          <div className="fixed top-3 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
              className="pointer-events-auto w-fit max-w-[92vw] px-3 py-1.5 rounded-md bg-white/90 text-neutral-900 text-sm text-center shadow">
              {undoMsg}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FilterModal
        open={openFilters}
        filters={filters}
        defaultFilters={DEFAULT_FILTERS}
        currentYear={currentYear}
        isAdult={isAdult}
        onRequestAdultVerification={() =>
          setShowAgeGate(true)
        }
        onClose={() => setOpenFilters(false)}
        onApply={applyFilters}
      />

      {/* Modal Match */}
      <AnimatePresence>
        {matchModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMatchModal(null)} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative z-10 w-[min(92vw,28rem)] rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-4 text-white"
            >
              <div className="flex items-center gap-3">
                {matchModal.poster_url ? (
                  <img src={matchModal.poster_url} alt={matchModal.title} className="w-16 h-24 object-cover rounded-md ring-1 ring-white/10" />
                ) : null}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">Deu match!</h3>
                  <p className="text-sm text-white/80 truncate">
                    {matchModal.title} {matchModal.year ? <span className="text-white/60">({matchModal.year})</span> : null}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setMatchModal(null)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15">Continuar</button>
                <Link
                  to={`/s/${code}/matches`}
                  className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => {
                    if (LS_KEY) localStorage.setItem(LS_KEY, String(Date.now()))
                    setLatestMatchAt(0)
                    setMatchModal(null)
                  }}
                >
                  Ver matches
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ÚNICA instância do AgeGateModal */}
      {showAgeGate ? (
        <AgeGateModal
          open
          onConfirm={confirmAdult}
          onCancel={cancelAdult}
        />
      ) : null}

      <AdblockWall enabled={!isPremium} />

      <Toaster richColors position="bottom-center" />
    </main>
  )
}

function calcAge(birthdateISO: string): number {
  const today = new Date()
  const dob = new Date(birthdateISO)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

// === ErrorBoundary local p/ esta página ===
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: unknown | undefined; stack?: string }> {
  constructor(props: { children: ReactNode }) {
  super(props)
  this.state = { error: undefined, stack: undefined }
}
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error (Swipe):', error, info)

    this.setState({
      stack: info.componentStack ?? undefined,
    })
  }
    private toMessage(error: unknown): string {
      if (error instanceof Error) {
        return error.message
      }

      try {
        const serialized = JSON.stringify(error)
        if (serialized) return serialized
      } catch {
        // Usa a conversão simples abaixo caso a serialização falhe.
      }

      return String(error)
    }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-dvh grid place-items-center p-6 bg-neutral-900 text-white">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold mb-2">Ops! Algo quebrou.</h2>
            <p className="text-white/80 mb-4">{this.toMessage(this.state.error)}</p>
            {this.state.stack ? (
            <pre className="text-xs text-white/70 bg-white/5 rounded-md p-2 overflow-auto max-h-60">
              {this.state.stack}
            </pre>
          ) : null}
            <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15" onClick={() => location.reload()}>
              Recarregar
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

// Wrapper que exportamos como default
export default function SwipePageWrapper() {
  return (
    <PageErrorBoundary>
      <Swipe />
    </PageErrorBoundary>
  )
}

