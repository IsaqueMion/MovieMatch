import { hash32 } from './swipeShuffle.ts'

export const RECOMMENDATION_VERSION = 'content-v2'
export const MAX_FEEDBACK = 500
const DAY_MS = 86_400_000
const HALF_LIFE_DAYS = 60

export type RecommendationMovie = {
  tmdb_id: number
  genres: number[]
  year: number | null
}

export type MovieFeedback = RecommendationMovie & {
  session_id: string
  value: 1 | -1
  updated_at: string
}

type Affinity = { signal: number; weight: number }
export type TasteProfile = {
  genres: Map<number, Affinity>
  recentGenres: Map<number, Affinity>
  decades: Map<number, Affinity>
  confidence: number
  feedbackCount: number
}

function uniqueGenres(genres: number[] | undefined): number[] {
  return [...new Set((genres ?? []).filter((id) => Number.isInteger(id) && id > 0))]
}

/** A repeat vote is a correction, not another training example. */
export function buildTasteProfile(
  history: MovieFeedback[],
  now = Date.now(),
): TasteProfile {
  const profile: TasteProfile = {
    genres: new Map(), recentGenres: new Map(), decades: new Map(), confidence: 0, feedbackCount: 0,
  }
  const latest = new Map<number, MovieFeedback>()
  for (const feedback of history) {
    const timestamp = Date.parse(feedback.updated_at)
    if (!Number.isFinite(timestamp) || ![1, -1].includes(feedback.value)) continue
    const previous = latest.get(feedback.tmdb_id)
    if (!previous || timestamp > Date.parse(previous.updated_at)) {
      latest.set(feedback.tmdb_id, feedback)
    }
  }

  function add(map: Map<number, Affinity>, key: number, value: number, weight: number) {
    const entry = map.get(key) ?? { signal: 0, weight: 0 }
    map.set(key, { signal: entry.signal + value * weight, weight: entry.weight + weight })
  }

  let evidence = 0
  for (const feedback of [...latest.values()]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, MAX_FEEDBACK)) {
    const ageDays = Math.max(0, (now - Date.parse(feedback.updated_at)) / DAY_MS)
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
    // Rejecting one movie is weaker evidence than choosing one.
    const signal = feedback.value === 1 ? 1 : -0.65
    const genres = uniqueGenres(feedback.genres)
    for (const genre of genres) {
      add(profile.genres, genre, signal, weight / Math.sqrt(genres.length))
      if (profile.feedbackCount < 8) {
        add(profile.recentGenres, genre, signal, weight / Math.sqrt(genres.length))
      }
    }
    if (feedback.year !== null && Number.isFinite(feedback.year)) {
      add(profile.decades, Math.floor(feedback.year / 10), signal, weight)
    }
    if (genres.length > 0) evidence += weight
    profile.feedbackCount += 1
  }
  // Shrink toward the catalogue order until there is enough evidence.
  profile.confidence = evidence / (evidence + 6)
  return profile
}

function affinity(map: Map<number, Affinity>, key: number): number {
  const entry = map.get(key)
  return entry ? entry.signal / (entry.weight + 2) : 0
}

export function movieAffinity(movie: RecommendationMovie, profile: TasteProfile): number {
  const genres = uniqueGenres(movie.genres)
  const genreScore = genres.length > 0
    ? genres.reduce((sum, id) => sum + 0.65 * affinity(profile.genres, id)
      + 0.35 * affinity(profile.recentGenres, id), 0) / genres.length
    : 0
  const decadeScore = movie.year === null ? 0 : affinity(profile.decades, Math.floor(movie.year / 10))
  return genreScore * 0.9 + decadeScore * 0.1
}

/** Used for an additional discovery query; never replaces shared session filters. */
export function preferredGenreIds(profile: TasteProfile): number[] {
  if (profile.confidence === 0) return []
  return [...profile.genres.entries()]
    .filter(([id, entry]) => entry.weight >= 0.5 &&
      0.65 * affinity(profile.genres, id) + 0.35 * affinity(profile.recentGenres, id) > 0.04)
    .sort(([a], [b]) =>
      movieAffinity({ tmdb_id: b, genres: [b], year: null }, profile)
      - movieAffinity({ tmdb_id: a, genres: [a], year: null }, profile) || a - b)
    .slice(0, 3)
    .map(([id]) => id)
}

function similarity(a: RecommendationMovie, b: RecommendationMovie): number {
  const left = uniqueGenres(a.genres)
  const right = uniqueGenres(b.genres)
  if (!left.length || !right.length) return 0
  const intersection = left.filter((id) => right.includes(id)).length
  return intersection / (left.length + right.length - intersection)
}

/** Deterministic ranking with catalogue prior, exploration and recent-genre diversity. */
export function rankRecommendations<T extends RecommendationMovie>(
  candidates: T[],
  profile: TasteProfile,
  options: { seed: string; offset?: number; recent?: RecommendationMovie[] },
): T[] {
  const ids = new Set<number>()
  const unique = candidates.filter((movie) => {
    if (!Number.isFinite(movie.tmdb_id) || ids.has(movie.tmdb_id)) return false
    ids.add(movie.tmdb_id)
    return true
  })
  if (profile.confidence === 0) return unique

  const pending = unique.map((movie, index) => ({
    movie,
    score: movieAffinity(movie, profile) * (0.35 + 0.65 * profile.confidence)
      + 0.015 * (1 - index / Math.max(1, unique.length)),
    noise: hash32(`${options.seed}:${movie.tmdb_id}`) / 0xffffffff,
  }))
  const ranked: T[] = []
  const recent = [...(options.recent ?? [])].slice(-3)
  while (pending.length > 0) {
    // One in five slots explores movies beyond the strongest taste match.
    const explore = ((options.offset ?? 0) + ranked.length + 1) % 5 === 0
    let bestIndex = 0
    let bestScore = -Infinity
    pending.forEach((entry, index) => {
      const repetition = recent.length > 0
        ? Math.max(...recent.map((movie) => similarity(entry.movie, movie))) : 0
      const novelty = uniqueGenres(entry.movie.genres).some(
        (id) => affinity(profile.genres, id) <= 0,
      ) ? 0.12 : 0
      const score = explore
        ? entry.noise + novelty - repetition * 0.08
        : entry.score - repetition * 0.06 + entry.noise * 0.015
      if (score > bestScore) { bestScore = score; bestIndex = index }
    })
    const [{ movie }] = pending.splice(bestIndex, 1)
    ranked.push(movie)
    recent.push(movie)
    if (recent.length > 3) recent.shift()
  }
  return ranked
}

export function updateFeedback(history: MovieFeedback[], next: MovieFeedback): MovieFeedback[] {
  return [next, ...history.filter((entry) =>
    entry.tmdb_id !== next.tmdb_id || entry.session_id !== next.session_id,
  )].slice(0, MAX_FEEDBACK)
}

/** Keeps the displayed card and the consumed prefix stable while learning. */
export function rerankUnseen<T extends RecommendationMovie>(
  queue: T[], displayedIndex: number, profile: TasteProfile, seed: string,
): T[] {
  const boundary = Math.min(queue.length, Math.max(0, displayedIndex + 1))
  return [...queue.slice(0, boundary), ...rankRecommendations(queue.slice(boundary), profile, {
    seed, offset: boundary, recent: queue.slice(Math.max(0, boundary - 3), boundary),
  })]
}
