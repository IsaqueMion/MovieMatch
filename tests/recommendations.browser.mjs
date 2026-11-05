import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179'
let server
let browser
before(async () => {
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, [fileURLToPath(new URL('./bin/vite.js', import.meta.resolve('vite/package.json'))),
      'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { stdio: 'ignore', windowsHide: true })
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(baseUrl)).ok) break } catch { /* Wait for preview. */ }
      await delay(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) })
})
after(async () => { await browser?.close(); server?.kill() })

async function fixture({ failure = false, manualSort = false, personalFailure = false, legacy = false } = {}) {
  const ctx = await browser.newContext({ locale: 'pt-BR', serviceWorkers: 'block', reducedMotion: 'reduce' })
  await ctx.addInitScript(() => localStorage.setItem('mm:swipe-tutorial:v1:22222222-2222-4222-8222-222222222222', '1'))
  const uid = '11111111-1111-4111-8111-111111111111'
  const sid = '22222222-2222-4222-8222-222222222222'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {} }
  const token = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.'
    + Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture'
  const movies = [
    { movie_id: 200, tmdb_id: 200, title: 'Comédia do catálogo', genres: [35], year: 2014, poster_url: '/demo/amelie.jpg' },
    { movie_id: 100, tmdb_id: 100, title: 'Ficção recomendada', genres: [878], year: 2014, poster_url: '/demo/interstellar.jpg' },
    { movie_id: 101, tmdb_id: 101, title: 'Outra ficção', genres: [878], year: 2014, poster_url: '/demo/interstellar.jpg' },
  ]
  const state = { votes: [], undos: [], discoveries: [], historyLoads: 0, detailLoads: [] }
  await ctx.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const body = req.postData() ? req.postDataJSON() : null
    let result = []
    if (path.includes('/auth/v1/')) result = path.endsWith('/user') ? user : {
      access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture', user,
    }
    else if (path.includes('/rpc/join_session')) result = [{ id: sid, code: 'DEMO01' }]
    else if (path.includes('/rpc/touch_session_presence')) result = 2
    else if (path.includes('/rest/v1/users')) result = { id: uid, is_adult: false, is_premium: true }
    else if (path.includes('/rest/v1/session_filters')) result = {
      genres: [], exclude_genres: [27], providers: [8], watch_region: 'BR',
      monetization: ['flatrate'], sort_by: manualSort ? 'vote_average.desc' : 'popularity.desc',
    }
    else if (path.includes('/rpc/list_my_recommendation_feedback')) {
      state.historyLoads++
      result = Array.from({ length: 12 }, (_, i) => ({
        session_id: 'previous-session', tmdb_id: 1000 + i, year: 2014, value: 1,
        genre_ids: legacy ? [] : [878], updated_at: new Date().toISOString(),
      }))
    } else if (path.includes('/functions/v1/discover')) {
      state.discoveries.push(body)
      if (personalFailure && body.filters.genres.length) return route.fulfill({
        status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}',
      })
      result = { total_pages: 1, results: body.filters.genres.length ? [movies[1]] : movies }
    } else if (path.includes('/functions/v1/movie_details')) {
      const movieId = Number(new URL(req.url()).searchParams.get('tmdb_id'))
      state.detailLoads.push(movieId)
      const movie = movies.find((entry) => entry.tmdb_id === movieId) ??
        { tmdb_id: movieId, genres: [878], year: 2014 }
      result = { ...movie, runtime: 100, vote_average: 8, overview: 'Filme de teste.', trailer: null,
        age_rating: '12', genres: movie.genres.map((id) => ({ id, name: 'Gênero' })), providers: {} }
    } else if (path.includes('/rest/v1/movies')) {
      const tmdb = body?.tmdb_id ?? Number(new URL(req.url()).searchParams.get('tmdb_id')?.replace('eq.', ''))
      result = { id: tmdb }
    } else if (path.includes('/rpc/record_movie_reaction')) {
      state.votes.push(body)
      if (failure) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"42501","message":"Vote rejected"}' })
      result = null
    } else if (path.includes('/rpc/undo_movie_reaction')) { state.undos.push(body); result = null }
    else if (path.includes('/rpc/check_session_match')) result = [{ is_match: false, member_count: 2, like_count: 1 }]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await ctx.route(/googlesyndication|fundingchoicesmessages/, (route) => route.abort())
  const page = await ctx.newPage()
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close())
  await page.goto(baseUrl + '/s/DEMO01')
  await page.waitForFunction(() => document.querySelector('.cinema-vote-button.is-like')?.disabled === false)
  await page.locator('h3.line-clamp-1').waitFor()
  return { ctx, page, state, sid }
}

test('personal history ranks movies, preserves shared filters, commits genres and supports undo/reload', async () => {
  const { ctx, page, state, sid } = await fixture()
  try {
    const title = await page.locator('h3.line-clamp-1').innerText()
    assert.match(title, /ficção/i)
    assert.equal(state.discoveries.length, 2)
    assert.deepEqual(state.discoveries[0].filters.genres, [])
    assert.deepEqual(state.discoveries[1].filters.genres, [878])
    assert.deepEqual(state.discoveries[1].filters.excludeGenres, [27])
    assert.deepEqual(state.discoveries[1].filters.providers, [8])
    assert.equal(state.discoveries[1].filters.includeAdult, false)
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.cinema-vote-button.is-undo')?.disabled === false)
    assert.equal(state.votes.length, 1)
    assert.equal(state.votes[0].p_session_id, sid)
    assert.equal(state.votes[0].p_value, 1)
    assert.deepEqual(state.votes[0].p_genre_ids, [878])
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.cinema-vote-button.is-undo')?.disabled === true)
    await page.waitForFunction((expected) => document.querySelector('h3.line-clamp-1')?.innerText === expected, title)
    assert.equal(state.undos[0].p_movie_id, state.votes[0].p_movie_id)
    await page.reload()
    await page.locator('h3.line-clamp-1').waitFor()
    assert.match(await page.locator('h3.line-clamp-1').innerText(), /ficção/i)
    assert.equal(state.historyLoads, 2)
  } finally { await ctx.close() }
})

test('failed votes leave the displayed movie and undo unavailable', async () => {
  const { ctx, page, state } = await fixture({ failure: true })
  try {
    const title = await page.locator('h3.line-clamp-1').innerText()
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
    await page.getByText('Erro ao salvar reação: Vote rejected').waitFor()
    assert.equal(state.votes.length, 1)
    assert.equal(await page.getByRole('button', { name: 'Desfazer', exact: true }).isDisabled(), true)
    assert.equal(await page.locator('h3.line-clamp-1').innerText(), title)
  } finally { await ctx.close() }
})

test('explicit sort order takes priority over personalization', async () => {
  const { ctx, page, state } = await fixture({ manualSort: true })
  try {
    assert.match(await page.locator('h3.line-clamp-1').innerText(), /^Comédia do catálogo/)
    assert.equal(state.discoveries.length, 1)
  } finally { await ctx.close() }
})

test('failed personal discovery still serves the shared catalogue', async () => {
  const { ctx, page } = await fixture({ personalFailure: true })
  try { assert.match(await page.locator('h3.line-clamp-1').innerText(), /ficção/i) }
  finally { await ctx.close() }
})

test('older votes gain a bounded genre sample before recommendations load', async () => {
  const { ctx, page, state } = await fixture({ legacy: true })
  try {
    assert.match(await page.locator('h3.line-clamp-1').innerText(), /ficção/i)
    assert.equal(state.detailLoads.filter((id) => id >= 1000).length, 6)
    assert.equal(state.discoveries.length, 2)
  } finally { await ctx.close() }
})
