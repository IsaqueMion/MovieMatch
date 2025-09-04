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

export async function discoverMovies(_opts: { page?: number; filters?: DiscoverFilters }) {
  // Stub com alguns filmes para testar o fluxo
  const sample = [
    { movie_id: 101, tmdb_id: 101, title: 'Interstellar', year: 2014, poster_url: 'https://image.tmdb.org/t/p/w500/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg', genres: [878,18] },
    { movie_id: 102, tmdb_id: 102, title: 'Duna: Parte Dois', year: 2024, poster_url: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', genres: [878,12] },
    { movie_id: 103, tmdb_id: 103, title: 'Oppenheimer', year: 2023, poster_url: 'https://image.tmdb.org/t/p/w500/bAFmcr5wYY3L8Vhx7zQmKe1oQl.jpg', genres: [18,36] },
  ]
  return { results: sample }
}

export async function getMovieDetails(_tmdbId: number): Promise<MovieDetails> {
  return {
    vote_average: 8.6,
    genres: [{ id: 878, name: 'Ficção científica' }, { id: 12, name: 'Aventura' }],
    age_rating: '14',
  }
}
