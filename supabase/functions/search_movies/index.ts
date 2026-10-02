import { createClient } from 'npm:@supabase/supabase-js@2.57.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
Deno.serve(async req => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } })
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.is_anonymous || !user.email_confirmed_at) return respond({ error: 'Account required' }, 401)
  try {
    const body = await req.json()
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (query.length < 2 || query.length > 80) return respond({ error: 'Invalid query' }, 400)
    const key = Deno.env.get('TMDB_KEY') ?? ''
    if (!key) return respond({ error: 'Search unavailable' }, 503)
    const url = new URL('https://api.themoviedb.org/3/search/movie')
    url.search = new URLSearchParams({ query, language: 'pt-BR', include_adult: 'false', page: '1', ...(!key.startsWith('eyJ') ? { api_key: key } : {}) }).toString()
    const response = await fetch(url, { headers: key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(8000) })
    if (!response.ok) return respond({ error: 'Search unavailable' }, 502)
    const { results } = await response.json()
    return respond({ movies: (results ?? []).filter((movie: { adult?: boolean }) => !movie.adult).slice(0, 20).map((movie: { id: number; title: string; release_date?: string; poster_path?: string }) => ({ tmdb_id: movie.id, title: movie.title, year: movie.release_date ? Number(movie.release_date.slice(0,4)) : null, poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null })) })
  } catch { return respond({ error: 'Search unavailable' }, 400) }
})
