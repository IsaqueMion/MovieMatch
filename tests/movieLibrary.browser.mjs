import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:4181'
const url = path => { const value = new URL(baseUrl); value.pathname = path; return value.href }
const owner = '11111111-1111-4111-8111-111111111111'
const peer = '11111111-1111-4111-8111-222222222222'
const movies = [
  { movie_id: 1, id: 1, tmdb_id: 157336, title: 'Interestelar', year: 2014, poster_url: '/demo/interstellar.jpg', likes: 2, member_count: 2, latest_at: '2026-10-01T10:00:00Z' },
  { movie_id: 2, id: 2, tmdb_id: 194, title: 'O Fabuloso Destino de Amélie Poulain', year: 2001, poster_url: '/demo/amelie.jpg', likes: 2, member_count: 2, latest_at: '2026-09-30T10:00:00Z' },
]
const shared = () => ({ watches: [], reviews: [], counter: 0, failWatch: false, failReview: false, failList: false })
const watch = (state, uid = owner, movie = movies[0]) => {
  const row = { ...movie, id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(++state.counter).padStart(12, '0')}`, user_id: uid, watched_at: '2026-10-01T12:00:00Z' }
  state.watches.push(row)
  return row
}
let browser, server
before(async () => {
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', '4181', '--strictPort'], { stdio: 'ignore', windowsHide: true })
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(baseUrl)).ok) break } catch { /* Wait for preview. */ }
      await delay(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) })
})
after(async () => { await browser?.close(); server?.kill() })

async function fixture({ state = shared(), uid = owner, width = 1440, path = '/s/DEMO01/matches' } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: width < 640 ? 844 : 1000 } })
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {} }
  const token = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture'
  const requests = [], reactions = [], errors = []
  await ctx.addInitScript(() => localStorage.setItem('mm:swipe-tutorial:v1:22222222-2222-4222-8222-222222222222', '1'))
  // All APIs are intercepted. Database ownership is tested separately with transactional SQL.
  await ctx.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const req = route.request(), endpoint = new URL(req.url()), pathname = endpoint.pathname
    const body = req.postData() ? req.postDataJSON() : null
    requests.push({ path: pathname, method: req.method(), body })
    const fail = (status = 503, code = 'fixture') => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message: 'Fixture failure' }) })
    let result = [], headers = {}
    if (pathname.includes('/auth/v1/')) result = pathname.endsWith('/user') ? user : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture', user }
    else if (pathname.includes('/rpc/join_session')) result = [{ id: '22222222-2222-4222-8222-222222222222', code: 'DEMO01' }]
    else if (pathname.includes('/rpc/list_session_matches')) result = movies
    else if (pathname.includes('/rpc/touch_session_presence')) result = 2
    else if (/\/rpc\/(record_movie_reaction|undo_movie_reaction|list_my_recommendation_feedback)$/.test(pathname)) return fail(404, 'PGRST202')
    else if (pathname.includes('/rpc/check_session_match')) result = [{ is_match: false, member_count: 2, like_count: 1 }]
    else if (pathname.includes('/rpc/movie_review_summary')) {
      const all = state.reviews.filter(row => row.tmdb_id === body.p_tmdb_id)
      result = [{ average_rating: all.length ? Number((all.reduce((sum, row) => sum + row.rating, 0) / all.length).toFixed(1)) : null, review_count: all.length }]
    } else if (pathname.includes('/rest/v1/watched_movies')) {
      if (req.method() === 'POST') {
        if (state.failWatch) return fail()
        if (state.watches.some(row => row.user_id === uid && row.tmdb_id === body.tmdb_id)) return fail(409, '23505')
        result = watch(state, uid, body)
      } else if (req.method() === 'DELETE') {
        const id = endpoint.searchParams.get('id')?.slice(3)
        const own = state.watches.find(row => row.id === id && row.user_id === uid)
        if (!own) return fail(404)
        state.watches = state.watches.filter(row => row.id !== id)
        state.reviews = state.reviews.filter(row => row.id !== id)
        result = { id }
      } else {
        if (state.failList) return fail()
        result = state.watches.filter(row => row.user_id === uid)
        const tmdb = endpoint.searchParams.get('tmdb_id')
        if (tmdb) result = result.filter(row => row.tmdb_id === Number(tmdb.slice(3)))
        const offset = Number(endpoint.searchParams.get('offset') || 0), limit = Number(endpoint.searchParams.get('limit') || 500)
        result = result.slice(offset, offset + limit)
      }
    } else if (pathname.includes('/rest/v1/movie_reviews')) {
      if (req.method() === 'POST' || req.method() === 'PATCH') {
        if (state.failReview) return fail()
        const id = body.id || endpoint.searchParams.get('id')?.slice(3)
        if (!state.watches.some(row => row.id === id && row.user_id === uid)) return fail(403)
        const previous = state.reviews.find(row => row.id === id)
        result = { ...previous, ...body, id, created_at: previous?.created_at || '2026-10-01T12:01:00Z', updated_at: '2026-10-01T12:02:00Z' }
        state.reviews = [...state.reviews.filter(row => row.id !== id), result]
      } else if (req.method() === 'DELETE') {
        const id = endpoint.searchParams.get('id')?.slice(3)
        if (!state.watches.some(row => row.id === id && row.user_id === uid)) return fail(403)
        state.reviews = state.reviews.filter(row => row.id !== id)
        result = { id }
      } else {
        if (state.failReviewRead) return fail()
        result = [...state.reviews]
        const tmdb = endpoint.searchParams.get('tmdb_id'), id = endpoint.searchParams.get('id')
        if (tmdb) result = result.filter(row => row.tmdb_id === Number(tmdb.slice(3)))
        if (id?.startsWith('eq.')) result = result.filter(row => row.id === id.slice(3))
        if (id?.startsWith('in.')) result = result.filter(row => id.slice(4, -1).split(',').includes(row.id))
        const total = result.length, offset = Number(endpoint.searchParams.get('offset') || 0), limit = Number(endpoint.searchParams.get('limit') || 1000)
        result = result.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(offset, offset + limit)
        headers = { 'Content-Range': `${offset}-${offset + Math.max(0, result.length - 1)}/${total}` }
      }
    } else if (pathname.includes('/rest/v1/session_filters')) result = null
    else if (pathname.includes('/rest/v1/users')) result = { id: uid, is_adult: false, is_premium: false }
    else if (pathname.includes('/rest/v1/movies')) result = movies[0]
    else if (pathname.includes('/rest/v1/reactions') && req.method() === 'POST') { reactions.push(body); result = null }
    else if (pathname.includes('/functions/v1/discover')) result = { page: 1, total_pages: 1, results: [movies[0]] }
    else if (pathname.includes('/functions/v1/movie_details')) result = { ...movies[0], vote_average: 8.6, runtime: 169, overview: 'Sinopse de teste.', trailer: null, age_rating: '12', genres: [{ id: 878, name: 'Ficção científica' }], providers: {} }
    if (req.method() === 'GET' && req.headers().accept?.includes('vnd.pgrst.object') && Array.isArray(result)) result = result[0] || null
    return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(result) })
  })
  await ctx.route(/googlesyndication|fundingchoicesmessages/, route => route.abort())
  const page = await ctx.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.routeWebSocket(/supabase\.co/, socket => socket.close())
  await page.goto(url(path))
  await page.locator(path.includes('/matches') ? '.matches-selection[aria-busy="false"]' : path.includes('assistidos') ? '.library-selection[aria-busy="false"]' : '.swipe-film').waitFor()
  return { ctx, page, state, requests, reactions, errors }
}

test('assistidos pessoais não registram um visitante sem ação e não criam chamadas ao backend', async () => {
  const { ctx, page, requests, errors } = await fixture({ path: '/assistidos', width: 390 })
  try {
    assert.match(await page.locator('.library-empty').innerText(), /O primeiro play/)
    assert.equal(requests.length, 0)
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})

test('marcar, avaliar e desmarcar altera apenas os meus matches; nota e comentário são públicos', async () => {
  const state = shared(), a = await fixture({ state }), b = await fixture({ state, uid: peer })
  try {
    await a.page.getByRole('button', { name: 'Explorar o filme' }).click()
    await a.page.getByRole('button', { name: 'Já assisti', exact: true }).click()
    await a.page.getByRole('dialog', { name: /O que ficou/ }).waitFor()
    await a.page.getByRole('radio', { name: '4 de 5 estrelas' }).click()
    await a.page.getByLabel('Apelido público').fill('Luna')
    await a.page.getByLabel('Seu comentário').fill('O final merece outra sessão. <b>Sem HTML</b>')
    await a.page.getByLabel('Meu comentário contém spoilers').check()
    await a.page.getByRole('button', { name: 'Salvar avaliação' }).click()
    await a.page.getByText('Sua avaliação foi publicada.', { exact: true }).waitFor()
    assert.equal(state.watches.length, 1)
    assert.equal(state.reviews.length, 1)
    assert.equal(state.reviews[0].rating, 4)
    await a.page.getByRole('button', { name: 'Fechar avaliações' }).click()
    assert.equal(await a.page.locator('.matches-film-card').count(), 1)
    await b.page.reload()
    await b.page.locator('.matches-selection[aria-busy="false"]').waitFor()
    assert.equal(await b.page.locator('.matches-film-card').count(), 2)
    await b.page.getByRole('button', { name: 'Explorar o filme' }).click()
    await b.page.getByRole('button', { name: 'Ver avaliações', exact: true }).click()
    await b.page.locator('.library-public-review').waitFor()
    assert.match(await b.page.locator('.library-review-average').innerText(), /4\.0[\s\S]*1 avaliação/)
    assert.equal(await b.page.locator('.library-public-review p').count(), 0)
    await b.page.getByRole('button', { name: 'Mostrar comentário com spoilers' }).click()
    assert.match(await b.page.locator('.library-public-review p').innerText(), /<b>Sem HTML<\/b>/)
    assert.equal(await b.page.locator('.library-public-review b').count(), 0)
    assert.equal(await b.page.getByRole('button', { name: 'Excluir minha avaliação' }).count(), 0)
    await a.page.getByRole('link', { name: /Meus assistidos/ }).click()
    await a.page.locator('.library-movie-card').waitFor()
    assert.equal(await a.page.locator('.library-own-rating').innerText(), 'Sua nota: 4/5')
    await a.page.getByRole('button', { name: 'Editar avaliação' }).click()
    await a.page.getByRole('radio', { name: '5 de 5 estrelas' }).click()
    await a.page.getByRole('button', { name: 'Salvar avaliação' }).click()
    await a.page.getByText('Sua avaliação foi publicada.', { exact: true }).waitFor()
    assert.equal(state.reviews.length, 1)
    assert.equal(state.reviews[0].rating, 5)
    await a.page.getByRole('button', { name: 'Fechar avaliações' }).click()
    a.page.once('dialog', dialog => dialog.accept())
    await a.page.getByRole('button', { name: 'Desmarcar assistido' }).click()
    await a.page.locator('.library-empty').waitFor()
    assert.equal(state.watches.length, 0)
    assert.equal(state.reviews.length, 0)
    await a.page.getByRole('button', { name: 'Voltar aos matches' }).click()
    await a.page.locator('.matches-selection[aria-busy="false"]').waitFor()
    assert.equal(await a.page.locator('.matches-film-card').count(), 2)
    assert.deepEqual(a.errors, [])
    assert.deepEqual(b.errors, [])
  } finally { await a.ctx.close(); await b.ctx.close() }
})

test('falhas preservam matches e comentário; avaliar é opcional e excluir avaliação mantém assistido', async () => {
  const state = shared(), { ctx, page } = await fixture({ state })
  try {
    state.failWatch = true
    await page.getByRole('button', { name: 'Explorar o filme' }).click()
    await page.getByRole('button', { name: 'Já assisti', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(state.watches.length, 0)
    assert.equal(await page.locator('.matches-film-card').count(), 2)
    state.failWatch = false
    await page.getByRole('button', { name: 'Já assisti', exact: true }).click()
    await page.getByRole('radio', { name: '1 de 5 estrelas' }).waitFor()
    await page.getByRole('button', { name: 'Fechar avaliações' }).click()
    await page.getByRole('link', { name: /Meus assistidos/ }).click()
    await page.getByText('Você ainda não avaliou', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Avaliar filme' }).click()
    await page.getByRole('radio', { name: '3 de 5 estrelas' }).click()
    await page.getByLabel('Apelido público').fill('Noah')
    await page.getByLabel('Seu comentário').fill('Uma bela experiência.')
    state.failReview = true
    await page.getByRole('button', { name: 'Salvar avaliação' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByLabel('Seu comentário').inputValue(), 'Uma bela experiência.')
    state.failReview = false
    await page.getByRole('button', { name: 'Salvar avaliação' }).click()
    await page.getByText('Sua avaliação foi publicada.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Excluir minha avaliação' }).click()
    await page.getByRole('button', { name: 'Confirmar exclusão' }).click()
    await page.getByText('Avaliação excluída. O filme continua nos seus assistidos.', { exact: true }).waitFor()
    assert.equal(state.watches.length, 1)
    assert.equal(state.reviews.length, 0)
  } finally { await ctx.close() }
})

test('falha inicial nas avaliações permite tentar novamente antes de habilitar a edição', async () => {
  const state = shared(), { ctx, page } = await fixture({ state })
  try {
    state.failReviewRead = true
    await page.getByRole('button', { name: 'Explorar o filme' }).click()
    await page.getByRole('button', { name: 'Ver avaliações', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('alert').waitFor()
    assert.equal(await dialog.getByRole('button', { name: 'Já assisti', exact: true }).count(), 0)
    state.failReviewRead = false
    await dialog.getByRole('button', { name: 'Tentar novamente' }).click()
    await dialog.getByRole('button', { name: 'Já assisti', exact: true }).waitFor()
    assert.equal(await dialog.getByRole('alert').count(), 0)
  } finally { await ctx.close() }
})

test('avaliações no swipe: média inclui todas as páginas e estrelas/edição não acionam votos', async () => {
  const state = shared()
  for (let i = 0; i < 25; i++) state.reviews.push({ id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}`, tmdb_id: movies[0].tmdb_id, display_name: `Pessoa ${i}`, rating: i < 20 ? 5 : 1, comment: '', contains_spoilers: false, created_at: new Date(Date.UTC(2026, 8, 30, 12, i)).toISOString(), updated_at: '2026-10-01T12:00:00Z' })
  const { ctx, page, reactions } = await fixture({ state, path: '/s/DEMO01', width: 390 })
  try {
    await page.getByRole('button', { name: 'Avaliações dos usuários' }).click()
    await page.locator('.library-public-review').first().waitFor()
    assert.equal(await page.locator('.library-public-review').count(), 20)
    assert.match(await page.locator('.library-review-average').innerText(), /4\.2[\s\S]*25 avaliações/)
    await page.getByRole('button', { name: 'Ver mais avaliações' }).click()
    await page.waitForFunction(() => document.querySelectorAll('.library-public-review').length === 25)
    await page.getByRole('button', { name: 'Já assisti', exact: true }).click()
    const star = page.getByRole('radio', { name: '1 de 5 estrelas' })
    await star.focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.getByRole('radio', { name: '2 de 5 estrelas' }).getAttribute('aria-checked'), 'true')
    await page.getByLabel('Apelido público').fill('Mila')
    await page.getByLabel('Seu comentário').fill('Texto em edição')
    await page.getByLabel('Seu comentário').press('ArrowLeft')
    await page.getByLabel('Seu comentário').press('ArrowRight')
    await page.getByLabel('Seu comentário').press('Backspace')
    assert.equal(reactions.length, 0)
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.getByRole('button', { name: 'Pôster', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    for (let attempt = 0; !reactions.length && attempt < 30; attempt++) await delay(100)
    assert.equal(reactions.length, 1)
    assert.equal(reactions[0].value, 1)
  } finally { await ctx.close() }
})

