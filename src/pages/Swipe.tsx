// src/pages/Swipe.tsx
import type React from 'react'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { discoverMovies, getMovieDetails, type MovieDetails, type DiscoverFilters } from '../lib/functions'
import MovieCarousel from '../components/MovieCarousel'
import { Heart, X as XIcon, Share2, Star, Undo2, SlidersHorizontal } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls, animate } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import Select from '../components/Select'
import AgeGateModal from '../components/AgeGateModal'
import confetti from 'canvas-confetti'

type Movie = {
  movie_id: number
  tmdb_id: number
  title: string
  year: number | null
  poster_url: string | null
  genres: number[]
}

const DRAG_LIMIT = 160
const SWIPE_DISTANCE = 120
const SWIPE_VELOCITY = 800
const EXIT_DURATION_MS = 240

type OnlineUser = { id: string; name: string }

const GENRES = [
  { id: 28, name: 'Ação' }, { id: 12, name: 'Aventura' }, { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Família' }, { id: 14, name: 'Fantasia' },
  { id: 36, name: 'História' }, { id: 27, name: 'Terror' }, { id: 10402, name: 'Música' },
  { id: 9648, name: 'Mistério' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Ficção científica' },
  { id: 10770, name: 'TV Movie' }, { id: 53, name: 'Thriller' }, { id: 10752, name: 'Guerra' },
  { id: 37, name: 'Faroeste' },
]
// Principais provedores (IDs TMDB) — ajuste conforme seu público/país
const PROVIDERS_BR = [
  { id: 8,   name: 'Netflix' },
  { id: 119, name: 'Prime Video' },
  { id: 337, name: 'Disney+' },
  { id: 384, name: 'Max' },         // (HBO Max / Max)
  { id: 307, name: 'Globoplay' },
  { id: 350, name: 'Apple TV+' },
  { id: 531, name: 'Paramount+' },
  { id: 619, name: 'Star+' },       // se não retornar, remova/ajuste
]
const LANGUAGES = [
  { value: '',  label: 'Qualquer' },
  { value: 'pt', label: 'Português' }, { value: 'en', label: 'Inglês' }, { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Francês' },   { value: 'de', label: 'Alemão' },  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: 'Japonês' },   { value: 'ko', label: 'Coreano' }, { value: 'zh', label: 'Chinês' },
  { value: 'ru', label: 'Russo' },     { value: 'hi', label: 'Hindi' },   { value: 'ar', label: 'Árabe' },
  { value: 'tr', label: 'Turco' },     { value: 'nl', label: 'Holandês' },{ value: 'sv', label: 'Sueco' },
  { value: 'no', label: 'Norueguês' }, { value: 'fi', label: 'Finlandês'},{ value: 'da', label: 'Dinamarquês' },
  { value: 'pl', label: 'Polonês' },   { value: 'cs', label: 'Tcheco' },  { value: 'uk', label: 'Ucraniano' },
  { value: 'ro', label: 'Romeno' },    { value: 'el', label: 'Grego' },   { value: 'he', label: 'Hebraico' },
  { value: 'th', label: 'Tailandês' }, { value: 'id', label: 'Indonésio'},{ value: 'vi', label: 'Vietnamita' },
  { value: 'ms', label: 'Malaio' },    { value: 'ta', label: 'Tâmil' },   { value: 'fa', label: 'Persa' },
]
const REGIONS = [
  { value: 'BR', label: 'Brasil (BR)' },
  { value: 'US', label: 'Estados Unidos (US)' },
  { value: 'GB', label: 'Reino Unido (GB)' },
  { value: 'PT', label: 'Portugal (PT)' },
  { value: 'ES', label: 'Espanha (ES)' },
  { value: 'FR', label: 'França (FR)' },
  { value: 'DE', label: 'Alemanha (DE)' },
  { value: 'IT', label: 'Itália (IT)' },
  { value: 'JP', label: 'Japão (JP)' },
  { value: 'KR', label: 'Coreia do Sul (KR)' },
  { value: 'AR', label: 'Argentina (AR)' },
  { value: 'MX', label: 'México (MX)' },
]

const SORT_OPTIONS = [
  { value: 'popularity.desc',           label: 'Popularidade (↓)' },
  { value: 'popularity.asc',            label: 'Popularidade (↑)' },
  { value: 'vote_average.desc',         label: 'Nota (↓)' },
  { value: 'vote_average.asc',          label: 'Nota (↑)' },
  { value: 'vote_count.desc',           label: 'Votos (↓)' },
  { value: 'vote_count.asc',            label: 'Votos (↑)' },
  { value: 'primary_release_date.desc', label: 'Lançamento (recente)' },
  { value: 'primary_release_date.asc',  label: 'Lançamento (antigo)' },
  { value: 'revenue.desc',              label: 'Bilheteria (↓)' },
  { value: 'revenue.asc',               label: 'Bilheteria (↑)' },
  { value: 'original_title.asc',        label: 'Título A→Z' },
  { value: 'original_title.desc',       label: 'Título Z→A' },
]

export default function Swipe() {
  const { code } = useParams()

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

  // sessão/usuário
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName] = useState('Guest')

  // cache TMDB
  const [detailsCache, setDetailsCache] = useState<Record<number, MovieDetails>>({})

  // aux
  const matchedRef = useRef(new Set<number>())
  const seenRef = useRef(new Set<number>())

  // direção do último swipe
  const [lastDir, setLastDir] = useState<'like' | 'dislike' | null>(null)

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

  // 🔎 filtros
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
    monetization: ['flatrate'], // padrão: streaming por assinatura
  }

  const [filters, setFilters] = useState<DiscoverFilters>({ ...DEFAULT_FILTERS })
  const [openFilters, setOpenFilters] = useState(false)

  // verificação de idade
  const [isAdult, setIsAdult] = useState(false)
  const [showAgeGate, setShowAgeGate] = useState(false)

  // “novo match” (badge na estrela)
  const [latestMatchAt, setLatestMatchAt] = useState<number>(0)
  const LS_KEY = sessionId ? `mm:lastSeenMatch:${sessionId}` : ''
  const lastSeenMatchAt = useMemo(() => (LS_KEY ? Number(localStorage.getItem(LS_KEY) || 0) : 0), [LS_KEY])
  const hasNewMatch = !!(latestMatchAt && latestMatchAt > lastSeenMatchAt)

  const current = movies[i]

  const filtersCount =
    (filters.genres?.length ?? 0) +
    (filters.excludeGenres?.length ?? 0) +
    (filters.yearMin ? 1 : 0) +
    (filters.yearMax ? 1 : 0) +
    ((filters.ratingMin ?? 0) > 0 ? 1 : 0) +
    (filters.language && filters.language !== '' ? 1 : 0) +
    (filters.sortBy && filters.sortBy !== 'popularity.desc' ? 1 : 0)+
    (filters.watchRegion ? 1 : 0) +
    ((filters.providers?.length ?? 0) > 0 ? 1 : 0) +
    ((filters.monetization?.length ?? 0) > 0 ? 1 : 0);

  const loadPage = useCallback(async (pageToLoad: number, f: DiscoverFilters = filters) => {
    const data = await discoverMovies({ page: pageToLoad, filters: f })
    if (pageToLoad === 1) setDiscoverHint(data?.hint ?? null)

    const unique = data.results.filter((m: Movie) => !seenRef.current.has(m.movie_id))
    unique.forEach((m: Movie) => seenRef.current.add(m.movie_id))
    if (unique.length > 0) {
      setMovies(prev => [...prev, ...unique])
      setPage(pageToLoad)
    }
    return unique.length
  }, [filters])

  const resetAndLoad = useCallback(async (resume = false, f?: DiscoverFilters, sessionRef?: string | null) => {
    const effective = f ?? filters
    const sid = sessionRef ?? sessionId
    setLoading(true)
    setNoResults(false)
    setDiscoverHint(null)
    setMovies([]); setI(0); setPage(1)
    seenRef.current.clear()
    try {
      const target = resume ? loadProgress(sid, effective) : 0
      let acc = 0
      let pageToLoad = 1
      let anyAdded = false
      while (acc <= target) {
        const added = await loadPage(pageToLoad, effective)
        if (added > 0) anyAdded = true
        if (added === 0) break
        acc += added
        pageToLoad++
        if (pageToLoad > 30) break
      }
      if (!anyAdded) setNoResults(true)
      setI(resume ? target : 0)
    } catch (e: any) {
      console.error(e)
      toast.error(`Erro ao carregar filmes: ${e.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [filters, sessionId, loadPage])


  useEffect(() => {
    (async () => {
      try {
        if (!code) return
        let { data: userData } = await supabase.auth.getUser()
        if (!userData?.user) {
          const { data: auth, error: authErr } = await supabase.auth.signInAnonymously()
          if (authErr) throw authErr
          userData = { user: auth.user! }
        }
        const uid = userData.user!.id
        setUserId(uid)

        await supabase.from('users').upsert({ id: uid, display_name: displayName })

        // ler se já é adulto
        const { data: prof } = await supabase
          .from('users')
          .select('is_adult')
          .eq('id', uid)
          .maybeSingle()
        setIsAdult(!!prof?.is_adult)

        const { data: sess, error: sessErr } = await supabase
          .from('sessions').select('id, code').eq('code', code!.toUpperCase()).single()
        if (sessErr) throw sessErr
        setSessionId(sess.id)

        await supabase.from('session_members').upsert({ session_id: sess.id, user_id: uid }, { onConflict: 'session_id,user_id' })

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
        } catch {}
        setFilters(effectiveFilters)

        // retomar progresso
        await resetAndLoad(true, effectiveFilters, sess.id)
      } catch (e: any) {
        console.error(e)
        toast.error(`Erro ao preparar a sessão: ${e.message ?? e}`)
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, displayName])

  // carrega detalhes do atual
  useEffect(() => {
    (async () => {
      if (!current) return
      const key = current.tmdb_id
      if (detailsCache[key]) return
      try {
        const det = await getMovieDetails(key)
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
        getMovieDetails(key)
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

  // realtime de match
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`sess-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          if (payload.new?.value !== 1) return
          const movieId = payload.new.movie_id as number

          const { count } = await supabase
            .from('reactions')
            .select('user_id', { count: 'exact', head: true })
            .eq('session_id', sessionId)
            .eq('movie_id', movieId)
            .eq('value', 1)

          if ((count ?? 0) >= 2 && !matchedRef.current.has(movieId)) {
            matchedRef.current.add(movieId)
            const { data: mv } = await supabase
              .from('movies')
              .select('title, year, poster_url')
              .eq('id', movieId)
              .maybeSingle()

            const title = mv?.title ?? `Filme #${movieId}`
            setMatchModal({ title, poster_url: mv?.poster_url ?? null, year: mv?.year ?? null })
            setLatestMatchAt(Date.now())
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // inicializa badge "novo match"
  useEffect(() => {
    if (!sessionId) return
    ;(async () => {
      const { data, error } = await supabase
        .from('reactions')
        .select('movie_id, user_id, created_at')
        .eq('session_id', sessionId)
        .eq('value', 1)
      if (error) return

      const byMovie = new Map<number, { users: Set<string>, latest: number }>()
      for (const r of (data ?? [])) {
        const m = byMovie.get(r.movie_id) ?? { users: new Set<string>(), latest: 0 }
        if (r.user_id) m.users.add(String(r.user_id))
        const ts = r.created_at ? new Date(r.created_at as unknown as string).getTime() : 0
        if (ts > m.latest) m.latest = ts
        byMovie.set(r.movie_id, m)
      }
      let newest = 0
      for (const m of byMovie.values()) {
        if (m.users.size >= 2 && m.latest > newest) newest = m.latest
      }
      if (newest) setLatestMatchAt(newest)
    })()
  }, [sessionId])

  // presença
  useEffect(() => {
    if (!sessionId || !userId) return
    const ch = supabase.channel(`presence-${sessionId}`, { config: { presence: { key: userId } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, any[]>
      const arr: OnlineUser[] = []
      Object.values(state).forEach((metas) => {
        metas.forEach((m: any) => arr.push({ id: String(m.user_id ?? m.key ?? ''), name: String(m.display_name ?? 'Guest') }))
      })
      const dedup = Array.from(new Map(arr.map(u => [u.id, u])).values())
      setOnline(dedup)
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.track({ user_id: userId, display_name: displayName, joined_at: new Date().toISOString() })
      }
    })
    return () => { try { ch.untrack() } catch {} supabase.removeChannel(ch) }
  }, [sessionId, userId, displayName])

  useEffect(() => {
  if (!matchModal) return
  // breve atraso pra modal montar
  const t = setTimeout(() => {
    confetti({ particleCount: 100, spread: 70, startVelocity: 45, origin: { y: 0.3 } })
  }, 120)
  return () => clearTimeout(t)
}, [matchModal])

  // ============== FUNÇÕES ESTÁVEIS ==============
  const goNext = useCallback(async () => {
    const nextIndex = i + 1
    if (nextIndex < movies.length) {
      setI(nextIndex)
      saveProgress(sessionId, filters, nextIndex)
      return
    }
    if (loadingMore) return
    setLoadingMore(true)
    try {
      let added = await loadPage(page + 1)
      let tries = 0
      while (added === 0 && tries < 2) { tries++; added = await loadPage(page + 1 + tries) }
      if (added > 0) {
        const newIndex = movies.length
        setI(newIndex)
        saveProgress(sessionId, filters, newIndex)
      }
    } finally { setLoadingMore(false) }
  }, [i, movies.length, sessionId, filters, loadingMore, loadPage, page])

  const react = useCallback(async (value: 1 | -1) => {
    if (!sessionId || !userId || !current) return
    if (clickGuardRef.current || busy) return

    clickGuardRef.current = true
    setBusy(true)
    setLastDir(value === 1 ? 'like' : 'dislike')

    try {
      const { data: upserted, error: movieErr } = await supabase
        .from('movies')
        .upsert(
          {
            tmdb_id: current.tmdb_id,
            title: current.title,
            year: current.year ?? null,
            poster_url: current.poster_url ?? null,
          },
          { onConflict: 'tmdb_id' }
        )
        .select('id')
        .single()

      if (movieErr) throw movieErr
      const movieId = Number(upserted?.id)
      if (!movieId) throw new Error('Falha ao obter movie.id')

      const { error: rxErr } = await supabase
        .from('reactions')
        .upsert(
          { session_id: sessionId, user_id: userId, movie_id: movieId, value },
          { onConflict: 'session_id,user_id,movie_id' }
        )
      if (rxErr) throw rxErr

      historyRef.current.push(movieId)
    } catch (e: any) {
      console.error('reactions upsert error:', e)
      toast.error(`Erro ao salvar reação: ${e.message ?? e}`)
    } finally {
        // deixa 1 frame pra animação de exit engatar
        await new Promise(res => setTimeout(res, 16))
        await goNext()
        setTimeout(() => { clickGuardRef.current = false; setBusy(false) }, EXIT_DURATION_MS + 60)
    }
  }, [sessionId, userId, current, busy, goNext])

  const undo = useCallback(async () => {
    if (!sessionId || !userId || busy) return
    const last = historyRef.current.pop()
    if (!last) return
    setBusy(true)
    try {
      setI(idx => { const v = Math.max(0, idx - 1); saveProgress(sessionId, filters, v); return v })
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('movie_id', last)
      if (error) throw error
      setUndoMsg('Último swipe desfeito')
      setTimeout(() => setUndoMsg(null), 1800)
    } catch (e: any) {
      console.error(e)
      toast.error(`Não foi possível desfazer: ${e.message ?? e}`)
    } finally { setBusy(false) }
  }, [sessionId, userId, busy, filters])

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
    try { await navigator.clipboard.writeText(invite); toast('Link copiado!', { description: invite }) }
    catch { toast('Copie o link:', { description: invite }) }
  }

  // aceita birthdate opcional — se vier, valida 18+
  const confirmAdult = async (birthdateISO?: string) => {
    if (birthdateISO) {
      const age = calcAge(birthdateISO)
      if (age < 18) {
        toast.error('Você precisa ter 18+ para ver esse conteúdo.')
        setShowAgeGate(false)
        setFilters(f => ({ ...f, includeAdult: false }))
        return
      }
    }
    if (!userId) {
      setIsAdult(true)
      setFilters(f => ({ ...f, includeAdult: true }))
      setShowAgeGate(false)
      return
    }
    try {
      await supabase.from('users').update({ is_adult: true, ...(birthdateISO ? { birthdate: birthdateISO } : {}) }).eq('id', userId)
      try { localStorage.setItem('mm:isAdult', '1') } catch {}
      setIsAdult(true)
      setFilters(f => ({ ...f, includeAdult: true }))
      setShowAgeGate(false)
      toast.success('Verificação concluída. Conteúdo adulto ativado.')
    } catch (e: any) {
      toast.error(`Falha ao confirmar maioridade: ${e?.message ?? e}`)
    }
  }

  const cancelAdult = () => {
    setShowAgeGate(false)
    setFilters(f => ({ ...f, includeAdult: false }))
  }

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 overflow-hidden">
        <p className="text-white/90">Carregando sessão…</p>
        <Toaster richColors position="bottom-center" />
      </main>
    )
  }

  const det = current ? detailsCache[current.tmdb_id] : undefined
  const [yearMinLocal, yearMaxLocal] = [filters.yearMin ?? 1990, filters.yearMax ?? currentYear]
  const clampYear = (v: number) => Math.max(1900, Math.min(currentYear, v))

  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 overflow-hidden">
      {/* Top bar (compacta) */}
      <div className="shrink-0 px-3 pt-2">
        <div className="max-w-md mx-auto flex items-center justify-between rounded-xl bg-white/5 backdrop-blur px-2.5 py-1.5 ring-1 ring-white/10">
          <div className="flex items-center gap-2 min-w-0 text-xs text-white/80">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-white">
              Sessão <span className="font-semibold">{code}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {online.length} online
            </span>
            {filtersCount > 0 && (
              <button onClick={() => setOpenFilters(true)} className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] hover:bg-white/15" title="Editar filtros">
                {filtersCount} filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setOpenFilters(true)} title="Filtros" className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button onClick={shareInvite} title="Compartilhar link" className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white">
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              to={`/s/${code}/matches`}
              onClick={() => { if (LS_KEY) localStorage.setItem(LS_KEY, String(Date.now())) }}
              title="Ver matches"
              className="relative p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Star className="w-4 h-4" />
              {hasNewMatch && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-neutral-900" />
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* centro */}
      <div className="flex-1 px-4 pb-28 overflow-hidden">
        <div className="w-full max-w-md mx-auto h-[calc(100dvh-112px)]">
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait" initial={false} onExitComplete={() => setLastDir(null)}>
                {current ? (
                  <SwipeCard
                    key={current.movie_id}
                    movie={current}
                    details={det}
                    exitDir={lastDir}          // 👈 passa a direção
                    onDragState={setDragging}
                    onDecision={(v) => react(v)}
                  />
                ) : (
                  <motion.div key="empty" className="h-full grid place-items-center text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                            <button
                              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
                              onClick={async () => {
                                const relaxed: DiscoverFilters = {
                                  ...filters,
                                  ratingMin: 0,
                                  voteCountMin: 0,
                                  runtimeMin: 40,
                                  runtimeMax: 240,
                                  providers: [], // remover provedores costuma destravar
                                }
                                setFilters(relaxed)
                                clearProgress(sessionId, relaxed)
                                await resetAndLoad(false, relaxed, sessionId)
                              }}
                            >
                              Relaxar filtros
                            </button>
                            <button
                              className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
                              onClick={async () => {
                                setFilters({ ...DEFAULT_FILTERS })
                                clearProgress(sessionId, DEFAULT_FILTERS)
                                await resetAndLoad(false, DEFAULT_FILTERS, sessionId)
                              }}
                            >
                              Limpar tudo
                            </button>
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
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="fixed left-1/2 -translate-x-1/2 z-30 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)]">
        <div className="flex items-center justify-center gap-4 sm:gap-5">
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
            disabled={busy || dragging || historyRef.current.length === 0}
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

      {/* Modal Filtros */}
      <AnimatePresence>
        {openFilters && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpenFilters(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative z-10 w-[min(92vw,44rem)] max-h-[92dvh] overflow-auto rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-5 text-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Filtros</h3>
                  <p className="text-white/70 text-sm">Refine as recomendações com mais controle.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                    title="Limpar todos os filtros"
                  >
                    Limpar
                  </button>
                  <button
                    className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
                    onClick={() => setOpenFilters(false)}
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {/* Grid de seções */}
              <div className="space-y-4">
                {/* Gêneros incluir/excluir */}
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                  <h4 className="font-medium">Gêneros</h4>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Incluir */}
                    <div>
                      <div className="text-xs text-white/70 mb-1">Incluir</div>
                      <div className="flex flex-wrap gap-1.5">
                        {GENRES.map(g => {
                          const checked = filters.genres?.includes(g.id) ?? false
                          return (
                            <button
                              key={`inc-${g.id}`}
                              onClick={() => {
                                setFilters(f => {
                                  const s = new Set<number>(f.genres ?? [])
                                  if (checked) s.delete(g.id); else s.add(g.id)
                                  return { ...f, genres: Array.from(s) }
                                })
                              }}
                              className={`px-2.5 py-1 rounded-full border text-xs ${checked ? 'bg-emerald-600/30 border-emerald-400/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                              type="button"
                            >
                              {g.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* Excluir */}
                    <div>
                      <div className="text-xs text-white/70 mb-1">Excluir</div>
                      <div className="flex flex-wrap gap-1.5">
                        {GENRES.map(g => {
                          const checked = filters.excludeGenres?.includes(g.id) ?? false
                          return (
                            <button
                              key={`exc-${g.id}`}
                              onClick={() => {
                                setFilters(f => {
                                  const s = new Set<number>(f.excludeGenres ?? [])
                                  if (checked) s.delete(g.id); else s.add(g.id)
                                  return { ...f, excludeGenres: Array.from(s) }
                                })
                              }}
                              className={`px-2.5 py-1 rounded-full border text-xs ${checked ? 'bg-rose-600/30 border-rose-400/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                              type="button"
                            >
                              {g.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ======= NOVO: Catálogos de streaming ======= */}
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                  <h4 className="font-medium">Catálogos de streaming</h4>

                  {/* Provedores */}
                  <div className="mt-3">
                    <div className="text-xs text-white/70 mb-1">Provedores (OR)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {PROVIDERS_BR.map(p => {
                        const checked = (filters.providers ?? []).includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFilters(f => {
                                const s = new Set<number>(f.providers ?? [])
                                if (checked) s.delete(p.id); else s.add(p.id)
                                return { ...f, providers: Array.from(s) }
                              })
                            }}
                            className={`px-2.5 py-1 rounded-full border text-xs ${
                              checked ? 'bg-sky-600/30 border-sky-400/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      Dica: seleção é combinada com <strong>OU</strong> (ex.: Netflix <em>ou</em> Prime Video).
                    </div>
                  </div>

                  {/* Monetização */}
                  <div className="mt-4">
                    <div className="text-xs text-white/70 mb-1">Tipo de oferta</div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {[
                        { k: 'flatrate', label: 'Assinatura' },
                        { k: 'free',     label: 'Gratuito' },
                        { k: 'ads',      label: 'Com anúncios' },
                        { k: 'rent',     label: 'Aluguel' },
                        { k: 'buy',      label: 'Compra' },
                      ].map(({ k, label }) => {
                        const checked = (filters.monetization ?? []).includes(k as any)
                        return (
                          <label key={k} className={`px-2 py-1 rounded-md border cursor-pointer ${
                            checked ? 'bg-emerald-600/30 border-emerald-400/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}>
                            <input
                              type="checkbox"
                              className="accent-emerald-500 mr-1"
                              checked={checked}
                              onChange={(e) => {
                                setFilters(f => {
                                  const s = new Set<string>(f.monetization ?? [])
                                  if (e.target.checked) s.add(k); else s.delete(k)
                                  return { ...f, monetization: Array.from(s) as any }
                                })
                              }}
                            />
                            {label}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Região */}
                  <div className="mt-4">
                    <label className="block text-sm mb-1">Região do catálogo</label>
                    <Select
                      value={filters.watchRegion ?? 'BR'}
                      onChange={(v: string) => setFilters(f => ({ ...f, watchRegion: v }))}
                      options={REGIONS}
                    />
                    <div className="text-xs text-white/60 mt-1">Afeta disponibilidade por país (ex.: BR para Brasil).</div>
                  </div>
                </section>

                {/* Ano + Duração + Popularidade + Adulto */}
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                  <h4 className="font-medium">Período, duração e relevância</h4>

                  {/* Ano */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ano (intervalo)</span>
                      <span className="text-xs text-white/70">{yearMinLocal} – {yearMaxLocal}</span>
                    </div>
                    <div className="mt-2">
                      <input
                        type="range" min={1900} max={currentYear} value={yearMinLocal}
                        onChange={(e) => {
                          const v = clampYear(Number(e.target.value || 1900))
                          setFilters(f => ({ ...f, yearMin: Math.min(v, f.yearMax ?? currentYear) }))
                        }}
                        className="w-full"
                      />
                      <input
                        type="range" min={1900} max={currentYear} value={yearMaxLocal}
                        onChange={(e) => {
                          const v = clampYear(Number(e.target.value || currentYear))
                          setFilters(f => ({ ...f, yearMax: Math.max(v, f.yearMin ?? 1900) }))
                        }}
                        className="w-full mt-1"
                      />
                    </div>
                  </div>

                  {/* Duração */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Duração (min–max, min)</span>
                      <span className="text-xs text-white/70">
                        {filters.runtimeMin ?? 60} – {filters.runtimeMax ?? 220} min
                      </span>
                    </div>
                    <div className="mt-2">
                      <input
                        type="range" min={40} max={300} value={filters.runtimeMin ?? 60}
                        onChange={(e) => {
                          const v = Math.max(40, Math.min(300, Number(e.target.value || 60)))
                          setFilters(f => ({ ...f, runtimeMin: Math.min(v, f.runtimeMax ?? 300) }))
                        }}
                        className="w-full"
                      />
                      <input
                        type="range" min={40} max={300} value={filters.runtimeMax ?? 220}
                        onChange={(e) => {
                          const v = Math.max(40, Math.min(300, Number(e.target.value || 220)))
                          setFilters(f => ({ ...f, runtimeMax: Math.max(v, f.runtimeMin ?? 40) }))
                        }}
                        className="w-full mt-1"
                      />
                    </div>
                  </div>

                  {/* Popularidade + Adulto */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Popularidade (mín. votos)</label>
                      <div className="text-xs text-white/70 mb-1">≥ {filters.voteCountMin ?? 0}</div>
                      <input
                        type="range" min={0} max={2000} step={10}
                        value={filters.voteCountMin ?? 0}
                        onChange={(e) => setFilters(f => ({ ...f, voteCountMin: Number(e.target.value || 0) }))}
                        className="w-full"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm" data-interactive="true">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={!!filters.includeAdult}
                        onChange={(e) => {
                          const wantAdult = e.target.checked
                          if (wantAdult) {
                            if (!isAdult) { setShowAgeGate(true); return }
                            setFilters(f => ({ ...f, includeAdult: true }))
                          } else {
                            setFilters(f => ({ ...f, includeAdult: false }))
                          }
                        }}
                      />
                      Permitir conteúdo adulto
                    </label>
                  </div>
                </section>

                {/* Nota / Idioma / Ordenar */}
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                  <h4 className="font-medium">Qualidade e idioma</h4>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Nota mínima</label>
                      <div className="text-xs text-white/70 mb-1">≥ {filters.ratingMin ?? 0}</div>
                      <input
                        type="range" min={0} max={10} step={0.5}
                        value={filters.ratingMin ?? 0}
                        onChange={(e) => setFilters(f => ({ ...f, ratingMin: Number(e.target.value || 0) }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1">Idioma original</label>
                      <Select
                        value={filters.language ?? ''}
                        onChange={(v: string) => setFilters(f => ({ ...f, language: v }))}
                        options={LANGUAGES}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1">Ordenar por</label>
                      <Select
                        value={filters.sortBy ?? 'popularity.desc'}
                        onChange={(v: string) => setFilters(f => ({ ...f, sortBy: v }))}
                        options={SORT_OPTIONS}
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer fixo (Aplicar) */}
              <div className="sticky bottom-0 -mx-5 mt-5 bg-neutral-900/80 backdrop-blur border-t border-white/10 px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
                    onClick={() => setOpenFilters(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
                    onClick={async () => {
                      setOpenFilters(false)
                      const fSnap = { ...filters }
                      if (sessionId && userId) {
                        try {
                          await supabase.from('session_filters').upsert({
                            session_id: sessionId,
                            genres: fSnap.genres ?? [],
                            exclude_genres: fSnap.excludeGenres ?? [],
                            year_min: fSnap.yearMin ?? 1990,
                            year_max: fSnap.yearMax ?? currentYear,
                            rating_min: fSnap.ratingMin ?? 0,
                            vote_count_min: fSnap.voteCountMin ?? 0,
                            runtime_min: fSnap.runtimeMin ?? 60,
                            runtime_max: fSnap.runtimeMax ?? 220,
                            language: fSnap.language ?? '',
                            sort_by: fSnap.sortBy ?? 'popularity.desc',
                            include_adult: !!fSnap.includeAdult,
                            updated_by: userId,

                            //só envia se sua tabela tiver as colunas (se não tiver, pode remover)
                            ...(fSnap.providers ? { providers: fSnap.providers } : {}),
                            ...(fSnap.watchRegion ? { watch_region: fSnap.watchRegion } : {}),
                            ...(fSnap.monetization ? { monetization: fSnap.monetization } : {}),
                          }, { onConflict: 'session_id' })
                        } catch {}
                      }
                      clearProgress(sessionId, fSnap)
                      await resetAndLoad(false, fSnap, sessionId)
                    }}
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
      <AgeGateModal
        open={showAgeGate}
        onConfirm={confirmAdult}
        onCancel={cancelAdult}
      />

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

/* ========= Persistência de progresso ========= */
function filtersSig(f: DiscoverFilters) {
  return [(f.genres ?? []).join(','), f.yearMin ?? '', f.yearMax ?? '', f.ratingMin ?? '', f.language ?? '', f.sortBy ?? ''].join('|')
}
function progressKey(sessionId: string | null, f: DiscoverFilters) {
  return sessionId ? `mm_prog:v1:${sessionId}:${filtersSig(f)}` : ''
}
function saveProgress(sessionId: string | null, f: DiscoverFilters, idx: number) {
  try { const k = progressKey(sessionId, f); if (!k) return; localStorage.setItem(k, JSON.stringify({ i: idx })) } catch {}
}
function loadProgress(sessionId: string | null, f: DiscoverFilters): number {
  try {
    const k = progressKey(sessionId, f); if (!k) return 0
    const raw = localStorage.getItem(k); if (!raw) return 0
    const obj = JSON.parse(raw); return Number.isFinite(obj?.i) ? obj.i : 0
  } catch { return 0 }
}
function clearProgress(sessionId: string | null, f: DiscoverFilters) {
  try { const k = progressKey(sessionId, f); if (k) localStorage.removeItem(k) } catch {}
}

/** Card com motionValue próprio */
function SwipeCard({
  movie, details, onDragState, onDecision,
}: {
  movie: Movie
  details?: MovieDetails
  onDragState: (dragging: boolean) => void
  onDecision: (value: 1 | -1) => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-DRAG_LIMIT, 0, DRAG_LIMIT], [-10, 0, 10])
  const likeOpacity = useTransform(x, [32, DRAG_LIMIT], [0, 1], { clamp: true })
  const dislikeOpacity = useTransform(x, [-DRAG_LIMIT, -32], [1, 0], { clamp: true })
  useEffect(() => { x.set(0) }, [x])


  // controla quando o drag pode iniciar
  const dragControls = useDragControls()
  function handlePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('a,button,input,select,textarea,video,iframe,[data-interactive="true"]')) return
    dragControls.start(e)
  }

  return (
    <motion.div
      className="h-full will-change-transform relative"
      // se quiser manter um fade-in simples:
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      style={{ x, rotate, touchAction: 'pan-y' }}
      drag="x"
      dragControls={dragControls}
      dragListener={false}
      dragElastic={0.18}
      dragMomentum={false}
      dragConstraints={{ left: -DRAG_LIMIT, right: DRAG_LIMIT }}
      onPointerDown={handlePointerDown}
      onTouchStart={(e) => handlePointerDown(e as unknown as React.PointerEvent)}
      onDragStart={() => onDragState(true)}
      onDragEnd={(_, info) => {
        onDragState(false)

        const passDistance = Math.abs(info.offset.x) > SWIPE_DISTANCE
        const passVelocity = Math.abs(info.velocity.x) > SWIPE_VELOCITY
        const shouldSwipe = passDistance || passVelocity

        if (shouldSwipe) {
          try { navigator.vibrate?.(12) } catch {}
          const dir = info.offset.x > 0 ? 1 : -1
          const endX = dir * (window.innerWidth + 180)
          const controls = animate(x.get(), endX, {
            type: 'spring',
            stiffness: 340,
            damping: 30,
            velocity: info.velocity.x,
            onUpdate: (v) => x.set(v),
          })
          controls.then(() => onDecision(dir === 1 ? 1 : -1))
        } else {
          animate(x.get(), 0, {
          type: 'spring',
          stiffness: 380,
          damping: 32,
          onUpdate: (v) => x.set(v),
          })
        }
      }}
    >
      {/* Overlay feedback */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-4">
        <motion.div
          style={{ opacity: dislikeOpacity, scale: useTransform(x, [-DRAG_LIMIT, -64, 0], [1.08, 1, 0.9]) }}
          className="rounded-lg border-2 border-red-500/70 text-red-500/90 px-3 py-1.5 font-semibold rotate-[-8deg] bg-black/20"
        >
          NOPE
        </motion.div>
        <motion.div
          style={{ opacity: likeOpacity, scale: useTransform(x, [0, 64, DRAG_LIMIT], [0.9, 1, 1.08]) }}
          className="rounded-lg border-2 border-emerald-500/70 text-emerald-400 px-3 py-1.5 font-semibold rotate-[8deg] bg-black/20"
        >
          LIKE
        </motion.div>
      </div>

      {/* Conteúdo: pôster ocupa 1fr; meta abaixo (auto) */}
      <div className="h-full grid grid-rows-[1fr_auto] gap-2">
        {/* Pôster / Carousel */}
        <div className="relative min-h-0 h-full">
          <MovieCarousel
            title={movie.title}
            year={movie.year}
            poster_url={movie.poster_url || ''}
            details={details}
            fullHeight
          />
        </div>

        {/* Meta abaixo */}
        <div className="text-white shrink-0 select-text" data-interactive="true">
          {/* linha 1: título + nota */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold leading-tight line-clamp-1">
              {movie.title} {movie.year ? <span className="text-white/60">({movie.year})</span> : null}
            </h3>
            <div className="ml-3 inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[13px]">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="tabular-nums">{(details?.vote_average ?? null) ? details!.vote_average!.toFixed(1) : '—'}</span>
            </div>
          </div>

          {/* linha 2: gêneros */}
          {details?.genres?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {details.genres.slice(0, 3).map(g => (
                <span key={g.id} className="text-[11px] rounded-full bg-white/10 px-2 py-0.5 text-white/90">{g.name}</span>
              ))}
            </div>
          ) : null}

          {/* linha 3: classificação indicativa */}
          <div className="mt-1">
            <span className="text-[11px] text-white/70 mr-1.5">Classificação:</span>
            <span className="text-[11px] inline-flex items-center rounded-md bg-white/10 px-2 py-0.5">
              {details?.age_rating?.trim() || '—'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
