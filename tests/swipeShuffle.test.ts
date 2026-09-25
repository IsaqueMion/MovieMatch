import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hash32,
  shuffleWithinWindows,
} from '../src/lib/swipeShuffle.ts'

test('hash32 é determinístico', () => {
  assert.equal(
    hash32('movie-match'),
    hash32('movie-match'),
  )

  assert.notEqual(
    hash32('movie-match'),
    hash32('movie-match-2'),
  )
})

test('shuffle mantém os mesmos filmes e é determinístico', () => {
  const items = Array.from(
    { length: 24 },
    (_, index) => ({
      tmdb_id: index + 1,
    }),
  )

  const first = shuffleWithinWindows(
    items,
    'session:user',
    6,
  )

  const second = shuffleWithinWindows(
    items,
    'session:user',
    6,
  )

  assert.deepEqual(first, second)

  assert.deepEqual(
    first
      .map((item) => item.tmdb_id)
      .sort((a, b) => a - b),
    items.map((item) => item.tmdb_id),
  )
})

test('shuffle não move filmes para outra janela', () => {
  const items = Array.from(
    { length: 18 },
    (_, index) => ({
      tmdb_id: index + 1,
    }),
  )

  const shuffled = shuffleWithinWindows(
    items,
    'seed',
    6,
  )

  for (
    let start = 0;
    start < items.length;
    start += 6
  ) {
    const expected = new Set(
      items
        .slice(start, start + 6)
        .map((item) => item.tmdb_id),
    )

    const actual = new Set(
      shuffled
        .slice(start, start + 6)
        .map((item) => item.tmdb_id),
    )

    assert.deepEqual(actual, expected)
  }
})
