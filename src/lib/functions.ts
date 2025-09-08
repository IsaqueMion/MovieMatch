import { supabase } from '../lib/supabase'

export type MonetizationType = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy'

export type DiscoverFilters = {
  genres: number[]
  excludeGenres: number[]
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  voteCountMin?: number
  runtimeMin?: number
  runtimeMax?: number
  language?: string
  sortBy?: string
  includeAdult?: boolean
  providers?: number[]
  watchRegion?: string
  monetization?: MonetizationType[]
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

/* ---------------- Retry helpers ---------------- */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function invokeWithRetry<T>(
  name: string,
  body: any,
  tries = 3,
): Promise<T> {
  let lastErr: any = null
  for (let i = 0; i < tries; i++) {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (!error) return data as T
    lastErr = error
    const backoff = 300 * Math.pow(2, i) + Math.random() * 150
    await sleep(backoff)
  }
  throw lastErr
}

async function fetchWithRetry(input: RequestInfo, init?: RequestInit, tries = 3): Promise<Response> {
  let lastErr: any = null
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(input, init)
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    const backoff = 300 * Math.pow(2, i) + Math.random() * 150
    await sleep(backoff)
  }
  throw lastErr
}

/* ---------------- Discover com retry ---------------- */

export async function discoverMovies(opts: { page?: number; filters?: DiscoverFilters }) {
  // suporta opcionalmente { hint: 'relax_providers' } vindo da Edge Function
  return await invokeWithRetry<{
    hint?: 'relax_providers'
    page?: number
    total_pages?: number
    results: Array<{
      movie_id: number
      tmdb_id: number
      title: string
      year: number | null
      poster_url: string | null
      genres: number[]
    }>
  }>('discover', opts, 3)
}

/* ---------------- Detalhes com cache (TTL) + retry ---------------- */

const MD_CACHE_PREFIX = 'mm:md:v1:'
const MD_TTL = 1000 * 60 * 60 * 3 // 3 horas

export async function getMovieDetails(tmdb_id: number): Promise<MovieDetails> {
  const key = `${MD_CACHE_PREFIX}${tmdb_id}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && typeof obj.t === 'number' && Date.now() - obj.t < MD_TTL) {
        return obj.data as MovieDetails
      }
    }
  } catch {}

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/movie_details?tmdb_id=${tmdb_id}`
  const res = await fetchWithRetry(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  }, 3)

  if (!res.ok) throw new Error(`movie_details ${res.status}`)
  const data = await res.json()

  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }))
  } catch {}

  return data
}
