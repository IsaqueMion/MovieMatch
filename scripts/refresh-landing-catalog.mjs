import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

let localEnv = ''
try { localEnv = await readFile(new URL('../.env.local', import.meta.url), 'utf8') } catch { /* CI can supply public credentials through env. */ }
function setting(name) {
  const match = localEnv.match(new RegExp('^' + name + '=(.*)$', 'm'))
  return process.env[name] || match?.[1]?.trim().replace(/^["']|["']$/g, '')
}
const url = setting('VITE_SUPABASE_URL')
const key = setting('VITE_SUPABASE_ANON_KEY')
if (!url || !key) throw new Error('Configure the public Supabase URL and anon key before refreshing the catalogue.')
const filters = { ratingMin: 7.5, voteCountMin: 3000, sortBy: 'popularity.desc', includeAdult: false }
const movies = new Map()
const previous = JSON.parse(await readFile(new URL('../src/data/landingMovies.json', import.meta.url), 'utf8'))
for (let page = 1; page <= 4; page++) {
  // Read-only discovery: uses the existing public anon key, never signs a visitor in.
  const response = await fetch(url + '/functions/v1/discover', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
    body: JSON.stringify({ page, filters }), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Catalogue discovery failed with status ' + response.status)
  const data = await response.json()
  if (!Array.isArray(data.results)) throw new Error('Unexpected catalogue response')
  for (const movie of data.results) {
    if (!Number.isInteger(movie.tmdb_id) || !movie.title || !Number.isInteger(movie.year)) continue
    if (typeof movie.poster_url !== 'string' || !/^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9]+\.jpg$/.test(movie.poster_url)) continue
    const preview = previous.movies.find(item => item.id === movie.tmdb_id && item.poster === movie.poster_url)?.preview
    movies.set(movie.tmdb_id, { id: movie.tmdb_id, title: movie.title, year: movie.year, poster: movie.poster_url, ...(preview ? { preview } : {}) })
  }
}
if (movies.size < 30) throw new Error('Insufficient unique posters; keeping the existing catalogue.')
const catalogue = { source: 'TMDB', refreshedAt: new Date().toISOString(), criteria: filters, movies: [...movies.values()] }
await writeFile(new URL('../src/data/landingMovies.json', import.meta.url), JSON.stringify(catalogue, null, 2) + '\n')
console.log('Updated public catalogue: ' + movies.size + ' unique films. Minimum rating 7.5; minimum votes 3000.')
console.log('Run scripts/refresh-landing-previews.py with Python 3 + Pillow to generate previews for new posters.')

