import { translate as t, useLocale, currentLocale } from '../../hooks/useLocale'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount'
import { accountHref, mediaUrl, myProfile } from '../../lib/account'
import { Check, MessageSquare, Star, X } from 'lucide-react'
import CinemaButton from '../ui/cinema-button'
import MatchPoster from '../matches/MatchPoster'
import PeekRating from '../ui/PeekRating'
import ReviewVoteButton from '../ui/review-vote-button'
import { emptyReviewVote, getReviewVotes, setReviewVote, type ReviewVote } from '../../lib/reviewVotes'
import { trapDialogFocus } from '../../lib/dialogFocus'
import { deleteMovieReview, getMovieReviewPage, getMovieReviewSummary, getMyWatchedMovie, markMovieWatched, saveMovieReview, type LibraryMovie, type MovieReview, type ReviewDraft, type WatchedMovie } from '../../lib/movieLibrary'
import '../../styles/library.css'

const emptyDraft = (): ReviewDraft => {
  let name = ''
  try { name = localStorage.getItem('mm:review-name') ?? '' } catch { /* Nickname remains editable. */ }
  return { display_name: name, rating: 0, comment: '', contains_spoilers: false }
}

export default function MovieReviewsDialog({ movie, onClose }: { movie: LibraryMovie; onClose: () => void }) {
  useLocale()
  const account = useAccount()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requestRef = useRef(0)
  const [myMovie, setMyMovie] = useState<WatchedMovie | null>(null)
  const [reviews, setReviews] = useState<MovieReview[]>([])
  const [summary, setSummary] = useState<{ average: number | null; total: number }>({ average: null, total: 0 })
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [moreBusy, setMoreBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [votes, setVotes] = useState<Record<string, ReviewVote>>({})
  const [votesError, setVotesError] = useState('')
  const [votingBusy, setVotingBusy] = useState<string | null>(null)
  const votingRef = useRef(false)
  const cancelRequests = useCallback(() => { requestRef.current++ }, [])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setLoadFailed(false)
    setMoreBusy(false)
    setVotingBusy(null)
    setError('')
    try {
      const [mine, feed, average, profile] = await Promise.all([getMyWatchedMovie(movie.tmdb_id), getMovieReviewPage(movie.tmdb_id), getMovieReviewSummary(movie.tmdb_id), account.registered ? myProfile() : Promise.resolve(null)])
      let totals: ReviewVote[] = []
      try { totals = await getReviewVotes(feed.reviews.map(review => review.id)) }
      catch { if (request === requestRef.current) setVotesError(t("Não foi possível consultar os votos. Tente novamente.")) }
      if (request !== requestRef.current) return
      setVotes(Object.fromEntries(totals.map(row => [row.review_id, row])))
      if (totals.length || !feed.reviews.length) setVotesError('')
      setMyMovie(mine)
      setHasLoaded(true)
      setReviews(feed.reviews)
      setSummary(average)
      setDraft({ ...(mine?.review ? { display_name: mine.review.display_name, rating: mine.review.rating, comment: mine.review.comment, contains_spoilers: mine.review.contains_spoilers } : emptyDraft()), ...(profile ? { display_name: profile.display_name } : {}) })
    } catch { if (request === requestRef.current) { setLoadFailed(true); setError(t("Não foi possível carregar as avaliações. Tente novamente.")) } }
    finally { if (request === requestRef.current) setLoading(false) }
  }, [movie.tmdb_id, account.registered])

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    void load()
    return () => {
      cancelRequests()
      dialog?.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      else document.querySelector<HTMLElement>('.cinema-vote-button.is-like:not(:disabled), .matches-film-card, .matches-library-link, .library-rate-button')?.focus({ preventScroll: true })
    }
  }, [load, cancelRequests])

  async function mark() {
    if (busy) return
    setBusy(true); setError('')
    try { setMyMovie(await markMovieWatched(movie)); setStatus(t("Adicionado aos seus assistidos. A avaliação é opcional.")) }
    catch { setError(t("Não foi possível marcar o filme. Tente novamente.")) }
    finally { setBusy(false) }
  }
  async function save() {
    if (!myMovie || busy || draft.rating < 1 || draft.display_name.trim().length < 2) return
    setBusy(true); setError('')
    try {
      await saveMovieReview(myMovie, draft)
      try { localStorage.setItem('mm:review-name', draft.display_name.trim()) } catch { /* Saving the review does not depend on local storage. */ }
      await load()
      setStatus(t("Sua avaliação foi publicada."))
    } catch { setError(t("Não foi possível salvar sua avaliação. Seus textos continuam aqui para tentar novamente.")) }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!myMovie?.review || busy) return
    setBusy(true); setError('')
    try { await deleteMovieReview(myMovie.id); await load(); setStatus(t("Avaliação excluída. O filme continua nos seus assistidos.")); setConfirmDelete(false) }
    catch { setError(t("Não foi possível excluir a avaliação. Tente novamente.")) }
    finally { setBusy(false) }
  }
  async function more() {
    if (moreBusy) return
    const request = requestRef.current
    setMoreBusy(true)
    try {
      const next = await getMovieReviewPage(movie.tmdb_id, reviews.length)
      let totals: ReviewVote[] = []
      try { totals = await getReviewVotes(next.reviews.map(review => review.id)) }
      catch { if (request === requestRef.current) setVotesError(t("Não foi possível consultar os votos. Tente novamente.")) }
      if (request === requestRef.current) {
        setReviews(previous => [...new Map([...previous, ...next.reviews].map(review => [review.id, review])).values()])
        setVotes(previous => ({ ...previous, ...Object.fromEntries(totals.map(row => [row.review_id, row])) }))
        setSummary(previous => ({ ...previous, total: next.total }))
      }
    } catch { if (request === requestRef.current) setError(t("Não foi possível carregar mais avaliações. Tente novamente.")) }
    finally { if (request === requestRef.current) setMoreBusy(false) }
  }

  async function refreshVotes() {
    const request = requestRef.current
    try {
      const rows = await getReviewVotes(reviews.map(review => review.id))
      if (request !== requestRef.current) return
      setVotes(Object.fromEntries(rows.map(row => [row.review_id, row]))); setVotesError('')
    } catch { if (request === requestRef.current) setVotesError(t("Não foi possível consultar os votos. Tente novamente.")) }
  }
  async function vote(id: string, direction: 1 | -1): Promise<boolean> {
    if (votingRef.current || id === myMovie?.id || !votes[id]) return false
    votingRef.current = true; setVotingBusy(id); setVotesError('')
    const request = requestRef.current, previous = votes[id]
    const next = previous.my_vote === direction ? 0 : direction
    try {
      await setReviewVote(id, next)
      if (request !== requestRef.current) return false
      setVotes(rows => ({ ...rows, [id]: { ...previous, my_vote: next, upvotes: previous.upvotes + Number(next === 1) - Number(previous.my_vote === 1), downvotes: previous.downvotes + Number(next === -1) - Number(previous.my_vote === -1) } }))
      setStatus(next === 0 ? t("Voto removido.") : t("Seu voto foi salvo."))
      try {
        const [total] = await getReviewVotes([id])
        if (total && request === requestRef.current) setVotes(rows => ({ ...rows, [id]: total }))
      } catch { if (request === requestRef.current) setVotesError(t("Seu voto foi salvo. Não foi possível atualizar as contagens agora.")) }
      return request === requestRef.current
    } catch { if (request === requestRef.current) setVotesError(t("Não foi possível salvar seu voto. Tente novamente.")); return false }
    finally { votingRef.current = false; if (request === requestRef.current) setVotingBusy(null) }
  }

  return <dialog ref={dialogRef} className="library-dialog" aria-labelledby="reviews-title" onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="library-dialog-header"><div><p className="cinema-eyebrow"><MessageSquare size={13} aria-hidden="true" />{t("Comunidade MovieMatch")}</p><h2 id="reviews-title">{t("O que ficou")}<br /><span>{t("depois do play.")}</span></h2></div><button type="button" className="matches-icon-button" onClick={onClose} disabled={busy} aria-label={t("Fechar avaliações")} autoFocus><X size={19} aria-hidden="true" /></button></header>
    <div className="library-review-film"><MatchPoster title={movie.title} poster={movie.poster_url} /><div><h3>{movie.title}</h3><p>{movie.year}</p><span className="library-review-average"><Star size={17} fill="currentColor" aria-hidden="true" />{summary.average?.toFixed(1) ?? '—'}<small>/ 5 · {summary.total} {summary.total === 1 ? t("avaliação") : t("avaliações")}</small></span></div></div>
    {error ? <p className="library-error" role="alert">{error}{!busy && loadFailed ? <button type="button" onClick={() => void load()}>{t("Tentar novamente")}</button> : null}</p> : null}
    <p className="library-status" role="status">{status}</p>
    {loading ? <p className="library-loading" role="status">{t("Reunindo as avaliações…")}</p> : hasLoaded ? <>
      <section className="library-review-editor" aria-label={t("Sua avaliação")}>
        {!account.registered ? <><h3>{t("Seu olhar merece uma conta.")}</h3><p>{t("Entre para dar estrelas, publicar comentários e votar nas avaliações. Ler a comunidade e marcar seus assistidos continuam livres.")}</p><Link className="account-link" to={accountHref()}>{t("Entrar ou criar conta")}</Link>{!myMovie ? <CinemaButton compact onClick={() => void mark()} disabled={busy}>{t("Já assisti")}</CinemaButton> : <p>{t("Este filme está nos seus assistidos.")}</p>}</> : !myMovie ? <><h3>{t("Já viu esse filme?")}</h3><p>{t("Adicione aos seus assistidos para dar uma nota e compartilhar o que achou.")}</p><CinemaButton compact direction="right" onClick={() => void mark()} disabled={busy}>{t("Já assisti")}</CinemaButton></> : <>
          <p className="cinema-eyebrow"><Check size={13} aria-hidden="true" />{t("Na sua lista de assistidos")}</p><h3>{myMovie.review ? t("Sua opinião pode mudar.") : t("Que nota merece?")}</h3>
          <div className="library-star-input"><PeekRating value={draft.rating} count={5} labels={['Ruim', 'Regular', 'Bom', t("Ótimo"), 'Excelente']} activeColor="#f5b400" idleColor="#52525b" tipColor="#27272a" tipTextColor="#f5f5f5" size={32} lift={7} magnify={1.15} riseDuration={320} popScale={1.3} showTip allowClear disabled={busy} ariaLabel={t("Sua nota de 1 a 5 estrelas")} onChange={rating => setDraft(previous => ({ ...previous, rating }))} /><span className="library-star-caption">{draft.rating ? `${draft.rating}/5` : t("Escolha sua nota")}</span></div>
          <p className="library-public-note">{t("Publicando como") + " "}<strong>{draft.display_name}</strong> · <Link to="/perfil">{t("Editar perfil")}</Link></p>
          <label className="library-field">{t("Seu comentário") + " "}<small>{t("opcional")}</small><textarea value={draft.comment} onChange={event => setDraft(previous => ({ ...previous, comment: event.target.value }))} maxLength={1000} rows={3} placeholder={t("O que fez esse filme valer o play?")} disabled={busy} /><span className="library-character-count">{draft.comment.length}/1000</span></label>
          <label className="library-spoiler-choice"><input type="checkbox" checked={draft.contains_spoilers} onChange={event => setDraft(previous => ({ ...previous, contains_spoilers: event.target.checked }))} disabled={busy} />{t("Meu comentário contém spoilers")}</label>
          <p className="library-public-note">{t("Seu apelido, nota e comentário ficam visíveis para todos os usuários. Sua lista de assistidos é pessoal.")}</p>
          <div className="library-editor-actions"><CinemaButton compact direction="right" onClick={() => void save()} disabled={busy || draft.rating < 1 || draft.display_name.trim().length < 2}>{busy ? t("Salvando…") : t("Salvar avaliação")}</CinemaButton>{myMovie.review ? <button type="button" className="library-text-button" disabled={busy} onClick={() => setConfirmDelete(value => !value)}>{t("Excluir minha avaliação")}</button> : null}</div>
          {confirmDelete ? <div className="library-delete-confirm"><p>{t("Excluir sua nota e comentário públicos?")}</p><button type="button" disabled={busy} onClick={() => void remove()}>{t("Confirmar exclusão")}</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>{t("Cancelar")}</button></div> : null}
        </>}
      </section>
      <section className="library-community" aria-label={t("Avaliações da comunidade")}><h3>{t("Outros olhares.")}</h3>{votesError ? <p className="library-error" role="alert">{votesError}<button type="button" onClick={() => void refreshVotes()}>{t("Atualizar contagens")}</button></p> : null}{reviews.length ? <ul>{reviews.map(review => <ReviewCard key={review.id} review={review} mine={review.id === myMovie?.id} totals={votes[review.id]} votingBusy={votingBusy !== null || busy || !account.registered} onVote={direction => vote(review.id, direction)} />)}</ul> : <p>{t("Ninguém avaliou ainda. O primeiro olhar pode ser o seu.")}</p>}{reviews.length < summary.total ? <button type="button" className="library-text-button" disabled={moreBusy} onClick={() => void more()}>{moreBusy ? t("Carregando…") : t("Ver mais avaliações")}</button> : null}</section>
    </> : null}
  </dialog>
}

