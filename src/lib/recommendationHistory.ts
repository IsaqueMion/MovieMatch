import { supabase } from './supabase'
import { getMovieDetails } from './functions'
import { MAX_FEEDBACK, type MovieFeedback } from './recommendations'

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

export async function loadRecommendationHistory(): Promise<MovieFeedback[]> {
  const { data, error } = await supabase.rpc('list_my_recommendation_feedback', {
    p_limit: MAX_FEEDBACK,
  })
  // Allows rolling out the client before the additive database migration.
  if (isMissingFunction(error)) return []
  if (error) throw error
  if (!Array.isArray(data)) return []
  const history: MovieFeedback[] = data.map((row) => ({
    tmdb_id: Number(row.tmdb_id),
    year: row.year === null ? null : Number(row.year),
    genres: Array.isArray(row.genre_ids) ? row.genre_ids.map(Number) : [],
    session_id: String(row.session_id),
    value: Number(row.value) as 1 | -1,
    updated_at: String(row.updated_at),
  }))
  // Old votes predate genre storage. Recover a bounded sample so returning
  // people do not restart with an empty taste profile.
  if (history.filter((entry) => entry.genres.length > 0).length < 4) {
    const legacy = history.filter((entry) => entry.genres.length === 0)
    const sample = [...legacy.filter((entry) => entry.value === 1).slice(0, 6),
      ...legacy.filter((entry) => entry.value === -1).slice(0, 2)]
    await Promise.allSettled(sample.map(async (entry) => {
      const details = await getMovieDetails(entry.tmdb_id)
      entry.genres = details.genres.map((genre) => genre.id)
    }))
  }
  return history
}

/** The vote and training feedback commit together, including on retries. */
export async function saveMovieReaction(input: {
  sessionId: string; userId: string; movieId: number; value: 1 | -1; genres: number[]
}): Promise<void> {
  const { error } = await supabase.rpc('record_movie_reaction', {
    p_session_id: input.sessionId,
    p_movie_id: input.movieId,
    p_value: input.value,
    p_genre_ids: input.genres,
  })
  if (isMissingFunction(error)) {
    const { error: fallbackError } = await supabase.from('reactions').upsert({
      session_id: input.sessionId, user_id: input.userId,
      movie_id: input.movieId, value: input.value,
    }, { onConflict: 'session_id,user_id,movie_id' })
    if (fallbackError) throw fallbackError
    return
  }
  if (error) throw error
}

export async function undoMovieReaction(input: {
  sessionId: string; userId: string; movieId: number
}): Promise<void> {
  const { error } = await supabase.rpc('undo_movie_reaction', {
    p_session_id: input.sessionId, p_movie_id: input.movieId,
  })
  if (isMissingFunction(error)) {
    const { error: fallbackError } = await supabase.from('reactions').delete()
      .eq('session_id', input.sessionId).eq('user_id', input.userId).eq('movie_id', input.movieId)
    if (fallbackError) throw fallbackError
    return
  }
  if (error) throw error
}
