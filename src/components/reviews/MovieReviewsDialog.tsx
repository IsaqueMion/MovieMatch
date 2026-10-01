import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, MessageSquare, Star, X } from 'lucide-react'
import CinemaButton from '../ui/cinema-button'
import MatchPoster from '../matches/MatchPoster'
import { trapDialogFocus } from '../../lib/dialogFocus'
import { deleteMovieReview, getMovieReviewPage, getMovieReviewSummary, getMyWatchedMovie, markMovieWatched, saveMovieReview, type LibraryMovie, type MovieReview, type ReviewDraft, type WatchedMovie } from '../../lib/movieLibrary'
import '../../styles/library.css'

const emptyDraft = (): ReviewDraft => {
  let name = ''
  try { name = localStorage.getItem('mm:review-name') ?? '' } catch { /* Nickname remains editable. */ }
  return { display_name: name, rating: 0, comment: '', contains_spoilers: false }
}

export default function MovieReviewsDialog({ movie, onClose }: { movie: LibraryMovie; onClose: () => void }) {
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
  const cancelRequests = useCallback(() => { requestRef.current++ }, [])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setLoadFailed(false)
    setMoreBusy(false)
    setError('')
    try {
      const [mine, feed, average] = await Promise.all([getMyWatchedMovie(movie.tmdb_id), getMovieReviewPage(movie.tmdb_id), getMovieReviewSummary(movie.tmdb_id)])
      if (request !== requestRef.current) return
      setMyMovie(mine)
      setHasLoaded(true)
      setReviews(feed.reviews)
      setSummary(average)
      setDraft(mine?.review ? { display_name: mine.review.display_name, rating: mine.review.rating, comment: mine.review.comment, contains_spoilers: mine.review.contains_spoilers } : emptyDraft())
    } catch { if (request === requestRef.current) { setLoadFailed(true); setError('Não foi possível carregar as avaliações. Tente novamente.') } }
    finally { if (request === requestRef.current) setLoading(false) }
  }, [movie.tmdb_id])

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
    try { setMyMovie(await markMovieWatched(movie)); setStatus('Adicionado aos seus assistidos. A avaliação é opcional.') }
    catch { setError('Não foi possível marcar o filme. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function save() {
    if (!myMovie || busy || draft.rating < 1 || draft.display_name.trim().length < 2) return
    setBusy(true); setError('')
    try {
      await saveMovieReview(myMovie, draft)
      try { localStorage.setItem('mm:review-name', draft.display_name.trim()) } catch { /* Saving the review does not depend on local storage. */ }
      await load()
      setStatus('Sua avaliação foi publicada.')
    } catch { setError('Não foi possível salvar sua avaliação. Seus textos continuam aqui para tentar novamente.') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!myMovie?.review || busy) return
    setBusy(true); setError('')
    try { await deleteMovieReview(myMovie.id); await load(); setStatus('Avaliação excluída. O filme continua nos seus assistidos.'); setConfirmDelete(false) }
    catch { setError('Não foi possível excluir a avaliação. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function more() {
    if (moreBusy) return
    const request = requestRef.current
    setMoreBusy(true)
    try {
      const next = await getMovieReviewPage(movie.tmdb_id, reviews.length)
      if (request === requestRef.current) {
        setReviews(previous => [...new Map([...previous, ...next.reviews].map(review => [review.id, review])).values()])
        setSummary(previous => ({ ...previous, total: next.total }))
      }
    } catch { if (request === requestRef.current) setError('Não foi possível carregar mais avaliações. Tente novamente.') }
    finally { if (request === requestRef.current) setMoreBusy(false) }
  }

  return <dialog ref={dialogRef} className="library-dialog" aria-labelledby="reviews-title" onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="library-dialog-header"><div><p className="cinema-eyebrow"><MessageSquare size={13} aria-hidden="true" />Comunidade MovieMatch</p><h2 id="reviews-title">O que ficou<br /><span>depois do play.</span></h2></div><button type="button" className="matches-icon-button" onClick={onClose} disabled={busy} aria-label="Fechar avaliações" autoFocus><X size={19} aria-hidden="true" /></button></header>
    <div className="library-review-film"><MatchPoster title={movie.title} poster={movie.poster_url} /><div><h3>{movie.title}</h3><p>{movie.year}</p><span className="library-review-average"><Star size={17} fill="currentColor" aria-hidden="true" />{summary.average?.toFixed(1) ?? '—'}<small>/ 5 · {summary.total} {summary.total === 1 ? 'avaliação' : 'avaliações'}</small></span></div></div>
    {error ? <p className="library-error" role="alert">{error}{!busy && loadFailed ? <button type="button" onClick={() => void load()}>Tentar novamente</button> : null}</p> : null}
    <p className="library-status" role="status">{status}</p>
    {loading ? <p className="library-loading" role="status">Reunindo as avaliações…</p> : hasLoaded ? <>
      <section className="library-review-editor" aria-label="Sua avaliação">
        {!myMovie ? <><h3>Já viu esse filme?</h3><p>Adicione aos seus assistidos para dar uma nota e compartilhar o que achou.</p><CinemaButton compact direction="right" onClick={() => void mark()} disabled={busy}>Já assisti</CinemaButton></> : <>
          <p className="cinema-eyebrow"><Check size={13} aria-hidden="true" />Na sua lista de assistidos</p><h3>{myMovie.review ? 'Sua opinião pode mudar.' : 'Que nota merece?'}</h3>
          <StarRating value={draft.rating} disabled={busy} onChange={rating => setDraft(previous => ({ ...previous, rating }))} />
          <label className="library-field">Apelido público<input value={draft.display_name} onChange={event => setDraft(previous => ({ ...previous, display_name: event.target.value }))} minLength={2} maxLength={32} placeholder="Como quer aparecer?" disabled={busy} autoComplete="nickname" /></label>
          <label className="library-field">Seu comentário <small>opcional</small><textarea value={draft.comment} onChange={event => setDraft(previous => ({ ...previous, comment: event.target.value }))} maxLength={1000} rows={3} placeholder="O que fez esse filme valer o play?" disabled={busy} /><span className="library-character-count">{draft.comment.length}/1000</span></label>
          <label className="library-spoiler-choice"><input type="checkbox" checked={draft.contains_spoilers} onChange={event => setDraft(previous => ({ ...previous, contains_spoilers: event.target.checked }))} disabled={busy} />Meu comentário contém spoilers</label>
          <p className="library-public-note">Seu apelido, nota e comentário ficam visíveis para todos os usuários. Sua lista de assistidos é pessoal.</p>
          <div className="library-editor-actions"><CinemaButton compact direction="right" onClick={() => void save()} disabled={busy || draft.rating < 1 || draft.display_name.trim().length < 2}>{busy ? 'Salvando…' : 'Salvar avaliação'}</CinemaButton>{myMovie.review ? <button type="button" className="library-text-button" disabled={busy} onClick={() => setConfirmDelete(value => !value)}>Excluir minha avaliação</button> : null}</div>
          {confirmDelete ? <div className="library-delete-confirm"><p>Excluir sua nota e comentário públicos?</p><button type="button" disabled={busy} onClick={() => void remove()}>Confirmar exclusão</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button></div> : null}
        </>}
      </section>
      <section className="library-community" aria-label="Avaliações da comunidade"><h3>Outros olhares.</h3>{reviews.length ? <ul>{reviews.map(review => <ReviewCard key={review.id} review={review} mine={review.id === myMovie?.id} />)}</ul> : <p>Ninguém avaliou ainda. O primeiro olhar pode ser o seu.</p>}{reviews.length < summary.total ? <button type="button" className="library-text-button" disabled={moreBusy} onClick={() => void more()}>{moreBusy ? 'Carregando…' : 'Ver mais avaliações'}</button> : null}</section>
    </> : null}
  </dialog>
}

function StarRating({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="library-star-input" role="radiogroup" aria-label="Sua nota de 1 a 5 estrelas">{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} role="radio" aria-label={`${star} de 5 estrelas`} aria-checked={value === star} tabIndex={value === star || (!value && star === 1) ? 0 : -1} disabled={disabled} onClick={() => onChange(star)} onKeyDown={event => {
    const next = event.key === 'Home' ? 1 : event.key === 'End' ? 5 : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? Math.min(5, star + 1) : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? Math.max(1, star - 1) : 0
    if (!next) return
    event.preventDefault(); event.stopPropagation(); onChange(next)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next - 1]?.focus()
  }}><Star size={28} fill={star <= value ? 'currentColor' : 'none'} aria-hidden="true" /></button>)}<span>{value ? `${value}/5` : 'Escolha sua nota'}</span></div>
}

function ReviewCard({ review, mine }: { review: MovieReview; mine: boolean }) {
  const [showSpoiler, setShowSpoiler] = useState(false)
  return <li className="library-public-review"><header><strong>{review.display_name}{mine ? <small>Sua avaliação</small> : null}</strong><span><Star size={14} fill="currentColor" aria-hidden="true" />{review.rating}/5</span></header><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('pt-BR')}</time>{review.comment ? review.contains_spoilers && !showSpoiler ? <button type="button" className="library-spoiler-reveal" onClick={() => setShowSpoiler(true)}>Mostrar comentário com spoilers</button> : <p>{review.comment}</p> : <p className="library-rating-only">Avaliação sem comentário.</p>}</li>
}
