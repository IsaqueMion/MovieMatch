import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getMovieDetails, type MovieDetails } from '../lib/functions'

type MatchItem = {
  movie_id: number
  tmdb_id: number | null
  title: string
  year: number | null
  poster_url: string | null
  likes: number
  latestAt: number
}

type SortKey = 'recent' | 'likes' | 'title'

export default function Matches() {
  const { code = '' } = useParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)

  // Controles da UI
  const [q, setQ] = useState('')                    // busca por título
  const [sort, setSort] = useState<SortKey>('recent') // ordenação
  const [minLikes, setMinLikes] = useState(2)       // mínimo de likes para aparecer

  // Região para provedores (cai no BR por padrão)
  const [watchRegion, setWatchRegion] = useState<string>('BR')

  // Modal de detalhes
  const [modal, setModal] = useState<{ item: MatchItem; details: MovieDetails | null } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  async function openDetails(item: MatchItem) {
    if (!item) return
    setLoadingDetails(true)
    let det: MovieDetails | null = null
    try {
      if (item.tmdb_id != null) {
        det = await getMovieDetails(item.tmdb_id)
      }
    } catch (e) {
      console.error('getMovieDetails failed:', e)
    } finally {
      setModal({ item, details: det })
      setLoadingDetails(false)
    }
  }
  function closeDetails() { setModal(null) }

  // Carregar sessão + primeira lista
  useEffect(() => {
    (async () => {
      setLoading(true)

      const { data: sess } = await supabase
        .from('sessions')
        .select('id, code')
        .eq('code', code.toUpperCase())
        .maybeSingle()

      if (!sess) {
        setSessionId(null)
        setItems([])
        setLoading(false)
        return
      }

      setSessionId(sess.id)
      // tenta descobrir a região da sessão (se foi salva nos filtros)
      try {
        const { data: sf } = await supabase
          .from('session_filters')
          .select('watch_region')
          .eq('session_id', sess.id)
          .maybeSingle()
        if (sf?.watch_region) setWatchRegion(sf.watch_region as string)
      } catch {}
      await loadMatches(sess.id)
      setLoading(false)
    })()
  }, [code])

  // Tempo real: qualquer mudança em reactions desta sessão => recarrega
  useEffect(() => {
    if (!sessionId) return
    const ch = supabase
      .channel(`matches-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `session_id=eq.${sessionId}` },
        () => loadMatches(sessionId)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId])

  async function loadMatches(sid: string) {
    const { data, error } = await supabase
      .from('reactions')
      .select('movie_id, value, user_id, created_at, movies:movie_id(title,year,poster_url,tmdb_id)')
      .eq('session_id', sid)
      .eq('value', 1)

    if (error) {
      console.error(error)
      setItems([])
      return
    }

    type MovieJoin = { title: string | null; year: number | null; poster_url: string | null; tmdb_id: number | null }
    type Row = {
      movie_id: number
      value: 1 | -1
      user_id: string | null
      created_at: string | null
      movies: MovieJoin | MovieJoin[] | null
    }

    const rows = (data ?? []) as Row[]

    const map = new Map<number, {
      title: string; year: number | null; poster_url: string | null; tmdb_id: number | null;
      users: Set<string>; latestAt: number
    }>()

    for (const r of rows) {
      const mInfo = Array.isArray(r.movies) ? r.movies[0] : r.movies
      const curr = map.get(r.movie_id) ?? {
        title: mInfo?.title ?? '—',
        year: mInfo?.year ?? null,
        poster_url: mInfo?.poster_url ?? null,
        tmdb_id: (typeof (mInfo as any)?.tmdb_id === 'number' ? (mInfo as any).tmdb_id : null) as number | null,
        users: new Set<string>(),
        latestAt: 0,
      }

      if (r.user_id) curr.users.add(String(r.user_id))
      const ts = r.created_at ? new Date(r.created_at).getTime() : 0
      if (ts > curr.latestAt) curr.latestAt = ts

      map.set(r.movie_id, curr)
    }

    const list: MatchItem[] = []
    for (const [movie_id, m] of map.entries()) {
      const likes = m.users.size
      // Empilhamos todos; filtro por mínimo acontece na view
      list.push({
        movie_id,
        tmdb_id: m.tmdb_id ?? null,
        title: m.title,
        year: m.year,
        poster_url: m.poster_url,
        likes,
        latestAt: m.latestAt,
      })
    }

    // Ordenação padrão (pode ser alterada na UI)
    list.sort((a, b) => (b.latestAt - a.latestAt) || (b.likes - a.likes) || a.title.localeCompare(b.title))
    setItems(list)
  }

  // View filtrada/ordenada
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    let arr = items.filter(i => i.likes >= minLikes && (term === '' || i.title.toLowerCase().includes(term)))
    if (sort === 'recent') {
      arr = arr.slice().sort((a, b) => (b.latestAt - a.latestAt) || (b.likes - a.likes) || a.title.localeCompare(b.title))
    } else if (sort === 'likes') {
      arr = arr.slice().sort((a, b) => (b.likes - a.likes) || (b.latestAt - a.latestAt) || a.title.localeCompare(b.title))
    } else {
      arr = arr.slice().sort((a, b) => a.title.localeCompare(b.title))
    }
    return arr
  }, [items, q, sort, minLikes])

  function copyList() {
    const lines = visible.map(m => `${m.title}${m.year ? ` (${m.year})` : ''} — ${m.likes} likes`)
    try {
      navigator.clipboard.writeText(lines.join('\n'))
      alert('Lista copiada!')
    } catch {
      alert(lines.join('\n'))
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-neutral-900 text-white">
        Carregando matches…
      </main>
    )
  }

  if (!sessionId) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-neutral-900 text-white">
        <div className="text-center space-y-2">
          <p>Sessão não encontrada.</p>
          <Link to="/" className="underline text-emerald-300">Voltar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-neutral-900 text-white">
      <div className="mx-auto max-w-5xl px-3 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        <div className="sticky top-0 z-10 -mx-3 mb-3 border-b border-white/10 bg-neutral-900/90 px-3 py-2 backdrop-blur
                sm:static sm:mb-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0
                flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold">Matches — {code.toUpperCase()}</h1>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar título..."
                className="h-10 w-full sm:w-56 rounded-md border border-white/10 bg-neutral-800/60 px-2 text-sm outline-none placeholder:text-white/40"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-10 w-full sm:w-auto rounded-md border border-white/10 bg-neutral-800/60 px-2 text-sm"
                title="Ordenar por"
              >
                <option value="recent">Mais recentes</option>
                <option value="likes">Mais likes</option>
                <option value="title">Título (A→Z)</option>
              </select>
              <select
                value={String(minLikes)}
                onChange={(e) => setMinLikes(Number(e.target.value) || 0)}
                className="h-10 w-full sm:w-auto rounded-md border border-white/10 bg-neutral-800/60 px-2 text-sm"
                title="Mínimo de likes"
              >
                <option value="2">2+ likes</option>
                <option value="3">3+ likes</option>
                <option value="4">4+ likes</option>
                <option value="1">1+ like</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button onClick={copyList} className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
                Copiar lista
              </button>
              <Link to={`/s/${code}`} className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
                Voltar ao swipe
              </Link>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-white/80">Nenhum resultado com os filtros atuais.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
            {visible.map(m => (
              <li
                key={m.movie_id}
                onClick={() => openDetails(m)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') ? openDetails(m) : undefined}
                role="button"
                tabIndex={0}
                className="rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 cursor-pointer hover:ring-white/20 transition-shadow"
              >
                <div className="relative aspect-[2/3] bg-black">
                  {m.poster_url
                    ? <img src={m.poster_url} alt={m.title} className="h-full w-full object-contain" />
                    : <div className="absolute inset-0 grid place-items-center text-white/50">Sem pôster</div>}
                  <div className="absolute left-2 top-2 rounded-md bg-white/10 px-2 py-0.5 text-xs ring-1 ring-white/20">
                    {m.likes} like{m.likes === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="p-2.5 sm:p-3">
                  <h3 className="font-semibold leading-tight">
                    {m.title} {m.year ? <span className="text-white/60">({m.year})</span> : null}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">Mais recente: {m.latestAt ? new Date(m.latestAt).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Modal de Detalhes */}
        {modal && (
          <div className="fixed inset-0 z-[80]">
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDetails} />
            {/* container */}
            <div className="absolute inset-0 grid place-items-center p-0 md:p-4">
              <div className="relative w-full h-[100dvh] md:h-auto md:max-h-[92dvh] md:w-[min(980px,96vw)] overflow-auto bg-neutral-900 ring-1 ring-white/10 rounded-none md:rounded-2xl text-white">
                {/* Header (fixo no topo no mobile) */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-900/85 backdrop-blur px-3 py-2 md:px-4 md:py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base md:text-xl font-semibold leading-tight">
                      {modal.item.title} {modal.item.year ? <span className="text-white/60">({modal.item.year})</span> : null}
                    </h3>
                    {/* chips (desktop) */}
                    <div className="mt-1 hidden md:flex flex-wrap items-center gap-2 text-sm text-white/70">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 ring-1 ring-white/10">{modal.item.likes} like{modal.item.likes === 1 ? '' : 's'}</span>
                      {modal.item.tmdb_id != null && (
                        <a
                          href={`https://www.themoviedb.org/movie/${modal.item.tmdb_id}`}
                          target="_blank" rel="noreferrer"
                          className="rounded-md bg-white/10 px-2 py-0.5 ring-1 ring-white/10 hover:bg-white/15"
                        >
                          Ver no TMDB ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* link (mobile) */}
                    {modal.item.tmdb_id != null && (
                      <a
                        href={`https://www.themoviedb.org/movie/${modal.item.tmdb_id}`}
                        target="_blank" rel="noreferrer"
                        className="md:hidden rounded-md bg-white/10 px-2 py-1 text-sm ring-1 ring-white/10"
                      >
                        TMDB ↗
                      </a>
                    )}
                    <button
                      onClick={closeDetails}
                      className="rounded-md px-2 py-1 bg-white/10 hover:bg-white/15 ring-1 ring-white/10 text-base"
                      aria-label="Fechar"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Mídia (trailer/poster) — topo no mobile */}
                <div className="w-full bg-black">
                  {loadingDetails ? (
                    <div className="w-full aspect-video grid place-items-center text-white/60">Carregando…</div>
                  ) : (() => {
                    const trailerKey = (modal.details as any)?.trailer?.key as string | undefined
                    const youtubeEmbed = trailerKey ? `https://www.youtube.com/embed/${trailerKey}?playsinline=1&rel=0` : null
                    if (youtubeEmbed) {
                      return (
                        <div className="relative aspect-video w-full">
                          <iframe
                            className="absolute inset-0 h-full w-full"
                            src={youtubeEmbed}
                            title={`${modal.item.title} trailer`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      )
                    }
                    return modal.item.poster_url
                      ? <img src={modal.item.poster_url} alt={modal.item.title} className="w-full h-auto object-contain aspect-video md:aspect-auto" />
                      : <div className="w-full aspect-video grid place-items-center text-white/60">Sem mídia</div>
                  })()}
                </div>

                {/* Chips (mobile) */}
                <div className="px-3 pt-3 md:hidden flex items-center gap-2 text-sm">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 ring-1 ring-white/10">{modal.item.likes} like{modal.item.likes === 1 ? '' : 's'}</span>
                </div>

                {/* Conteúdo */}
                <div className="grid gap-4 p-3 md:p-4 md:grid-cols-[1.1fr_1fr]">
                  {/* Detalhes / Sinopse */}
                  <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-4 order-2 md:order-1">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                      <dt className="text-white/60">Duração</dt>
                      <dd>{typeof (modal.details as any)?.runtime === 'number' ? `${(modal.details as any).runtime} min` : '—'}</dd>

                      <dt className="text-white/60">Nota TMDB</dt>
                      <dd>{typeof (modal.details as any)?.vote_average === 'number' ? (modal.details as any).vote_average.toFixed(1) : '—'}</dd>

                      <dt className="text-white/60">Gêneros</dt>
                      <dd>
                        {(Array.isArray((modal.details as any)?.genres) && (modal.details as any).genres.length > 0)
                          ? (modal.details as any).genres.map((g: any) => g.name).join(' • ')
                          : '—'}
                      </dd>
                    </dl>

                    <div className="mt-3 text-sm leading-relaxed max-h-56 md:max-h-64 overflow-auto pr-1">
                      {(typeof (modal.details as any)?.overview === 'string' && (modal.details as any).overview.length > 0)
                        ? (modal.details as any).overview
                        : <span className="text-white/60">Sem sinopse disponível.</span>}
                    </div>

                    {/* Provedores de streaming */}
                    {(() => {
                      const { providers, fallbackUrl } = extractProviders(modal.details, watchRegion, modal.item.tmdb_id)
                      if (providers && providers.length > 0) {
                        return (
                          <div className="mt-4">
                            <div className="mb-2 text-sm text-white/70">Disponível em</div>
                            <div className="flex flex-wrap items-center gap-2.5">
                              {providers.map((p) => (
                                <a
                                  key={p.id}
                                  href={p.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={p.name}
                                  className="group inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15 bg-white/5 hover:ring-white/25"
                                >
                                  {p.logoUrl ? (
                                    <img
                                      src={p.logoUrl}
                                      alt={p.name}
                                      className="h-6 w-6 object-contain opacity-90 group-hover:opacity-100 transition"
                                      loading="lazy"
                                      decoding="async"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span className="text-[11px] px-1 text-white/80">{p.name.slice(0, 3).toUpperCase()}</span>
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      if (fallbackUrl) {
                        return (
                          <div className="mt-4">
                            <a
                              href={fallbackUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/15"
                            >
                              Ver onde assistir ↗
                            </a>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>

                  {/* Poster “cartão” (desktop) */}
                  <div className="hidden md:block rounded-xl overflow-hidden ring-1 ring-white/10 bg-black min-h-[280px] order-1 md:order-2">
                    {modal.item.poster_url
                      ? <img src={modal.item.poster_url} alt={modal.item.title} className="w-full h-full object-contain bg-black" />
                      : <div className="w-full h-full grid place-items-center text-white/60">Sem pôster</div>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
// Extrai provedores do objeto de detalhes em diferentes formatos.
// Retorna { providers, fallbackUrl } — se não houver providers, usamos fallbackUrl (página "Assistir" do TMDB).
function extractProviders(details: any, region: string, tmdbId?: number | null): {
  providers: Array<{ id: number; name: string; logoUrl: string | null; url: string }>,
  fallbackUrl: string | null
} {
  if (!details) return { providers: [], fallbackUrl: null }

  const baseImg = 'https://image.tmdb.org/t/p/w45'
  const R = (region || 'BR').toUpperCase()

  // Possíveis formas vindas do TMDB/Edge:
  // - details.watch_providers.results[REG]
  // - details.watchProviders.results[REG]
  // - details.providers[REG] (edge custom)
  const wp =
    (details as any)?.watch_providers ??
    (details as any)?.watchProviders ??
    (details as any)?.providers ??
    null

  const area =
    (wp && (wp.results?.[R] ?? wp[R])) ||
    null

  // Fallback para a página de "Assistir" no TMDB
  const tmdbWatchLink =
    (area && typeof area.link === 'string' && area.link) ||
    (typeof tmdbId === 'number' ? `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=${R}` : null)

  if (!area) return { providers: [], fallbackUrl: tmdbWatchLink }

  // Junta todos os buckets conhecidos
  const buckets = [
    ...(Array.isArray(area.flatrate) ? area.flatrate : []),
    ...(Array.isArray(area.ads) ? area.ads : []),
    ...(Array.isArray(area.free) ? area.free : []),
    ...(Array.isArray(area.rent) ? area.rent : []),
    ...(Array.isArray(area.buy) ? area.buy : []),
  ]

  // De-dup por id; se não houver url específica do provedor, cai no link do TMDB
  const byId = new Map<number, { id: number; name: string; logoUrl: string | null; url: string }>()
  for (const p of buckets) {
    const id = Number(p?.provider_id ?? p?.id)
    if (!Number.isFinite(id)) continue
    const name = String(p?.provider_name ?? p?.name ?? 'Provider')
    const logoPath = p?.logo_path ?? p?.logo ?? null
    const logoUrl = logoPath ? `${baseImg}${logoPath}` : null
    const url = (typeof p?.url === 'string' && p.url) ? p.url : (tmdbWatchLink || '#')
    if (!byId.has(id)) byId.set(id, { id, name, logoUrl, url })
  }

  const providers = Array.from(byId.values())

  providers.sort((a, b) => a.name.localeCompare(b.name))

  return { providers, fallbackUrl: tmdbWatchLink }
}

