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
  vote_average?: number
  genres?: { id: number; name: string }[]
  age_rating?: string
}

export async function discoverMovies(opts: { page?: number; filters?: DiscoverFilters }) {
  const { data, error } = await supabase.functions.invoke('discover', { body: opts })
  if (error) throw error
  return data
}

export async function getMovieDetails(tmdbId: number): Promise<MovieDetails> {
  const { data, error } = await supabase.functions.invoke('movie_details', { body: { tmdb_id: tmdbId } })
  if (error) throw error
  return data as MovieDetails
}
