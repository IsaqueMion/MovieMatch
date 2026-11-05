import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTasteProfile, movieAffinity, preferredGenreIds, rankRecommendations,
  rerankUnseen, updateFeedback, type MovieFeedback, type RecommendationMovie,
} from '../src/lib/recommendations.ts'

const now = Date.parse('2026-09-30T12:00:00Z')
const seed = 'session:user'
const scienceFiction = { tmdb_id: 100, genres: [878], year: 2014 }
const comedy = { tmdb_id: 200, genres: [35], year: 2014 }
function feedback(id: number, genre = 878, value: 1 | -1 = 1, age = 0): MovieFeedback {
  return { tmdb_id: id, genres: [genre], year: 2014, value,
    session_id: 'session', updated_at: new Date(now - age * 86_400_000).toISOString() }
}

test('cold start preserves the catalogue, removes duplicates and does not filter unknown genres', () => {
  const unknown = { tmdb_id: 300, genres: [], year: null }
  assert.deepEqual(rankRecommendations([comedy, unknown, scienceFiction, comedy],
    buildTasteProfile([], now), { seed }), [comedy, unknown, scienceFiction])
})

test('likes promote similar films; dislikes reduce their affinity', () => {
  const likes = Array.from({ length: 8 }, (_, i) => feedback(i))
  const profile = buildTasteProfile(likes, now)
  assert.equal(rankRecommendations([comedy, scienceFiction], profile, { seed })[0], scienceFiction)
  const rejected = buildTasteProfile(likes.map((entry) => ({ ...entry, value: -1 as const })), now)
  assert.ok(movieAffinity(scienceFiction, rejected) < movieAffinity(comedy, rejected))
  assert.deepEqual(preferredGenreIds(rejected), [])
})

test('an isolated like gives conservative confidence; genre-less legacy votes do not train genres', () => {
  assert.ok(buildTasteProfile([feedback(1)], now).confidence < 0.2)
  const firstLike = buildTasteProfile([feedback(1)], now)
  assert.deepEqual(preferredGenreIds(firstLike), [878])
  assert.equal(rankRecommendations([comedy, scienceFiction], firstLike, { seed })[0], scienceFiction)
  const legacy = buildTasteProfile([{ ...feedback(1), genres: [] }], now)
  assert.equal(legacy.confidence, 0)
  assert.deepEqual(preferredGenreIds(legacy), [])
})

test('recent choices shift the ranking even after a long earlier taste history', () => {
  const old = Array.from({ length: 30 }, (_, i) => feedback(i, 35, 1, 45))
  const newChoices = Array.from({ length: 8 }, (_, i) => feedback(100 + i, 878))
  const profile = buildTasteProfile([...old, ...newChoices], now)
  assert.equal(rankRecommendations([comedy, scienceFiction], profile, { seed })[0], scienceFiction)
  assert.equal(preferredGenreIds(profile)[0], 878)
})

test('recent taste outweighs old votes and invalid timestamps cannot corrupt scores', () => {
  const profile = buildTasteProfile([
    ...Array.from({ length: 6 }, (_, i) => feedback(i, 878, 1, 360)),
    ...Array.from({ length: 6 }, (_, i) => feedback(20 + i, 35)),
    { ...feedback(99), updated_at: 'invalid' },
  ], now)
  assert.ok(movieAffinity(comedy, profile) > movieAffinity(scienceFiction, profile))
  assert.equal(profile.feedbackCount, 12)
})

test('repeated votes across sessions count once and the latest decision wins', () => {
  const old = feedback(1, 878, 1, 30)
  const corrected = { ...feedback(1, 878, -1), session_id: 'another-session' }
  const a = buildTasteProfile([old, corrected], now)
  const b = buildTasteProfile([corrected, old], now)
  assert.equal(a.feedbackCount, 1)
  assert.equal(movieAffinity(scienceFiction, a), movieAffinity(scienceFiction, b))
  assert.ok(movieAffinity(scienceFiction, a) < 0)
})

test('profile updates replace retries and undo restores a previous-session choice', () => {
  const previous = { ...feedback(1, 878, 1, 30), session_id: 'previous' }
  const next = feedback(1, 878, -1)
  const history = updateFeedback(updateFeedback([previous], next), next)
  assert.equal(history.length, 2)
  const undone = history.filter((entry) => entry.session_id !== 'session')
  assert.ok(movieAffinity(scienceFiction, buildTasteProfile(undone, now)) > 0)
})

test('ranking is deterministic and exploration can surface unfamiliar genres', () => {
  const profile = buildTasteProfile(Array.from({ length: 12 }, (_, i) => feedback(i)), now)
  const catalogue = Array.from({ length: 24 }, (_, i) => ({
    tmdb_id: 1000 + i, genres: [i < 12 ? 878 : 35], year: 2014,
  }))
  const ranked = rankRecommendations(catalogue, profile, { seed })
  assert.deepEqual(rankRecommendations(catalogue, profile, { seed }), ranked)
  assert.deepEqual(new Set(ranked.map((movie) => movie.tmdb_id)), new Set(catalogue.map((movie) => movie.tmdb_id)))
  assert.ok(ranked.filter((_, i) => (i + 1) % 5 === 0).some((movie) => movie.genres[0] === 35))
})

test('learning preserves the consumed prefix and displayed card while improving the tail', () => {
  const displayed = { ...comedy, tmdb_id: 201 }
  const queue = [comedy, displayed, { ...comedy, tmdb_id: 202 }, scienceFiction]
  const profile = buildTasteProfile(Array.from({ length: 10 }, (_, i) => feedback(i)), now)
  const ranked = rerankUnseen(queue, 1, profile, seed)
  assert.deepEqual(ranked.slice(0, 2), queue.slice(0, 2))
  assert.equal(ranked[2], scienceFiction)
  assert.deepEqual(queue.map((movie) => movie.tmdb_id), [200, 201, 202, 100])
})

test('duplicate metadata does not multiply genre weight and preferred genres need positive evidence', () => {
  const once = buildTasteProfile([feedback(1)], now)
  const duplicated = buildTasteProfile([{ ...feedback(1), genres: [878, 878, 0, -1] }], now)
  assert.equal(movieAffinity(scienceFiction, once), movieAffinity(scienceFiction, duplicated))
  assert.deepEqual(preferredGenreIds(buildTasteProfile(Array.from({ length: 5 }, (_, i) => feedback(i)), now)), [878])
})

test('movies without genre metadata remain rankable', () => {
  const sparse = { tmdb_id: 300, year: 2014 } as RecommendationMovie
  const profile = buildTasteProfile([feedback(1)], now)
  assert.deepEqual(rankRecommendations([sparse], profile, { seed }), [sparse])
})
