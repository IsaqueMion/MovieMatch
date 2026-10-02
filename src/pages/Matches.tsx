import { translate as t, useLocale, currentLocale } from '../hooks/useLocale'
// src/pages/Matches.tsx
import { lazy, Suspense, useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, Clapperboard, Copy, Film, Heart, Search, ArrowLeftRight } from 'lucide-react'
import CinemaButton from '../components/ui/cinema-button'
import MatchPoster from '../components/matches/MatchPoster'
import { CoverflowCarousel } from '../components/ui/coverflow-carousel'
import MatchDetailsDialog from '../components/matches/MatchDetailsDialog'
import SessionLoader from '../components/ui/session-loader'
import { supabase } from '../lib/supabase'
import { getMovieDetails, type MovieDetails } from '../lib/functions'
import { ensureAnonymousUser } from '../lib/auth'
import { useSessionPresence } from '../hooks/useSessionPresence'
import { usePageMeta } from '../hooks/usePageMeta'
import { useWatchedMovies } from '../hooks/useWatchedMovies'
import { useDemoSession } from '../hooks/useDemoSession'
import { markMovieWatched, type LibraryMovie } from '../lib/movieLibrary'
import '../styles/library.css'
import AccountMenu from '../components/account/AccountMenu'
import SaveRoomButton from '../components/account/SaveRoomButton'
const MovieReviewsDialog = lazy(() => import('../components/reviews/MovieReviewsDialog'))
const MovieShelf = lazy(() => import('../components/matches/MovieShelf'))


type MatchItem = {
  movie_id: number
  tmdb_id: number | null
  title: string
  year: number | null
  poster_url: string | null
  likes: number
  member_count: number
  latestAt: number
}

type SortKey = 'recent' | 'oldest' | 'title'

