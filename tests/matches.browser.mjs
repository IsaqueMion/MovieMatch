import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:4180'
const matchUrl = new URL(baseUrl)
matchUrl.pathname = '/s/DEMO01/matches'
const catalogue = JSON.parse(await readFile(new URL('../src/data/landingMovies.json', import.meta.url)))
const titles = ['Interestelar', 'O Fabuloso Destino de Amélie Poulain', 'A Chegada', 'La La Land: Cantando Estações', 'A Viagem de Chihiro']
const ids = [157336, 194, 329865, 313369, 129]
const years = [2014, 2001, 2016, 2016, 2001]
const posters = ['/demo/interstellar.jpg', '/demo/amelie.jpg', '/demo/arrival.jpg', '/demo/la-la-land.jpg', '/demo/spirited-away.jpg']
const movies = titles.map((title, index) => {
  const film = catalogue.movies.find(film => film.id === ids[index])
  return { movie_id: index + 1, tmdb_id: ids[index], title, year: years[index], poster_url: film?.poster || posters[index], likes: 3, member_count: 3, latest_at: new Date(Date.UTC(2026, 8, 30 - index)).toISOString() }
})
let browser
let server
before(async () => {
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { stdio: 'ignore', windowsHide: true })
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(baseUrl)).ok) break } catch { /* Wait for preview. */ }
      await delay(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) })
})
after(async () => { await browser?.close(); server?.kill() })

