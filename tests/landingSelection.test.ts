import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLandingMovies, type LandingMovie } from '../src/lib/landingSelection.ts'

const movies: LandingMovie[] = Array.from({ length: 40 }, (_, index) => ({ id: index + 1, title: 'Filme ' + index, year: 2000 + index, poster: 'https://image.tmdb.org/t/p/w500/' + index + '.jpg' }))

test('sorteio preserva o catálogo e escolhe 19 filmes e pôsteres distintos', () => {
  const original = structuredClone(movies)
  const selected = selectLandingMovies(movies, undefined, () => 0.25)
  const all = [selected.featured, ...selected.posters]
  assert.equal(selected.posters.length, 18)
  assert.equal(new Set(all.map(movie => movie.id)).size, 19)
  assert.equal(new Set(all.map(movie => movie.poster)).size, 19)
  assert.deepEqual(movies, original)
  assert.ok(all.every(movie => movies.includes(movie)))
})

test('o filme de exemplo não repete a visita anterior mesmo com o mesmo sorteio', () => {
  const first = selectLandingMovies(movies, undefined, () => 0.25)
  const second = selectLandingMovies(movies, first.featured.id, () => 0.25)
  assert.notEqual(second.featured.id, first.featured.id)
  assert.equal(second.posters.some(movie => movie.id === second.featured.id), false)
})

test('IDs ou URLs de pôster duplicados na origem não entram duas vezes no sorteio', () => {
  const duplicateId = { ...movies[0], poster: 'https://image.tmdb.org/t/p/w500/duplicate.jpg' }
  const duplicatePoster = { ...movies[1], id: 999 }
  const selected = selectLandingMovies([...movies, duplicateId, duplicatePoster], undefined, () => 0.999)
  const all = [selected.featured, ...selected.posters]
  assert.equal(new Set(all.map(movie => movie.id)).size, 19)
  assert.equal(new Set(all.map(movie => movie.poster)).size, 19)
})
