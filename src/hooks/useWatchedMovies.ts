import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { listWatchedMovies, type WatchedMovie } from '../lib/movieLibrary'

export function useWatchedMovies() {
  const [movies, setMovies] = useState<WatchedMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion(value => value + 1), [])
  const remember = useCallback((movie: WatchedMovie) => setMovies(previous => [movie, ...previous.filter(row => row.tmdb_id !== movie.tmdb_id)]), [])
  useEffect(() => {
    let alive = true
    void listWatchedMovies().then(rows => {
      if (alive) { setMovies(rows); setError(false) }
    }).catch(() => { if (alive) setError(true) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [version])
  useEffect(() => {
    // Callback only schedules work; queries run outside the auth event lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('moviematch:watched-changed', refresh)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('focus', refresh)
      window.removeEventListener('moviematch:watched-changed', refresh)
    }
  }, [refresh])
  return { movies, loading, error, refresh, remember }
}
