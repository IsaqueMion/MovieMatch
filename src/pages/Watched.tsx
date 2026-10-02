import { translate as t, useLocale, currentLocale } from '../hooks/useLocale'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Clapperboard, Film, Search, Star } from 'lucide-react'
import CinemaButton from '../components/ui/cinema-button'
import SessionLoader from '../components/ui/session-loader'
import MatchPoster from '../components/matches/MatchPoster'
import { useWatchedMovies } from '../hooks/useWatchedMovies'
import { usePageMeta } from '../hooks/usePageMeta'
import { removeWatchedMovie, type WatchedMovie } from '../lib/movieLibrary'
import '../styles/library.css'
import AccountMenu from '../components/account/AccountMenu'
import { useAccount } from '../hooks/useAccount'

const MovieReviewsDialog = lazy(() => import('../components/reviews/MovieReviewsDialog'))

export default function Watched() {
  useLocale()
  const { code } = useParams()
  const navigate = useNavigate()
  const library = useWatchedMovies()
  const account = useAccount()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [selected, setSelected] = useState<WatchedMovie | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  usePageMeta({ title: t("Meus assistidos — MovieMatch"), description: t("Seus filmes assistidos e avaliações no MovieMatch."), robots: 'noindex,nofollow,noarchive' })
  const visible = useMemo(() => library.movies.filter(movie => movie.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, currentLocale()) : sort === 'rating' ? (b.review?.rating ?? 0) - (a.review?.rating ?? 0) || b.watched_at.localeCompare(a.watched_at) : b.watched_at.localeCompare(a.watched_at)), [library.movies, query, sort])
  async function remove(movie: WatchedMovie) {
    if (removing) return
    if (movie.review && !window.confirm(`Desmarcar “${movie.title}” também exclui sua avaliação pública. Continuar?`)) return
    setRemoving(movie.id)
    try { await removeWatchedMovie(movie.id); setStatus(t("Filme removido dos seus assistidos.")) }
    catch { setStatus(t("Não foi possível desmarcar o filme. Tente novamente.")) }
    finally { setRemoving(null) }
  }
  return <main className="cinema-page library-page" id="conteudo">
    <header className="cinema-container library-header"><Link className="cinema-brand" to="/" aria-label={t("MovieMatch, página inicial")}><Clapperboard size={24} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link><AccountMenu /><CinemaButton compact tone="secondary" direction="right" onClick={() => navigate(code ? `/s/${code}/matches` : '/')}>{code ? t("Voltar aos matches") : t("Ir para o início")}</CinemaButton></header>
    <div className="cinema-container"><section className="library-hero"><div><p className="cinema-eyebrow"><Check size={13} aria-hidden="true" />{t("Sua história no cinema")}</p><h1>{t("O play passou.")}<br /><span>{t("A história ficou.")}</span></h1><p>{t("Seus filmes assistidos, suas notas e os olhares que você compartilhou.")}</p></div><div className="library-total"><strong>{library.loading ? '—' : String(library.movies.length).padStart(2, '0')}</strong><span>{library.movies.length === 1 ? t("filme assistido") : t("filmes assistidos")}</span></div></section>
      <section className="library-selection" aria-label={t("Meus assistidos")} aria-busy={library.loading}><div className="library-toolbar"><div><p className="cinema-eyebrow">{t("Depois dos créditos")}</p><h2>{t("Meus assistidos")}</h2></div><div><label className="library-search"><Search size={16} aria-hidden="true" /><span className="sr-only">{t("Buscar assistido")}</span><input type="search" placeholder={t("Buscar um filme")} value={query} onChange={event => setQuery(event.target.value)} /></label><label><span className="sr-only">{t("Ordenar assistidos")}</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">{t("Assistidos recentes")}</option><option value="rating">{t("Minhas melhores notas")}</option><option value="title">{t("Título (A→Z)")}</option></select></label></div></div>
        <p className="library-status" role="status">{status}</p>
        {library.error ? <p className="library-error" role="alert">{t("Não foi possível atualizar seus assistidos.")}<button type="button" onClick={library.refresh}>{t("Tentar novamente")}</button></p> : null}
        {library.loading ? <div className="library-loading"><SessionLoader label={t("Reunindo suas histórias…")} /></div> : !visible.length && !library.error ? <div className="library-empty"><Film size={36} aria-hidden="true" /><h3>{query.trim() ? t("Nenhum filme com esse título.") : t("O primeiro play vem aí.")}</h3><p>{query.trim() ? t("Tente outro nome para encontrar um filme da sua lista.") : t("Depois de assistir a um filme, abra o match e marque “Já assisti”. Ele vem para cá, e você pode avaliá-lo quando quiser.")}</p><CinemaButton compact direction="right" onClick={() => query.trim() ? setQuery('') : navigate(code ? `/s/${code}/matches` : '/')}>{query.trim() ? t("Limpar busca") : code ? t("Ver meus matches") : t("Começar uma sessão")}</CinemaButton></div> : null}
        <ul className="library-grid">{visible.map(movie => <li key={movie.id} className="library-movie-card"><button type="button" className="library-poster-button" aria-label={`Ver avaliações de ${movie.title}`} onClick={() => setSelected(movie)}><MatchPoster title={movie.title} poster={movie.poster_url} /><span className="library-watched-badge"><Check size={13} aria-hidden="true" />{t("Assistido")}</span></button><div className="library-movie-copy"><span>{movie.year}</span><h3>{movie.title}</h3><p>{t("Marcado em") + " "}{new Date(movie.watched_at).toLocaleDateString(currentLocale())}</p><div className="library-own-rating"><Star size={15} fill={movie.review ? 'currentColor' : 'none'} aria-hidden="true" />{movie.review ? `Sua nota: ${movie.review.rating}/5` : t("Você ainda não avaliou")}</div><button type="button" className="library-rate-button" onClick={() => setSelected(movie)}>{movie.review ? t("Editar avaliação") : t("Avaliar filme")}</button><button type="button" className="library-text-button" disabled={!!removing} onClick={() => void remove(movie)}>{removing === movie.id ? t("Removendo…") : t("Desmarcar assistido")}</button></div></li>)}</ul>
      </section><footer className="library-footer"><p>{t("Sua lista é pessoal. Suas avaliações são públicas.")}</p><small>{account.registered ? t("Seu histórico está salvo na sua conta.") : <>{t("Seu histórico de visitante fica neste navegador.") + " "}<Link to="/conta?voltar=%2Fassistidos">{t("Crie uma conta para preservá-lo.")}</Link></>}</small>{code ? <Link to={`/s/${code}`}>{t("Continuar descobrindo filmes")}</Link> : null}</footer>
    </div>{selected ? <Suspense fallback={null}><MovieReviewsDialog key={selected.tmdb_id} movie={selected} onClose={() => setSelected(null)} /></Suspense> : null}
  </main>
}
