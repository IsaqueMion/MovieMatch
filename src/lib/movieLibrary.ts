import { supabase } from './supabase'
import { ensureAnonymousUser } from './auth'

export type LibraryMovie = { tmdb_id: number; title: string; year: number | null; poster_url: string | null }
export type MovieReview = { id: string; tmdb_id: number; display_name: string; rating: number; comment: string; contains_spoilers: boolean; created_at: string; updated_at: string }
export type WatchedMovie = LibraryMovie & { id: string; watched_at: string; review?: MovieReview }
export type ReviewDraft = Pick<MovieReview, 'display_name' | 'rating' | 'comment' | 'contains_spoilers'>
export const REVIEW_PAGE_SIZE = 20
const reviewFields = 'id,tmdb_id,display_name,rating,comment,contains_spoilers,created_at,updated_at'
const watchFields = 'id,tmdb_id,title,year,poster_url,watched_at'
const changed = () => window.dispatchEvent(new Event('moviematch:watched-changed'))

export async function listWatchedMovies(): Promise<WatchedMovie[]> {
  const { data: { session }, error: authError } = await supabase.auth.getSession()
  if (authError) throw authError
  if (!session) return []
  const movies: WatchedMovie[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('watched_movies').select(watchFields).order('watched_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499)
    if (error) throw error
    const batch = (data ?? []) as WatchedMovie[]
    movies.push(...batch)
    if (batch.length < 500) break
  }
  if (!movies.length) return []
  // Query in batches; never expose the private history or user IDs in the public review feed.
  const reviews: MovieReview[] = []
  for (let i = 0; i < movies.length; i += 100) {
    const response = await supabase.from('movie_reviews').select(reviewFields).in('id', movies.slice(i, i + 100).map(movie => movie.id))
    if (response.error) throw response.error
    reviews.push(...(response.data ?? []) as MovieReview[])
  }
  const byId = new Map(reviews.map(review => [review.id, review]))
  return movies.map(movie => ({ ...movie, review: byId.get(movie.id) }))
}

export async function getMyWatchedMovie(tmdbId: number): Promise<WatchedMovie | null> {
  const { data, error } = await supabase.from('watched_movies').select(watchFields).eq('tmdb_id', tmdbId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const response = await supabase.from('movie_reviews').select(reviewFields).eq('id', data.id).maybeSingle()
  if (response.error) throw response.error
  return { ...data, review: response.data ?? undefined } as WatchedMovie
}

export async function markMovieWatched(movie: LibraryMovie): Promise<WatchedMovie> {
  const user = await ensureAnonymousUser()
  const { data, error } = await supabase.from('watched_movies').insert({ ...movie, user_id: user.id }).select(watchFields).single()
  // Retried clicks and another open tab preserve the original watch date.
  if (error?.code === '23505') {
    const existing = await getMyWatchedMovie(movie.tmdb_id)
    if (existing) return existing
  }
  if (error) throw error
  changed()
  return data as WatchedMovie
}

export async function removeWatchedMovie(id: string) {
  const { error } = await supabase.from('watched_movies').delete().eq('id', id).select('id').single()
  if (error) throw error
  changed()
}

export async function getMovieReviewPage(tmdbId: number, offset = 0) {
  const { data, error, count } = await supabase.from('movie_reviews').select(reviewFields, { count: 'exact' }).eq('tmdb_id', tmdbId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + REVIEW_PAGE_SIZE - 1)
  if (error) throw error
  return { reviews: (data ?? []) as MovieReview[], total: count ?? 0 }
}

export async function getMovieReviewSummary(tmdbId: number) {
  const { data, error } = await supabase.rpc('movie_review_summary', { p_tmdb_id: tmdbId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : null
  return { average: row?.average_rating == null ? null : Number(row.average_rating), total: Number(row?.review_count ?? 0) }
}

export async function saveMovieReview(movie: WatchedMovie, draft: ReviewDraft) {
  const values = { ...draft, display_name: draft.display_name.trim(), comment: draft.comment.trim() }
  let response = movie.review
    ? await supabase.from('movie_reviews').update(values).eq('id', movie.id).select(reviewFields).single()
    : await supabase.from('movie_reviews').insert({ ...values, id: movie.id, tmdb_id: movie.tmdb_id }).select(reviewFields).single()
  if (response.error?.code === '23505') response = await supabase.from('movie_reviews').update(values).eq('id', movie.id).select(reviewFields).single()
  if (response.error) throw response.error
  changed()
  return response.data as MovieReview
}

export async function deleteMovieReview(id: string) {
  const { error } = await supabase.from('movie_reviews').delete().eq('id', id).select('id').single()
  if (error) throw error
  changed()
}