async function fixture({ width = 1440, empty = false, invalid = false, listFailure = false, detailsFailure = false, liveImages = false, missingPoster = false } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: width < 640 ? 844 : 1000 } })
  const uid = '11111111-1111-4111-8111-111111111111'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {} }
  const token = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture'
  const state = { listFailure, requests: [], movies: empty ? [] : structuredClone(movies), detailsCalls: 0 }
  if (missingPoster) state.movies[0].poster_url = null
  await ctx.addInitScript(() => {
    window.copiedMatchList = ''
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedMatchList = text } } })
  })
  // All Supabase requests are intercepted; these tests create no live users or sessions.
  await ctx.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    state.requests.push(path)
    let result = []
    if (path.includes('/auth/v1/')) result = path.endsWith('/user') ? user : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture', user }
    else if (path.includes('/rpc/join_session')) {
      if (invalid) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"P0002","message":"Expired"}' })
      result = [{ id: '22222222-2222-4222-8222-222222222222', code: 'DEMO01' }]
    } else if (path.includes('/rpc/list_session_matches')) {
      if (state.listFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' })
      result = state.movies
    } else if (path.includes('/rpc/touch_session_presence')) result = 2
    else if (path.includes('/rest/v1/session_filters')) result = { watch_region: 'BR' }
    else if (path.includes('/functions/v1/movie_details')) {
      state.detailsCalls++
      await delay(100)
      if (detailsFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' })
      result = { ...movies[0], runtime: 169, vote_average: 8.6, genres: [{ id: 878, name: 'Ficção científica' }], age_rating: '12', overview: 'Uma equipe de exploradores viaja além desta galáxia para descobrir se a humanidade tem um futuro entre as estrelas.', trailer: { key: 'fixture' }, providers: [{ id: 8, name: 'Netflix', logo_url: '/providers/generic.svg', url: 'https://www.netflix.com/title/fixture' }] }
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await ctx.route(/googlesyndication|fundingchoicesmessages/, route => route.abort())
  await ctx.route(/youtube\.com\/embed/, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Trailer de teste</title><button>Reproduzir</button>' }))
  if (!liveImages) await ctx.route(/https:\/\/image\.tmdb\.org\//, async route => {
    const movie = catalogue.movies.find(movie => new URL(movie.poster).pathname.split('/').pop() === new URL(route.request().url()).pathname.split('/').pop())
    const thumbnail = movie?.preview?.split(',')[1]
    if (thumbnail) return route.fulfill({ contentType: 'image/jpeg', body: Buffer.from(thumbnail, 'base64') })
    return route.abort()
  })
  const page = await ctx.newPage()
  await page.routeWebSocket(/supabase\.co/, socket => socket.close())
  await page.goto(matchUrl.href)
  await page.locator('.matches-selection[aria-busy="false"]').waitFor()
  return { ctx, page, state }
}

for (const width of [390, 768, 1440]) {
  test(`matches em ${width}px: identidade, consenso, pôsteres e detalhes acessíveis`, async () => {
    const { ctx, page, state } = await fixture({ width, liveImages: !!process.env.MATCHES_LIVE_IMAGES })
    try {
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.equal(await page.locator('.matches-spotlight h3').innerText(), 'Interestelar')
      assert.match(await page.locator('.matches-consensus').innerText(), /3 de 3 participantes/)
      assert.equal(await page.locator('.matches-film-card').count(), 4)
      const poster = page.locator('.matches-spotlight .matches-poster')
      const ratio = await poster.evaluate(element => element.getBoundingClientRect().width / element.getBoundingClientRect().height)
      assert.ok(Math.abs(ratio - 2 / 3) < .01)
      await page.waitForFunction(() => document.querySelector('.matches-spotlight .cinema-poster')?.classList.contains('is-ready'))
      if (process.env.VISUAL_CAPTURE_DIR) {
        await page.locator('.matches-film-card').last().scrollIntoViewIfNeeded()
        await page.waitForFunction(() => [...document.querySelectorAll('.matches-poster .cinema-poster')].every(element => element.classList.contains('is-ready')))
        await page.evaluate(() => window.scrollTo(0, 0))
        await delay(300)
        await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/matches-${width}.png`, fullPage: true })
      }
      await page.getByRole('button', { name: 'Explorar o filme' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await page.getByRole('link', { name: 'Netflix' }).waitFor()
      assert.equal(await page.getByRole('link', { name: 'Netflix' }).getAttribute('href'), 'https://www.netflix.com/title/fixture')
      assert.equal(await page.getByTitle('Trailer de Interestelar').count(), 1)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press('Tab')
        assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, `Passo ${index}: ` + await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200)))
      }
      assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false)
      if (process.env.VISUAL_CAPTURE_DIR) {
        await dialog.evaluate(element => { element.scrollTop = 0 })
        await delay(300)
        await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/matches-details-${width}.png` })
      }
      await page.keyboard.press('Escape')
      assert.equal(await dialog.count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Explorar o filme' }).evaluate(element => element === document.activeElement), true)
      assert.equal(state.detailsCalls, 1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const open = page.locator('.matches-spotlight-poster')
      await open.hover()
      assert.equal(await open.locator('.matches-poster-open').evaluate(element => getComputedStyle(element).transform), 'none')
    } finally { await ctx.close() }
  })
}

test('busca, ordenação, cópia e retorno à votação', async () => {
  const { ctx, page } = await fixture()
  try {
    await page.getByLabel('Ordenar filmes').selectOption('oldest')
    assert.equal(await page.locator('.matches-spotlight h3').innerText(), 'A Viagem de Chihiro')
    assert.deepEqual(await page.locator('.matches-film-card h4').allTextContents(), [...movies].reverse().slice(1).map(movie => movie.title))
    await page.getByLabel('Ordenar filmes').selectOption('title')
    assert.equal(await page.locator('.matches-spotlight h3').innerText(), 'A Chegada')
    await page.getByLabel('Buscar filme').fill('amélie')
    assert.match(await page.locator('.matches-spotlight h3').innerText(), /Amélie/)
    await page.getByRole('button', { name: 'Copiar lista' }).click()
    assert.match(await page.locator('.matches-copy-status').innerText(), /Lista copiada/)
    assert.equal(await page.evaluate(() => window.copiedMatchList), `${movies[1].title} (${movies[1].year}) — 3/3 curtiram`)
    await page.getByLabel('Buscar filme').fill('não existe')
    assert.match(await page.locator('.matches-empty h3').innerText(), /não está na seleção/)
    await page.getByRole('button', { name: 'Limpar busca' }).click()
    assert.equal(await page.locator('.matches-film-card').count(), 4)
    await page.getByRole('button', { name: 'Voltar a votar' }).click()
    await page.waitForURL('**/s/DEMO01')
  } finally { await ctx.close() }
})

test('vazio, sessão expirada e falha de consulta têm mensagens distintas e recuperação', async () => {
  for (const [option, message] of [['empty', 'Ainda não deu match.'], ['invalid', 'Sessão indisponível'], ['listFailure', 'Não foi possível atualizar']]) {
    const { ctx, page, state } = await fixture({ [option]: true, width: 390 })
    try {
      assert.match(await page.locator('.matches-selection').innerText(), new RegExp(message))
      assert.equal(await page.locator('.matches-spotlight').count(), 0)
      if (option === 'listFailure') {
        state.listFailure = false
        await page.getByRole('button', { name: 'Tentar novamente' }).click()
        await page.locator('.matches-spotlight').waitFor()
      }
      if (option === 'empty' && process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/matches-empty-390.png', fullPage: true })
    } finally { await ctx.close() }
  }
})

test('falha nos detalhes não reabre painel fechado; pôster ausente tem alternativa', async () => {
  const { ctx, page } = await fixture({ detailsFailure: true, missingPoster: true })
  try {
    assert.match(await page.locator('.matches-spotlight .matches-no-poster').innerText(), /Interestelar/)
    await page.getByRole('button', { name: 'Explorar o filme' }).click()
    await page.getByRole('button', { name: 'Fechar detalhes' }).click()
    await delay(2200)
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.getByRole('button', { name: 'Explorar o filme' }).click()
    await page.getByText('Nenhuma plataforma informada para esta região.').waitFor()
    assert.equal(await page.getByRole('link', { name: 'Buscar onde assistir' }).count(), 1)
    await page.keyboard.press('Escape')
  } finally { await ctx.close() }
})

test('atualização de participantes remove filmes que deixaram de ter consenso', async () => {
  const { ctx, page, state } = await fixture()
  try {
    state.movies = []
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.getByText('Ainda não deu match.').waitFor()
    assert.equal(await page.locator('.matches-film-card').count(), 0)
    assert.equal(await page.locator('.matches-total > span').innerText(), '00')
  } finally { await ctx.close() }
})