for (const width of [320, 390, 768, 1440]) test(`histórico e avaliações em ${width}px: layout, foco e recuperação`, async () => {
  const state = shared(), row = watch(state)
  state.reviews.push({ id: row.id, tmdb_id: row.tmdb_id, display_name: 'Ana', rating: 4, comment: 'Uma viagem para rever.', contains_spoilers: false, created_at: '2026-10-01T12:01:00Z', updated_at: '2026-10-01T12:01:00Z' })
  const { ctx, page, errors } = await fixture({ state, width })
  try {
    await page.getByRole('link', { name: /Meus assistidos/ }).click()
    await page.locator('.library-movie-card').waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const ratio = await page.locator('.library-poster-button').evaluate(element => element.clientWidth / element.clientHeight)
    assert.ok(Math.abs(ratio - 2 / 3) < .02)
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/watched-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Editar avaliação' }).click()
    const dialog = page.getByRole('dialog')
    await page.getByRole('radio', { name: '4 de 5 estrelas' }).waitFor()
    assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false)
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true) }
    await page.getByRole('radio', { name: '4 de 5 estrelas' }).focus()
    assert.notEqual(await page.getByRole('radio', { name: '4 de 5 estrelas' }).evaluate(element => getComputedStyle(element).outlineStyle), 'none')
    if (process.env.VISUAL_CAPTURE_DIR) { await dialog.evaluate(element => { element.scrollTop = 0 }); await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/reviews-${width}.png` }) }
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('button', { name: 'Editar avaliação' }).evaluate(element => element === document.activeElement), true)
    state.failList = true
    await page.reload()
    await page.getByRole('alert').waitFor()
    state.failList = false
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await page.locator('.library-movie-card').waitFor()
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})
