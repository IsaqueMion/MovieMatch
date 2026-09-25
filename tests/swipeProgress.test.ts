import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearProgress,
  filtersSig,
  loadProgress,
  saveProgress,
} from '../src/lib/swipeProgress.ts'

class MemoryStorage {
  #items = new Map<string, string>()

  getItem(key: string) {
    return this.#items.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.#items.set(
      key,
      String(value),
    )
  }

  removeItem(key: string) {
    this.#items.delete(key)
  }

  clear() {
    this.#items.clear()
  }
}

Object.defineProperty(
  globalThis,
  'localStorage',
  {
    value: new MemoryStorage(),
    configurable: true,
  },
)

const baseFilters = {
  genres: [28, 12],
  excludeGenres: [27],
  providers: [8, 2],
  monetization: [
    'flatrate',
    'free',
  ],
  watchRegion: 'BR',
}

test.beforeEach(() => {
  localStorage.clear()
})

test('assinatura ignora a ordem de filtros que funcionam como conjuntos', () => {
  const first = filtersSig(
    baseFilters,
  )

  const second = filtersSig({
    ...baseFilters,
    genres: [12, 28],
    providers: [2, 8],
    monetization: [
      'free',
      'flatrate',
    ],
  })

  assert.equal(first, second)
})

test('assinatura muda quando um filtro relevante muda', () => {
  assert.notEqual(
    filtersSig(baseFilters),
    filtersSig({
      ...baseFilters,
      watchRegion: 'US',
    }),
  )
})

test('progresso é salvo com índice inteiro e restaurado', () => {
  saveProgress(
    'session-1',
    'user-1',
    baseFilters,
    4.9,
  )

  assert.equal(
    loadProgress(
      'session-1',
      'user-1',
      baseFilters,
    ),
    4,
  )
})

test('índice negativo é limitado a zero', () => {
  saveProgress(
    'session-1',
    'user-1',
    baseFilters,
    -10,
  )

  assert.equal(
    loadProgress(
      'session-1',
      'user-1',
      baseFilters,
    ),
    0,
  )
})

test('progresso fica isolado por assinatura de filtros', () => {
  saveProgress(
    'session-1',
    'user-1',
    baseFilters,
    7,
  )

  assert.equal(
    loadProgress(
      'session-1',
      'user-1',
      {
        ...baseFilters,
        watchRegion: 'US',
      },
    ),
    0,
  )
})

test('clearProgress remove a entrada selecionada', () => {
  saveProgress(
    'session-1',
    'user-1',
    baseFilters,
    3,
  )

  clearProgress(
    'session-1',
    'user-1',
    baseFilters,
  )

  assert.equal(
    loadProgress(
      'session-1',
      'user-1',
      baseFilters,
    ),
    0,
  )
})
