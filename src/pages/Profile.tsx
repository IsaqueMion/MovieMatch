import { translate as t, useLocale, currentLocale } from '../hooks/useLocale'
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clapperboard, Star, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { mediaUrl, myProfile, profileFields, type Favorite, type Profile as ProfileData } from '../lib/account'
import { useAccount } from '../hooks/useAccount'
import { usePageMeta } from '../hooks/usePageMeta'
import AccountMenu from '../components/account/AccountMenu'
import CinemaButton from '../components/ui/cinema-button'
import MatchPoster from '../components/matches/MatchPoster'
import SessionLoader from '../components/ui/session-loader'
import type { LibraryMovie } from '../lib/movieLibrary'
import { GENRES } from '../components/swipe/filterOptions'
import '../styles/account.css'

const ProfileEditorDialog = lazy(() => import('../components/account/ProfileEditorDialog'))
type ProfileReview = LibraryMovie & { rating: number; comment: string; contains_spoilers: boolean; created_at: string }

export default function Profile() {
  useLocale()
  const { handle } = useParams()
  const editing = !handle
  const account = useAccount()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [reviews, setReviews] = useState<ProfileReview[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LibraryMovie[]>([])
  const [more, setMore] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  useEffect(() => {
    const changed = (event: Event) => { const updated = (event as CustomEvent<ProfileData>).detail; if (updated && updated.id === profile?.id) { setProfile(updated); setStatus(t("Perfil salvo.")) } }
    window.addEventListener('moviematch:profile-changed', changed)
    return () => window.removeEventListener('moviematch:profile-changed', changed)
  }, [profile?.id])
  usePageMeta({ title: `${profile?.display_name ?? t("Perfil")} — MovieMatch`, description: t("Favoritos e opiniões de quem vive o cinema."), robots: 'noindex,nofollow,noarchive' })
  useEffect(() => {
    let active = true
    if (editing && account.loading) return
    setLoading(true); setError('')
    if (editing && !account.registered) { setProfile(null); setLoading(false); return }
    void (async () => {
      try {
        let found: ProfileData
        if (editing) found = await myProfile()
        else {
          const response = await supabase.from('profiles').select(profileFields).eq('handle', handle).maybeSingle()
          if (response.error) throw response.error
          if (!response.data) { if (active) setProfile(null); return }
          found = response.data as ProfileData
        }
        const [films, feed] = await Promise.all([supabase.from('profile_favorites').select('*').eq('profile_id', found.id).order('slot'), supabase.rpc('profile_reviews', { p_handle: found.handle, p_offset: 0 })])
        if (films.error || feed.error) throw films.error || feed.error
        if (active) { setProfile(found); setFavorites(films.data ?? []); setReviews(feed.data ?? []); setMore((feed.data ?? []).length === 20) }
      } catch { if (active) setError(t("Não foi possível carregar o perfil. Recarregue para tentar novamente.")) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [handle, editing, account.loading, account.registered])
  async function search(event: FormEvent) {
    event.preventDefault(); if (query.trim().length < 2 || searching) return
    setSearching(true); setSearchError('')
    try {
      const { data, error } = await supabase.functions.invoke('search_movies', { body: { query: query.trim(), language: currentLocale() } })
      if (error) throw error
      setResults(data.movies ?? []); if (!data.movies?.length) setSearchError(t("Nenhum filme encontrado. Tente outro título."))
    } catch { setSearchError(t("Não foi possível buscar filmes. Tente novamente.")) }
    finally { setSearching(false) }
  }
  async function favorite(movie: LibraryMovie | Favorite) {
    if (!profile || busy) return
    setBusy(true); setError('')
    const existing = favorites.find(row => row.tmdb_id === movie.tmdb_id)
    if (existing) {
      const result = await supabase.from('profile_favorites').delete().eq('profile_id', profile.id).eq('slot', existing.slot).select('slot').single()
      if (result.error) setError(t("Não foi possível remover esse favorito."))
      else setFavorites(rows => rows.filter(row => row.slot !== existing.slot))
    } else {
      const slot = [1,2,3,4].find(value => !favorites.some(row => row.slot === value))
      if (!slot) setError(t("Você já escolheu quatro favoritos. Remova um para adicionar outro."))
      else {
        const result = await supabase.from('profile_favorites').insert({ ...movie, profile_id: profile.id, slot }).select('*').single()
        if (result.error) setError(t("Não foi possível adicionar esse favorito."))
        else setFavorites(rows => [...rows, result.data as Favorite].sort((a,b) => a.slot-b.slot))
      }
    }
    setBusy(false)
  }
  async function moreReviews() {
    if (!profile || busy) return
    setBusy(true)
    const result = await supabase.rpc('profile_reviews', { p_handle: profile.handle, p_offset: reviews.length })
    if (result.error) setError(t("Não foi possível carregar mais avaliações."))
    else { setReviews(rows => [...rows, ...result.data]); setMore(result.data.length === 20) }
    setBusy(false)
  }
  async function logout() {
    setBusy(true); setError('')
    const result = await supabase.auth.signOut({ scope: 'local' })
    if (result.error) { setError(t("Não foi possível sair da conta. Tente novamente.")); setBusy(false) }
    else window.location.replace('/')
  }
  return <div className="cinema-page account-page"><header className="cinema-container account-header"><Link className="cinema-brand" to="/"><Clapperboard size={22} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link><AccountMenu /></header><main id="conteudo" className="cinema-container account-content profile-content">
    {error ? <p className="library-error" role="alert">{error}</p> : null}<p role="status">{status}</p>
    {loading ? <SessionLoader /> : !profile ? <><h1>{editing ? t("Seu cinema, com sua cara.") : t("Perfil indisponível.")}</h1><p>{editing ? <Link className="account-link" to="/conta?voltar=%2Fperfil">{t("Entre para montar seu perfil.")}</Link> : t("Este perfil não existe ou está privado.")}</p></> : <>
      <div className="profile-cover"><span className="cinema-eyebrow">{t("MovieMatch · Seu olhar sobre o cinema")}</span>{profile.cover_path ? <img src={mediaUrl(profile.cover_path)} alt="" onError={event => { event.currentTarget.hidden=true }} /> : null}</div>
      <section className="profile-identity"><div className="profile-avatar"><UserRound size={42} aria-hidden="true" />{profile.avatar_path ? <img key={profile.avatar_path} src={mediaUrl(profile.avatar_path)} alt={t('Foto de {0}', [profile.display_name])} onError={event => { event.currentTarget.hidden=true }} /> : null}</div><div><p className="cinema-eyebrow">@{profile.handle}</p><h1>{profile.display_name}</h1><p>{profile.bio || (editing ? t("O seu gosto conta uma história. Conte a sua.") : '')}</p><div className="profile-genres">{GENRES.filter(({ id }) => profile.genres.includes(id)).map(({ id, name }) => <span key={id}>{t(name)}</span>)}</div></div></section>
      {editing ? <div className="profile-edit-actions"><CinemaButton compact className="profile-edit-trigger" onClick={() => setEditorOpen(true)}>{t("Editar perfil")}</CinemaButton><Link className="account-link" to={`/p/${profile.handle}`}>{t("Abrir meu perfil público")}</Link></div> : null}
      {editorOpen && editing ? <Suspense fallback={<p role="status">{t("Abrindo edição…")}</p>}><ProfileEditorDialog profile={profile} onClose={() => setEditorOpen(false)} /></Suspense> : null}
      {editing || profile.show_favorites ? <section className="profile-section"><p className="cinema-eyebrow">{t("Os que ficam com você")}</p><h2>{t("Quatro favoritos.")}</h2><div className="profile-favorites">{favorites.map(movie => <figure key={movie.slot}><MatchPoster title={movie.title} poster={movie.poster_url} /><figcaption>{movie.title}{editing ? <button disabled={busy} onClick={() => void favorite(movie)} aria-label={`Remover ${movie.title} dos favoritos`}>{t("Remover")}</button> : null}</figcaption></figure>)}</div>{!favorites.length ? <p>{t("A seleção de favoritos ainda está começando.")}</p> : null}{editing ? <><form className="profile-search" onSubmit={search}><label>{t("Buscar filme")}<input type="search" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={80} placeholder={t("Título do filme")} /></label><CinemaButton compact type="submit" disabled={searching || query.trim().length < 2}>{searching ? t("Buscando…") : t("Buscar")}</CinemaButton></form><p role="status">{searchError}</p><div className="profile-search-results">{results.map(movie => <button key={movie.tmdb_id} disabled={busy || favorites.some(row => row.tmdb_id === movie.tmdb_id)} onClick={() => void favorite(movie)}><MatchPoster title={movie.title} poster={movie.poster_url} /><span>{movie.title}<small>{movie.year} · {favorites.some(row => row.tmdb_id === movie.tmdb_id) ? 'Favorito' : 'Adicionar'}</small></span></button>)}</div><small>{t("Filmes e imagens:") + " "}<a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>.</small></> : null}</section> : null}
      {editing || profile.show_reviews ? <section className="profile-section"><p className="cinema-eyebrow">{t("Depois do play")}</p><h2>{t("Os seus olhares.")}</h2>{reviews.map((review,index) => <article className="profile-review" key={`${review.tmdb_id}-${index}`}><MatchPoster title={review.title} poster={review.poster_url} /><div><h3>{review.title}</h3><span className="profile-rating"><Star size={16} fill="currentColor" aria-hidden="true" />{review.rating}/5</span><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString(currentLocale())}</time>{review.contains_spoilers ? <details><summary>{t("Comentário com spoilers")}</summary><p>{review.comment}</p></details> : <p>{review.comment || t("Avaliação sem comentário.")}</p>}</div></article>)}{!reviews.length ? <p>{t("As avaliações publicadas aparecem aqui.")}</p> : null}{more ? <button disabled={busy} onClick={() => void moreReviews()}>{t("Ver mais avaliações")}</button> : null}</section> : null}
      {editing ? <footer className="profile-footer"><Link to="/assistidos">{t("Meus assistidos")}</Link><a href="/#minhas-salas">{t("Minhas salas")}</a><button disabled={busy} onClick={() => void logout()}>{t("Sair da conta neste aparelho")}</button></footer> : null}
    </>}
  </main></div>
}