function ReviewCard({ review, mine, totals, votingBusy, onVote }: { review: MovieReview; mine: boolean; totals?: ReviewVote; votingBusy: boolean; onVote: (direction: 1 | -1) => Promise<boolean> }) {
  useLocale()
  const [showSpoiler, setShowSpoiler] = useState(false)
  const votes = totals ?? emptyReviewVote(review.id)
  return <li className="library-public-review"><header><strong>{review.profiles ? <Link className="library-author" to={`/p/${review.profiles.handle}`}>{review.profiles.avatar_path ? <img src={mediaUrl(review.profiles.avatar_path)} alt="" width={28} height={28} /> : null}{review.display_name}</Link> : review.display_name}{mine ? <small>{t("Sua avaliação")}</small> : null}</strong><span><Star size={14} fill="currentColor" aria-hidden="true" />{review.rating}/5</span></header><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString(currentLocale())}</time>{review.comment ? review.contains_spoilers && !showSpoiler ? <button type="button" className="library-spoiler-reveal" onClick={() => setShowSpoiler(true)}>{t("Mostrar comentário com spoilers")}</button> : <p>{review.comment}</p> : <p className="library-rating-only">{t("Avaliação sem comentário.")}</p>}<div className="library-review-votes" role="group" aria-label={t("Votos na avaliação de {0}", [review.display_name])}><ReviewVoteButton direction="up" active={votes.my_vote === 1} count={votes.upvotes} disabled={mine || votingBusy || !totals} busy={votingBusy} onVote={() => onVote(1)} /><ReviewVoteButton direction="down" active={votes.my_vote === -1} count={votes.downvotes} disabled={mine || votingBusy || !totals} busy={votingBusy} onVote={() => onVote(-1)} />{mine ? <small>{t("Outras pessoas podem votar na sua avaliação.")}</small> : null}</div></li>
}
