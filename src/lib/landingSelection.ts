export type LandingMovie = { id: number; title: string; year: number; poster: string; preview?: string }
export type LandingSelection = { posters: LandingMovie[]; featured: LandingMovie }

/** Draw once per visit; the featured film and the two rails never share a poster. */
export function selectLandingMovies(movies: LandingMovie[], previousFeatured?: number, random = Math.random): LandingSelection {
  const ids = new Set<number>()
  const posters = new Set<string>()
  const pool = movies.filter(movie => {
    if (ids.has(movie.id) || posters.has(movie.poster)) return false
    ids.add(movie.id)
    posters.add(movie.poster)
    return true
  })
  if (pool.length === 0) throw new Error('The landing catalogue must contain at least one film.')
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[pool[index], pool[other]] = [pool[other], pool[index]]
  }
  const featured = pool.find(movie => movie.id !== previousFeatured) || pool[0]
  return { featured, posters: pool.filter(movie => movie.id !== featured.id).slice(0, 18) }
}
