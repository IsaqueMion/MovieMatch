// src/pages/Matches.tsx
import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, Clapperboard, Copy, Film, Heart, Search, Sparkles } from 'lucide-react'
import CinemaButton from '../components/ui/cinema-button'
import MatchPoster from '../components/matches/MatchPoster'
import MatchDetailsDialog from '../components/matches/MatchDetailsDialog'
import { supabase } from '../lib/supabase'
import { getMovieDetails, type MovieDetails } from '../lib/functions'
import { ensureAnonymousUser } from '../lib/auth'
import { useSessionPresence } from '../hooks/useSessionPresence'
import { usePageMeta } from '../hooks/usePageMeta'


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

type SortKey = 'recent' | 'title'

export default function Matches() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [copyStatus, setCopyStatus] = useState('')
  const [listError, setListError] = useState(false)
  const detailsRequest = useRef(0)

  usePageMeta({
    title: code
      ? `Matches ${code.toUpperCase()} — MovieMatch`
      : 'Matches — MovieMatch',
    description:
      'Veja os filmes aprovados pelos participantes da sua sessão do MovieMatch.',
    robots:
      'noindex,nofollow,noarchive',
  })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const onlineCount = useSessionPresence(sessionId)

  // Controles da UI
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  // Região para provedores (lida na sessão; usamos no extractProviders)
  const [watchRegion, setWatchRegion] = useState<string>('BR')

  // Modal de detalhes
  const [modal, setModal] = useState<{ item: MatchItem; details: MovieDetails | null } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  async function openDetails(item: MatchItem) {
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
          'Filme sem título',

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

  // View filtrada/ordenada
  const visible = useMemo(() => {
    const term =
      q.trim().toLowerCase()

    let arr = items.filter(
      (item) =>
        term === '' ||
        item.title
          .toLowerCase()
          .includes(term),
    )

    if (sort === 'recent') {
      arr = arr.slice().sort(
        (a, b) =>
          b.latestAt - a.latestAt ||
          a.title.localeCompare(b.title),
      )
    } else {
      arr = arr.slice().sort(
        (a, b) =>
          a.title.localeCompare(b.title),
      )
    }

    return arr
  }, [items, q, sort])

  async function copyList() {
    const text = visible.map(movie => `${movie.title}${movie.year ? ` (${movie.year})` : ''} — ${movie.likes}/${movie.member_count} curtiram`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Lista copiada. Pronta para compartilhar.')
    } catch {
      setCopyStatus('Não foi possível copiar. Permita o acesso à área de transferência e tente novamente.')
    }
  }

  const featured = visible[0]
  return (
    <main className="cinema-page matches-page" id="conteudo">
      <a className="cinema-skip-link" href="#matches-selection">Pular para os filmes</a>
      <header className="cinema-container matches-header">
        <Link className="cinema-brand" to="/" aria-label="MovieMatch, página inicial"><span className="cinema-brand-mark"><Clapperboard size={23} aria-hidden="true" /></span>MovieMatch<span className="cinema-brand-dot">.</span></Link>
        <div className="matches-session"><span>Sessão <strong>{code.toUpperCase()}</strong></span>{sessionId ? <span className="matches-online"><i aria-hidden="true" />{onlineCount} online</span> : null}</div>
        <CinemaButton compact tone="secondary" direction="right" onClick={() => navigate(`/s/${code}`)}>Voltar a votar</CinemaButton>
      </header>
      <div className="cinema-container">
        <section className="matches-hero" aria-labelledby="matches-title">
          <div><p className="cinema-eyebrow"><Heart size={13} aria-hidden="true" />A escolha é de vocês</p><h1 id="matches-title">Gostos diferentes.<br /><span>O mesmo sim.</span></h1><p className="matches-intro">{items.length ? 'Todos curtiram. Agora, só falta escolher qual filme vai ganhar o play.' : 'Quando os gostos se encontram, os filmes aparecem aqui. A próxima escolha é de vocês.'}</p></div>
          <div className="matches-total" aria-live="polite"><span>{loading ? '—' : String(items.length).padStart(2, '0')}</span><p>{items.length === 1 ? 'filme em comum' : 'filmes em comum'}<small>Aprovados por todos os<br />participantes atuais.</small></p></div>
        </section>
        <section id="matches-selection" className="matches-selection" aria-labelledby="matches-selection-title" aria-busy={loading}>
          <div className="matches-toolbar">
            <div><p className="cinema-eyebrow">Sua próxima sessão</p><h2 id="matches-selection-title">A seleção do grupo</h2></div>
            <div className="matches-controls">
              <label className="matches-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar filme</span><input type="search" value={q} onChange={event => setQ(event.target.value)} placeholder="Buscar um filme" disabled={loading || !sessionId} /></label>
              <label className="matches-sort"><span className="sr-only">Ordenar filmes</span><select value={sort} onChange={event => setSort(event.target.value as SortKey)} disabled={loading || !sessionId}><option value="recent">Mais recentes</option><option value="title">Título (A→Z)</option></select><ChevronDown size={14} aria-hidden="true" /></label>
              <button className="matches-copy" onClick={copyList} disabled={!visible.length} title="Copiar lista"><Copy size={16} aria-hidden="true" /><span>Copiar lista</span></button>
            </div>
          </div>
          <p className="matches-copy-status" role="status">{copyStatus}</p>
          {loading ? <div className="matches-skeleton" role="status"><div /><span>Reunindo as escolhas de vocês…</span></div>
            : !sessionId ? <div className="matches-empty"><Film size={36} aria-hidden="true" /><h3>Sessão indisponível</h3><p>Confira o código da sessão. Ela pode ter expirado ou a conexão pode estar indisponível.</p><CinemaButton onClick={() => navigate('/')}>Ir para o início</CinemaButton></div>
            : listError ? <div className="matches-load-error" role="alert"><p>Não foi possível atualizar a seleção. Tente novamente em instantes.</p><button onClick={() => void loadMatches(sessionId)}>Tentar novamente</button></div> : null}
          {!loading && sessionId && !listError && !featured ? <div className="matches-empty"><Heart size={38} aria-hidden="true" /><span className="cinema-eyebrow">{q.trim() ? 'Vamos tentar outro título' : 'O próximo sim está por vir'}</span><h3>{q.trim() ? 'Esse filme não está na seleção.' : 'Ainda não deu match.'}</h3><p>{q.trim() ? 'Busque outro título ou veja todos os filmes aprovados pelo grupo.' : 'Continuem descobrindo filmes. O match aparece quando todos os participantes atuais curtem, com pelo menos duas pessoas.'}</p><CinemaButton direction="right" onClick={() => q.trim() ? setQ('') : navigate(`/s/${code}`)}>{q.trim() ? 'Limpar busca' : 'Continuar votando'}</CinemaButton></div> : null}
          {!loading && sessionId && featured ? <>
            <article className="matches-spotlight">
              <button className="matches-spotlight-poster" onClick={() => void openDetails(featured)} aria-label={`Ver detalhes de ${featured.title}`}><MatchPoster title={featured.title} poster={featured.poster_url} priority /><span className="matches-poster-open"><ArrowUpRight size={20} aria-hidden="true" /></span></button>
              <div className="matches-spotlight-copy"><p className="cinema-eyebrow"><Sparkles size={14} aria-hidden="true" />Em destaque</p><p className="matches-film-year">{featured.year ?? 'Ano não informado'} <span>· Escolha do grupo</span></p><h3>{featured.title}</h3><p className="matches-spotlight-description">Um filme em comum.<br />Uma boa razão para assistir juntos.</p><div className="matches-consensus"><span><Heart size={18} fill="currentColor" aria-hidden="true" /></span><div><strong>Todo mundo disse sim.</strong><p>{featured.likes} de {featured.member_count} participantes curtiram</p></div></div><CinemaButton direction="diagonal" onClick={() => void openDetails(featured)}>Explorar o filme</CinemaButton><p className="matches-detail-hint">Sinopse, trailer e onde assistir</p></div>
            </article>
            {visible.length > 1 ? <div className="matches-more-heading"><h3>Mais filmes para o seu play</h3><span>{visible.length - 1} {visible.length === 2 ? 'outra escolha' : 'outras escolhas'}</span></div> : null}
            <ul className="matches-grid">{visible.slice(1).map(movie => <li key={movie.movie_id}><button className="matches-film-card" onClick={() => void openDetails(movie)} aria-label={`Ver detalhes de ${movie.title}`}><div className="matches-card-image"><MatchPoster title={movie.title} poster={movie.poster_url} /><span className="matches-card-consensus"><Check size={13} aria-hidden="true" />{movie.likes}/{movie.member_count} curtiram</span><span className="matches-poster-open"><ArrowUpRight size={19} aria-hidden="true" /></span></div><div className="matches-card-copy"><span>{movie.year ?? 'Ano não informado'}</span><h4>{movie.title}</h4><p>{movie.latestAt ? 'Match em ' + new Date(movie.latestAt).toLocaleDateString('pt-BR') : 'Escolha do grupo'}</p></div></button></li>)}</ul>
          </> : null}
        </section>
        <footer className="matches-footer"><Clapperboard size={19} aria-hidden="true" /><p>Menos tempo escolhendo. Mais tempo assistindo juntos.</p><Link to={`/s/${code}`}>Continuar descobrindo <ArrowUpRight size={15} aria-hidden="true" /></Link></footer>
      </div>
      {modal ? <MatchDetailsDialog key={modal.item.movie_id} item={modal.item} details={modal.details} loading={loadingDetails} region={watchRegion} onClose={closeDetails} /> : null}
    </main>
  )
}
