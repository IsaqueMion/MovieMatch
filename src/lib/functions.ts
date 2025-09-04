import { supabase } from '../lib/supabase'

export type DiscoverFilters = {
  genres?: number[]
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  language?: string
  sortBy?: string
}

export type MovieDetails = {
  tmdb_id: number
  title: string
  year: number | null
  poster_url: string | null
  vote_average: number | null
  genres: { id: number; name: string }[]
  runtime: number | null
  overview: string
  trailer: { key: string } | null
  age_rating: string
}

export async function discoverMovies(opts: { page?: number; filters?: DiscoverFilters }) {
  const { data, error } = await supabase.functions.invoke('discover', { body: opts })
  if (error) throw error
  return data as { results: Array<{
    movie_id: number
    tmdb_id: number
    title: string
    year: number | null
    poster_url: string | null
    genres: number[]
  }> }
}

export async function getMovieDetails(tmdb_id: number): Promise<MovieDetails> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/movie_details?tmdb_id=${tmdb_id}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      // Edge Functions do Supabase exigem o header Authorization:
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`movie_details ${res.status}`)
  return await res.json()
}