export default function Matches() {
  useLocale()
  const [shelf, setShelf] = useState(false)
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [copyStatus, setCopyStatus] = useState('')
  const library = useWatchedMovies()
  const [reviewMovie, setReviewMovie] = useState<LibraryMovie | null>(null)
  const [markingWatched, setMarkingWatched] = useState(false)
  const [watchedError, setWatchedError] = useState('')
  const [listError, setListError] = useState(false)
  const detailsRequest = useRef(0)

  usePageMeta({
    title: code
      ? `Matches ${code.toUpperCase()} — MovieMatch`
      : t("Matches — MovieMatch"),
    description:
      t("Veja os filmes aprovados pelos participantes da sua sessão do MovieMatch."),
    robots:
      'noindex,nofollow,noarchive',
  })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const onlineCount = useSessionPresence(sessionId)
  const demo = useDemoSession(sessionId)

  // Controles da UI
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  // Região para provedores (lida na sessão; usamos no extractProviders)
  const [watchRegion, setWatchRegion] = useState<string>('BR')

  // Modal de detalhes
  const [modal, setModal] = useState<{ item: MatchItem; details: MovieDetails | null } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  async function openDetails(item: MatchItem) {
    setWatchedError('')
    const request = ++detailsRequest.current
    setModal({ item, details: null })
    setLoadingDetails(true)
    let details: MovieDetails | null = null
    try {
      if (item.tmdb_id != null) details = await getMovieDetails(item.tmdb_id, { region: watchRegion })
    } catch (error) {
      console.error('getMovieDetails failed:', error)
    } finally {
      if (request === detailsRequest.current) {
        setModal({ item, details })
        setLoadingDetails(false)
      }
    }
  }
  function closeDetails() {
    detailsRequest.current++
    setModal(null)
    setLoadingDetails(false)
  }

  // Carregar sessão + primeira lista
  useEffect(() => {
    (async () => {
      setLoading(true)

      const normalizedCode = code.trim().toUpperCase()

      if (!normalizedCode) {
        setSessionId(null)
        setItems([])
        setLoading(false)
        return
      }

      try {
        await ensureAnonymousUser()
      } catch (authError) {
        console.error('anonymous auth failed:', authError)
        setSessionId(null)
        setItems([])
        setLoading(false)
        return
      }

      const { data: sessionRows, error: sessionError } = await supabase.rpc(
        'join_session',
        {
          p_code: normalizedCode,
        },
      )

      const sess = Array.isArray(sessionRows) ? sessionRows[0] : null

      if (sessionError || !sess?.id) {
        console.error('join_session failed:', sessionError)
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

        if (sf?.watch_region) {
          setWatchRegion(String(sf.watch_region))
        }
      } catch {
        // Falha ao recuperar a região não impede o carregamento da sessão.
      }

      await loadMatches(sess.id)
      setLoading(false)
    })()
  }, [code])

  // Mantém os matches sincronizados.
  //
  // Reações chegam em tempo real pelo Supabase.
  // A atualização periódica também cobre mudanças
  // na quantidade de integrantes da sessão.
  useEffect(() => {
    if (!sessionId) return

    let disposed = false

    const refresh = () => {
      if (disposed) return

      void loadMatches(sessionId)
    }

    const channel = supabase
      .channel(`matches-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        refresh,
      )
      .subscribe()

    // Confere periodicamente se entrou ou saiu
    // algum participante da sessão.
    const intervalId = window.setInterval(
      refresh,
      5000,
    )

    // Ao voltar para a janela, atualiza imediatamente.
    const handleFocus = () => {
      refresh()
    }

    // Também atualiza ao voltar para esta aba.
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible'
      ) {
        refresh()
      }
    }

    window.addEventListener(
      'focus',
      handleFocus,
    )

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      disposed = true

      window.clearInterval(intervalId)

      window.removeEventListener(
        'focus',
        handleFocus,
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      void supabase.removeChannel(channel)
    }
  }, [sessionId])
  async function loadMatches(sid: string) {
    const {
      data,
      error,
    } = await supabase.rpc(
      'list_session_matches',
      {
        p_session_id: sid,
      },
    )

    if (error) {
      console.error(
        'list_session_matches failed:',
        error,
      )

      setListError(true)
      return
    }
    setListError(false)

    type MatchRow = {
      movie_id: number | string
      tmdb_id: number | string | null
      title: string | null
      year: number | null
      poster_url: string | null
      likes: number | string
      member_count: number | string
      latest_at: string | null
    }

    const rows = (data ?? []) as MatchRow[]

    const list: MatchItem[] = rows.map(
      (row) => ({
        movie_id: Number(row.movie_id),

        tmdb_id:
          row.tmdb_id != null
            ? Number(row.tmdb_id)
            : null,

        title:
          row.title?.trim() ||
          t("Filme sem título"),

        year:
          row.year != null
            ? Number(row.year)
            : null,

        poster_url:
          row.poster_url ?? null,

        likes:
          Number(row.likes) || 0,

        member_count:
          Number(row.member_count) || 0,

        latestAt:
          row.latest_at
            ? new Date(
                row.latest_at,
              ).getTime()
            : 0,
      }),
    )

    setItems(list)
  }

  const watchedIds = useMemo(() => new Set(library.movies.map(movie => movie.tmdb_id)), [library.movies])
  const pending = useMemo(() => items.filter(item => item.tmdb_id == null || !watchedIds.has(item.tmdb_id)), [items, watchedIds])
  const pageLoading = loading || library.loading
  function openReviews(item: MatchItem) {
    if (item.tmdb_id == null) return
    closeDetails()
    setReviewMovie({ tmdb_id: item.tmdb_id, title: item.title, year: item.year, poster_url: item.poster_url })
  }
  async function markWatched(item: MatchItem) {
    if (markingWatched || item.tmdb_id == null) return
    setMarkingWatched(true)
    setWatchedError('')
    try {
      const watched = await markMovieWatched({ tmdb_id: item.tmdb_id, title: item.title, year: item.year, poster_url: item.poster_url })
      library.remember(watched)
      setCopyStatus(t("Filme adicionado aos seus assistidos. Os matches dos outros participantes continuam iguais."))
      openReviews(item)
    } catch { setWatchedError(t("Não foi possível marcar o filme. Tente novamente.")) }
    finally { setMarkingWatched(false) }
  }

  // View filtrada/ordenada
  const visible = useMemo(() => {
    const term =
      q.trim().toLowerCase()

    let arr = pending.filter(
      (item) =>
        term === '' ||
        item.title
          .toLowerCase()
          .includes(term),
    )

    if (sort !== 'title') {
      arr = arr.slice().sort(
        (a, b) =>
          (sort === 'oldest' ? a.latestAt - b.latestAt : b.latestAt - a.latestAt) ||
          a.title.localeCompare(b.title),
      )
    } else {
      arr = arr.slice().sort(
        (a, b) =>
          a.title.localeCompare(b.title),
      )
    }

    return arr
  }, [pending, q, sort])

  async function copyList() {
    const text = visible.map(movie => `${movie.title}${movie.year ? ` (${movie.year})` : ''} — ${movie.likes}/${movie.member_count} curtiram`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(t("Lista copiada. Pronta para compartilhar."))
    } catch {
      setCopyStatus(t("Não foi possível copiar. Permita o acesso à área de transferência e tente novamente."))
    }
  }

  const featured = visible[0]
  return (
    <main className="cinema-page matches-page" id="conteudo">
      <a className="cinema-skip-link" href="#matches-selection">{t("Pular para os filmes")}</a>
      <header className="cinema-container matches-header">
        <Link className="cinema-brand" to="/" aria-label={t("MovieMatch, página inicial")}><span className="cinema-brand-mark"><Clapperboard size={23} aria-hidden="true" /></span>MovieMatch<span className="cinema-brand-dot">.</span></Link>
        <div className="matches-session"><span>{t("Sessão") + " "}<strong>{code.toUpperCase()}</strong></span>{sessionId ? <span className="matches-online"><i aria-hidden="true" />{onlineCount}{" " + t("online")}</span> : null}</div>
        <SaveRoomButton sessionId={sessionId} code={code} />
        <AccountMenu />
        <CinemaButton compact tone="secondary" direction="right" onClick={() => navigate(`/s/${code}`)}>{t("Voltar a votar")}</CinemaButton>
      </header>
      <div className="cinema-container">
        {demo ? <p className="cinema-demo-notice">{t("Sala de testes · Matches e votos iniciais de exemplo. Suas alterações de assistidos continuam pessoais.")}</p> : null}
        <section className="matches-hero" aria-labelledby="matches-title">
          <div><p className="cinema-eyebrow"><Heart size={13} aria-hidden="true" />{t("A escolha é de vocês")}</p><h1 id="matches-title">{t("Gostos diferentes.")}<br /><span>{t("O mesmo sim.")}</span></h1><p className="matches-intro">{pending.length ? t("Todos curtiram. Agora, só falta escolher qual filme vai ganhar o play.") : t("Quando os gostos se encontram, os filmes aparecem aqui. A próxima escolha é de vocês.")}</p></div>
          <div className="matches-total" aria-live="polite"><span>{pageLoading ? '—' : String(pending.length).padStart(2, '0')}</span><p>{pending.length === 1 ? t("filme em comum") : t("filmes em comum")}<small>{t("Aprovados por todos os")}<br />{t("participantes atuais.")}</small></p></div>
        </section>
        <section id="matches-selection" className="matches-selection" aria-labelledby="matches-selection-title" aria-busy={pageLoading}>
          <div className="matches-toolbar">
            <div><p className="cinema-eyebrow">{t("Sua próxima sessão")}</p><h2 id="matches-selection-title">{t("A seleção do grupo")}</h2><Link className="matches-library-link" to={`/s/${code}/assistidos`}>{t("Meus assistidos ·") + " "}{library.movies.length}</Link></div>
            <div className="matches-controls">
              <label className="matches-search"><Search size={17} aria-hidden="true" /><span className="sr-only">{t("Buscar filme")}</span><input type="search" value={q} onChange={event => setQ(event.target.value)} placeholder={t("Buscar um filme")} disabled={pageLoading || !sessionId} /></label>
              <label className="matches-sort"><span className="sr-only">{t("Ordenar filmes")}</span><select value={sort} onChange={event => setSort(event.target.value as SortKey)} disabled={pageLoading || !sessionId}><option value="recent">{t("Mais recentes")}</option><option value="oldest">{t("Mais antigos")}</option><option value="title">{t("Título (A→Z)")}</option></select><ChevronDown size={14} aria-hidden="true" /></label>
              <button className="matches-copy" onClick={copyList} disabled={!visible.length} title={t("Copiar lista")}><Copy size={16} aria-hidden="true" /><span>{t("Copiar lista")}</span></button>
            </div>
          </div>
          <p className="matches-copy-status" role="status">{copyStatus}</p>{library.error ? <p className="library-error" role="alert">{t("Não foi possível verificar seus assistidos.")}<button type="button" onClick={library.refresh}>{t("Tentar novamente")}</button></p> : null}
          {pageLoading ? <div className="matches-loading"><SessionLoader label={t("Reunindo as escolhas de vocês…")} /></div>
            : !sessionId ? <div className="matches-empty"><Film size={36} aria-hidden="true" /><h3>{t("Sessão indisponível")}</h3><p>{t("Confira o código da sessão. Ela pode ter expirado ou a conexão pode estar indisponível.")}</p><CinemaButton onClick={() => navigate('/')}>{t("Ir para o início")}</CinemaButton></div>
            : listError ? <div className="matches-load-error" role="alert"><p>{t("Não foi possível atualizar a seleção. Tente novamente em instantes.")}</p><button onClick={() => void loadMatches(sessionId)}>{t("Tentar novamente")}</button></div> : null}
          {!pageLoading && sessionId && !listError && !featured ? <div className="matches-empty"><Heart size={38} aria-hidden="true" /><span className="cinema-eyebrow">{q.trim() ? t("Vamos tentar outro título") : t("O próximo sim está por vir")}</span><h3>{q.trim() ? t("Esse filme não está na seleção.") : items.length && !pending.length ? t("Você já viu todos esses filmes.") : t("Ainda não deu match.")}</h3><p>{q.trim() ? t("Busque outro título ou veja todos os filmes aprovados pelo grupo.") : items.length && !pending.length ? t("Suas histórias estão em Meus assistidos. Continue votando para descobrir novas opções.") : t("Continuem descobrindo filmes. O match aparece quando todos os participantes atuais curtem, com pelo menos duas pessoas.")}</p><CinemaButton direction="right" onClick={() => q.trim() ? setQ('') : navigate(`/s/${code}`)}>{q.trim() ? t("Limpar busca") : t("Continuar votando")}</CinemaButton></div> : null}
          {!pageLoading && sessionId && featured ? <>
            <div className="matches-view-options" role="group" aria-label={t('Testar estante ThreeUI')}><button type="button" aria-pressed={!shelf} onClick={() => setShelf(false)}>{t('Carrossel')}</button><button type="button" aria-pressed={shelf} onClick={() => setShelf(true)}>{t('Estante experimental')}</button></div>
            {shelf ? <section className="matches-shelf-experiment"><Suspense fallback={<SessionLoader />}><MovieShelf movies={visible} onExplore={id => { const movie = visible.find(item => item.movie_id === id); if (movie) void openDetails(movie) }} /></Suspense></section> : <article className="matches-spotlight matches-coverflow">
              <p className="matches-carousel-intro"><ArrowLeftRight size={14} aria-hidden="true" />{visible.length > 1 ? t("Deslize pelos filmes que conquistaram o grupo") : t("O filme que conquistou o grupo")}</p>
              <CoverflowCarousel
                key={`${sort}:${q.trim().toLowerCase()}:${visible.map(movie => movie.movie_id).join(',')}`}
                slides={visible.map(movie => ({ id: movie.movie_id, src: movie.poster_url, alt: t("Pôster de {0}", [movie.title]), title: movie.title }))}
                label={t("Matches da sessão")}
                onActivate={index => void openDetails(visible[index])}
                renderSlide={(_slide, index, active) => <><MatchPoster title={visible[index].title} poster={visible[index].poster_url} priority={active || index < 3} /><span className="matches-poster-open"><ArrowUpRight size={20} aria-hidden="true" /></span></>}
                renderCaption={(_slide, index) => {
                  const movie = visible[index]
                  return <><p className="matches-film-year">{movie.year ?? t("Ano não informado")} <span>{t("· Escolha do grupo")}</span></p><h3>{movie.title}</h3><div className="matches-consensus"><span><Heart size={16} fill="currentColor" aria-hidden="true" /></span><div><strong>{t("Todo mundo disse sim.")}</strong><p>{movie.likes}{" " + t("de") + " "}{movie.member_count}{" " + t("participantes curtiram")}</p></div></div><CinemaButton direction="diagonal" onClick={() => void openDetails(movie)}>{t("Explorar o filme")}</CinemaButton><p className="matches-detail-hint">{t("Sinopse, trailer e onde assistir")}</p></>
                }}
              />
            </article>}
            <div className="matches-more-heading"><h3>{t("Todos os matches")}</h3><span>{visible.length} {visible.length === 1 ? 'escolha em comum' : 'escolhas em comum'}</span></div>
            <ul className="matches-grid">{visible.map(movie => <li key={movie.movie_id}><button className="matches-film-card" onClick={() => void openDetails(movie)} aria-label={t("Ver detalhes de {0}", [movie.title])}><div className="matches-card-image"><MatchPoster title={movie.title} poster={movie.poster_url} /><span className="matches-card-consensus"><Check size={13} aria-hidden="true" />{movie.likes}/{movie.member_count}{" " + t("curtiram")}</span><span className="matches-poster-open"><ArrowUpRight size={19} aria-hidden="true" /></span></div><div className="matches-card-copy"><span>{movie.year ?? t("Ano não informado")}</span><h4>{movie.title}</h4><p>{movie.latestAt ? t("Match em ") + new Date(movie.latestAt).toLocaleDateString(currentLocale()) : t("Escolha do grupo")}</p></div></button></li>)}</ul>
          </> : null}
        </section>
        <footer className="matches-footer"><Clapperboard size={19} aria-hidden="true" /><p>{t("Menos tempo escolhendo. Mais tempo assistindo juntos.")}</p><Link to={`/s/${code}`}>{t("Continuar descobrindo") + " "}<ArrowUpRight size={15} aria-hidden="true" /></Link></footer>
      </div>
      {modal ? <MatchDetailsDialog key={modal.item.movie_id} item={modal.item} details={modal.details} loading={loadingDetails} region={watchRegion} onClose={closeDetails} onMarkWatched={modal.item.tmdb_id != null ? () => void markWatched(modal.item) : undefined} onReviews={() => openReviews(modal.item)} markingWatched={markingWatched} watchedError={watchedError} /> : null}
      {reviewMovie ? <Suspense fallback={null}><MovieReviewsDialog key={reviewMovie.tmdb_id} movie={reviewMovie} onClose={() => setReviewMovie(null)} /></Suspense> : null}
    </main>
  )
}
