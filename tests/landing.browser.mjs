import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const posterFixture = await readFile(new URL('../public/demo/interstellar.jpg', import.meta.url))
const catalogue = JSON.parse(await readFile(new URL('../src/data/landingMovies.json', import.meta.url), 'utf8'))

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:4178'
const sessionUrl = new URL(baseUrl)
sessionUrl.pathname = '/s/DEMO01'
let server
let browser

before(async () => {
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'ignore', windowsHide: true })
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await globalThis.fetch(baseUrl)).ok) break } catch { /* Wait for Vite. */ }
      await delay(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) })
})
after(async () => { await browser?.close(); server?.kill() })

async function context(options = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...options })
  // Every test intercepts Supabase, including failures, so this suite never writes live data.
  const state = { requests: [], reactions: [], creates: 0 }
  const uid = '11111111-1111-4111-8111-111111111111'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} }
  const token = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test'
  const movie = { movie_id: 1, id: 1, tmdb_id: 157336, title: 'Interestelar', year: 2014, poster_url: '/demo/interstellar.jpg', genres: [878] }
  await ctx.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const body = req.postData() ? req.postDataJSON() : null
    state.requests.push({ path, method: req.method(), body })
    let result = []
    if (path.includes('/auth/v1/')) {
      result = path.endsWith('/user') ? user : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture', user }
    } else if (path.includes('/rpc/create_session')) {
      state.creates++
      result = [{ id: '22222222-2222-4222-8222-222222222222', code: 'DEMO01' }]
    } else if (path.includes('/rpc/join_session')) {
      if (['BAD001', 'OLD001'].includes(body?.p_code)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0002', message: 'Session not found or expired' }) })
      result = [{ id: '22222222-2222-4222-8222-222222222222', code: 'DEMO01' }]
    } else if (path.includes('/rpc/touch_session_presence')) result = 2
    else if (path.includes('/rpc/check_session_match')) result = [{ is_match: false, member_count: 2, like_count: 1 }]
    else if (path.includes('/rpc/list_session_matches')) result = []
    else if (path.includes('/rest/v1/users')) result = { id: uid, is_adult: false, is_premium: false }
    else if (path.includes('/rest/v1/session_filters')) result = null
    else if (path.includes('/rest/v1/movies')) result = { ...movie, id: 1 }
    else if (path.includes('/rest/v1/reactions') && req.method() === 'POST') { state.reactions.push(body); result = null }
    else if (path.includes('/functions/v1/discover')) result = { page: 1, total_pages: 1, results: [movie, { ...movie, movie_id: 2, tmdb_id: 194, title: 'O Fabuloso Destino de Amélie Poulain', poster_url: '/demo/amelie.jpg' }] }
    else if (path.includes('/functions/v1/movie_details')) result = { ...movie, vote_average: 8.6, runtime: 169, overview: 'Sinopse de teste.', trailer: null, age_rating: '12', genres: [{ id: 878, name: 'Ficção científica' }], providers: {} }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await ctx.route(/googlesyndication|fundingchoicesmessages/, route => route.abort())
  await ctx.route(/https:\/\/image\.tmdb\.org\//, route => route.fulfill({ contentType: 'image/jpeg', body: posterFixture }))
  const page = await ctx.newPage()
  await page.routeWebSocket(/supabase\.co/, socket => socket.close())
  return { ctx, page, state }
}

for (const width of [390, 768, 1440]) {
  test('home em ' + width + 'px: layout, fontes locais e pôsteres distintos, sem autenticação', async () => {
    const { ctx, page, state } = await context({ viewport: { width, height: 1000 } })
    try {
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(baseUrl)
      await page.locator('h1').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.match(await page.locator('h1').innerText(), /A escolha de todos/)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.equal(await page.evaluate(() => document.fonts.check('600 40px "Bricolage Grotesque"') && document.fonts.check('400 14px Manrope')), true)
      await page.waitForFunction(() => [...document.querySelectorAll('.image-stream-card img')].every(image => image.complete && image.naturalWidth > 0))
      const sources = await page.locator('.image-stream-card img').evaluateAll(images => images.map(image => image.src))
      assert.equal(sources.length, 18)
      assert.equal(new Set(sources).size, 18)
      assert.equal(state.requests.length, 0)
      assert.deepEqual(errors, [])
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('.cinema-skip-link').evaluate(element => element === document.activeElement), true)
      assert.equal(await page.locator('.cinema-skip-link').evaluate(element => getComputedStyle(element).outlineStyle), 'solid')
      await page.getByRole('button', { name: 'Tenho um código' }).click()
      assert.equal(await page.locator('#session-code').evaluate(element => element === document.activeElement), true)
      await page.locator('#session-code').fill('abc')
      await page.locator('#session-code').press('Enter')
      assert.equal(state.requests.length, 0)
      assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).isDisabled(), true)
      await page.locator('#session-code').press('Backspace')
      assert.equal(await page.locator('#session-code').inputValue(), 'AB')
    } finally { await ctx.close() }
  })
}

test('a animação pode ser pausada e respeita movimento reduzido', async () => {
  const { ctx, page } = await context()
  try {
    await page.goto(baseUrl)
    assert.equal(await page.getByRole('button', { name: 'Pausar animação dos pôsteres' }).innerText(), '')
    await page.getByRole('button', { name: 'Pausar animação dos pôsteres' }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('.image-stream-card')].every(element => getComputedStyle(element).animationPlayState === 'paused'))
    // Wait for the compositor to commit the paused frame before sampling its transform.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const transform = await page.locator('.image-stream-card').first().evaluate(element => getComputedStyle(element).transform)
    await delay(150)
    assert.equal(await page.locator('.image-stream-card').first().evaluate(element => getComputedStyle(element).transform), transform)
    await page.getByRole('button', { name: 'Retomar animação dos pôsteres' }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => [...document.querySelectorAll('.image-stream-card')].every(element => getComputedStyle(element).animationPlayState === 'paused'))
    assert.equal(await page.getByRole('button', { name: /preferência de movimento reduzido/ }).isDisabled(), true)
  } finally { await ctx.close() }
})

test('a visita seguinte muda os filmes e mantém título, ano e pôster sincronizados', async () => {
  const { ctx, page } = await context()
  try {
    await page.goto(baseUrl)
    await page.locator('#recursos').scrollIntoViewIfNeeded()
    const img = page.locator('.cinema-match-example .cinema-poster img')
    await img.waitFor()
    const source = await img.getAttribute('src')
    const film = catalogue.movies.find(movie => movie.poster === source)
    assert.ok(film)
    assert.equal(await img.getAttribute('alt'), 'Pôster de ' + film.title)
    assert.equal(await page.locator('.cinema-example-film').innerText(), film.title + ' · ' + film.year)
    const rails = await page.locator('.image-stream-card img').evaluateAll(images => images.map(image => image.src))
    assert.equal(rails.some(url => new URL(url).pathname.split('/').pop() === new URL(source, baseUrl).pathname.split('/').pop()), false)
    await page.locator('#session-code').fill('AB')
    assert.deepEqual(await page.locator('.image-stream-card img').evaluateAll(images => images.map(image => image.src)), rails)
    await page.reload()
    await page.locator('#recursos').scrollIntoViewIfNeeded()
    assert.notEqual(await page.locator('.cinema-match-example .cinema-poster img').getAttribute('src'), source)
    assert.notDeepEqual(await page.locator('.image-stream-card img').evaluateAll(images => images.map(image => image.src)), rails)
  } finally { await ctx.close() }
})

test('falha do pôster mostra indisponibilidade e preserva o nome do filme', async () => {
  const { ctx, page } = await context()
  await ctx.route(/https:\/\/image\.tmdb\.org\//, route => route.abort())
  try {
    await page.goto(baseUrl)
    await page.locator('#recursos').scrollIntoViewIfNeeded()
    const fallback = page.locator('.cinema-poster-unavailable')
    await fallback.waitFor()
    const title = await fallback.locator('span').innerText()
    assert.equal(await fallback.getAttribute('aria-label'), 'Pôster indisponível de ' + title)
    assert.match(await page.locator('.cinema-example-film').innerText(), new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  } finally { await ctx.close() }
})

test('botões expandem o círculo e animam cada seta na sua direção, respeitando movimento reduzido', async () => {
  const { ctx, page } = await context()
  try {
    await page.goto(baseUrl)
    await page.locator('#session-code').fill('DEMO01')
    for (const [name, xSign, ySign] of [['Criar uma sessão', 1, -1], ['Tenho um código', 0, 1], ['Entrar', 1, 0]]) {
      const button = page.getByRole('button', { name, exact: true })
      await button.hover()
      const arrow = button.locator('.cinema-button-arrow svg')
      await arrow.evaluate(element => {
        const animation = element.getAnimations().find(animation => animation instanceof CSSAnimation)
        animation.pause()
        animation.currentTime = 120
      })
      const movement = await arrow.evaluate(element => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return [Math.sign(matrix.m41), Math.sign(matrix.m42)]
      })
      assert.deepEqual(movement, [xSign, ySign])
      await page.waitForFunction(element => element.querySelector('.cinema-button-circle').getBoundingClientRect().width >= element.getBoundingClientRect().width - 5, await button.elementHandle())
      assert.equal(await button.innerText(), name)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const create = page.getByRole('button', { name: 'Criar uma sessão', exact: true })
    await create.focus()
    assert.equal(await create.locator('.cinema-button-arrow svg').evaluate(element => getComputedStyle(element).animationName), 'none')
    assert.equal(await create.evaluate(element => getComputedStyle(element).outlineStyle), 'solid')
  } finally { await ctx.close() }
})

test('o corredor seleciona pôster original em desktop de alta densidade e desenha uma camada maior', async () => {
  const { ctx, page } = await context({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  try {
    await page.goto(baseUrl)
    await page.waitForFunction(() => [...document.querySelectorAll('.image-stream-card img')].every(image => image.complete && image.naturalWidth > 0))
    const sources = await page.locator('.image-stream-card img').evaluateAll(images => images.map(image => image.currentSrc))
    assert.ok(sources.every(source => source.includes('/t/p/original/')))
    await page.getByRole('button', { name: 'Pausar animação dos pôsteres' }).click()
    const raster = await page.locator('.image-stream-card').last().evaluate(element => {
      element.getAnimations().forEach(animation => { animation.currentTime = 24000 * .89; animation.pause() })
      return { base: element.offsetHeight, displayed: element.getBoundingClientRect().height }
    })
    assert.ok(raster.base >= raster.displayed, 'A textura não deve ser ampliada ao chegar à borda.')
  } finally { await ctx.close() }
})

test('rede lenta e recarga mostram miniaturas locais antes da imagem nítida, sem autenticação', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 } })
  let release
  const network = new Promise(resolve => { release = resolve })
  await ctx.route(/https:\/\/image\.tmdb\.org\//, async route => {
    await network
    await route.fulfill({ contentType: 'image/jpeg', body: posterFixture }).catch(() => {})
  })
  try {
    for (let visit = 0; visit < 2; visit++) {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await page.locator('h1').waitFor()
      const previews = await page.locator('.image-stream-card .cinema-poster').evaluateAll(elements => elements.map(element => ({ background: getComputedStyle(element).backgroundImage, ready: element.classList.contains('is-ready') })))
      assert.equal(previews.length, 18)
      assert.ok(previews.every(preview => preview.background.includes('data:image/jpeg;base64,') && !preview.ready))
      // The preview is embedded in the document bundle, not another slow network request.
      const dimensions = await page.locator('.image-stream-card .cinema-poster').first().evaluate(async element => {
        const thumbnail = new Image()
        thumbnail.src = element.style.backgroundImage.slice(5, -2)
        await thumbnail.decode()
        return [thumbnail.naturalWidth, thumbnail.naturalHeight]
      })
      assert.deepEqual(dimensions, [24, 36])
      assert.equal(await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).isEnabled(), true)
      assert.equal(state.requests.length, 0)
      if (process.env.VISUAL_CAPTURE_DIR && visit === 0) {
        await page.getByRole('button', { name: 'Pausar animação dos pôsteres' }).click()
        await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/cinema-loading-390.png' })
      }
    }
    release()
    await page.waitForFunction(() => document.querySelectorAll('.image-stream-card .cinema-poster.is-ready').length === 18)
  } finally { release(); await ctx.close() }
})

test('pôsteres bloqueados mantêm a miniatura do filme no corredor', async () => {
  const { ctx, page } = await context()
  await ctx.route(/https:\/\/image\.tmdb\.org\//, route => route.abort())
  try {
    await page.goto(baseUrl)
    const previews = await page.locator('.image-stream-card .cinema-poster').evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundImage))
    assert.equal(previews.length, 18)
    assert.ok(previews.every(preview => preview.includes('data:image/jpeg;base64,')))
  } finally { await ctx.close() }
})

test('novos controles permitem curtir, desfazer e recusar; foco e movimento reduzido permanecem acessíveis', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 } })
  try {
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).click()
    await page.waitForURL('**/s/DEMO01')
    const like = page.getByRole('button', { name: 'Like', exact: true })
    const undo = page.getByRole('button', { name: 'Desfazer', exact: true })
    const dislike = page.getByRole('button', { name: 'Dislike', exact: true })
    await like.waitFor()
    await page.waitForFunction(() => !document.querySelector('.cinema-vote-button.is-like').disabled)
    assert.equal(await undo.isDisabled(), true)
    await like.hover()
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.is-like .filled')).opacity === '1')
    assert.equal(await like.locator('.filled').evaluate(element => getComputedStyle(element).animationName), 'cinema-heartbeat')
    await like.click()
    for (let attempt = 0; attempt < 50 && state.reactions.length < 1; attempt++) await delay(100)
    assert.equal(state.reactions.length, 1)
    assert.equal(state.reactions[0].value, 1)
    await page.waitForFunction(() => !document.querySelector('.cinema-vote-button.is-undo').disabled)
    await undo.click()
    for (let attempt = 0; attempt < 50 && !state.requests.some(request => request.path.includes('/reactions') && request.method === 'DELETE'); attempt++) await delay(100)
    await page.waitForFunction(() => document.querySelector('.cinema-vote-button.is-undo').disabled && !document.querySelector('.cinema-vote-button.is-dislike').disabled)
    assert.equal(state.requests.filter(request => request.path.includes('/reactions') && request.method === 'DELETE').length, 1)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await like.focus()
    await page.keyboard.press('Shift+Tab')
    assert.equal(await dislike.evaluate(element => element === document.activeElement), true)
    assert.equal(await dislike.evaluate(element => getComputedStyle(element).outlineStyle), 'solid')
    await dislike.hover()
    assert.equal(await dislike.locator('.cinema-vote-icon').evaluate(element => getComputedStyle(element).animationName), 'none')
    await dislike.click()
    for (let attempt = 0; attempt < 50 && state.reactions.length < 2; attempt++) await delay(100)
    assert.equal(state.reactions.length, 2)
    assert.equal(state.reactions[1].value, -1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    if (process.env.VISUAL_CAPTURE_DIR) {
      await page.waitForFunction(() => !document.querySelector('.cinema-vote-button.is-like').disabled)
      await delay(1900)
      await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/cinema-vote-390.png' })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await like.hover()
      await delay(200)
      await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/cinema-vote-1440.png' })
    }
  } finally { await ctx.close() }
})

for (const code of ['BAD001', 'OLD001']) {
  test('código inexistente/expirado ' + code + ': erro legível e nova tentativa disponível', async () => {
    const { ctx, page, state } = await context()
    try {
      await page.goto(baseUrl)
      await page.locator('#session-code').fill(code.toLowerCase())
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('#session-status').textContent.includes('Sessão não encontrada ou expirada'))
      assert.equal(new URL(page.url()).pathname, '/')
      assert.equal(state.requests.find(request => request.path.includes('join_session')).body.p_code, code)
      assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).isEnabled(), true)
    } finally { await ctx.close() }
  })
}

test('falha de conexão mantém a home utilizável', async () => {
  const { ctx, page } = await context()
  await ctx.route(/https:\/\/[^/]+\.supabase\.co\/auth\//, route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"unavailable","message":"Unavailable"}' }))
  try {
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#session-status').textContent.includes('Não foi possível conectar'))
    assert.equal(await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).isEnabled(), true)
  } finally { await ctx.close() }
})

test('criação não duplica sessões e anúncio bloqueado permite votar e dispensar o aviso', async () => {
  const { ctx, page, state } = await context()
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.adsbox{display:none!important}'
      document.head.appendChild(style)
    })
  })
  try {
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).evaluate(button => { button.click(); button.click() })
    await page.waitForURL('**/s/DEMO01')
    await page.getByRole('button', { name: 'Abrir filtros' }).waitFor()
    assert.equal(state.creates, 1)
    const dismiss = page.getByRole('button', { name: 'Dispensar aviso de publicidade' })
    await dismiss.waitFor()
    await page.getByRole('button', { name: 'Abrir filtros' }).click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await page.keyboard.press('ArrowRight')
    for (let attempt = 0; attempt < 50 && state.reactions.length === 0; attempt++) await delay(100)
    assert.equal(state.reactions.length, 1)
    await dismiss.click()
    assert.equal(await page.locator('.mm-ad-notice').count(), 0)
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mm:ads-notice-dismissed:v1')), '1')
    await page.reload()
    await page.getByRole('button', { name: 'Abrir filtros' }).waitFor()
    await delay(2200)
    assert.equal(await page.locator('.mm-ad-notice').count(), 0)
  } finally { await ctx.close() }
})

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`carregamento da sessão usa ondas e respeita ${reducedMotion}`, async () => {
    const { ctx, page } = await context({ viewport: { width: 390, height: 844 }, reducedMotion })
    let release
    const gate = new Promise(resolve => { release = resolve })
    await ctx.route(/supabase\.co\/auth\//, async route => { await gate; await route.fallback() })
    try {
      await page.goto(sessionUrl.href)
      const loader = page.locator('.cinema-session-loader')
      await loader.waitFor()
      assert.equal(await loader.locator('.cinema-wave').count(), 4)
      assert.equal(await loader.locator('.cinema-wave-bar').count(), 96)
      assert.equal(await loader.getAttribute('role'), 'status')
      assert.match(await loader.innerText(), /Carregando sessão/)
      const animation = await loader.locator('[data-level="1"] .cinema-wave-bar').first().evaluate(element => getComputedStyle(element).animationName)
      assert.equal(animation, reducedMotion === 'reduce' ? 'none' : 'cinema-wave-height, cinema-wave-skew')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      if (process.env.VISUAL_CAPTURE_DIR && reducedMotion === 'no-preference') await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/session-wave-390.png' })
      release()
      await page.getByRole('button', { name: 'Compartilhar sessão' }).waitFor()
      assert.equal(await loader.count(), 0)
    } finally { release(); await ctx.close() }
  })
}

for (const width of [390, 768, 1440]) {
  test(`compartilhamento expansível em ${width}px: convites, cópia, teclado e cancelamento`, async () => {
    const { ctx, page, state } = await context({ viewport: { width, height: 844 } })
    await ctx.addInitScript(() => {
      window.copiedInvite = ''
      window.sharePayload = null
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedInvite = text } } })
      Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => { window.sharePayload = payload; throw new DOMException('Cancelled', 'AbortError') } })
    })
    try {
      await page.goto(sessionUrl.href)
      const trigger = page.getByRole('button', { name: 'Compartilhar sessão' })
      await trigger.click()
      const panel = page.getByRole('dialog', { name: 'Convidar para a sessão' })
      await panel.waitFor()
      await page.waitForFunction(() => [...document.querySelectorAll('.cinema-share-action')].every(element => getComputedStyle(element).opacity === '1'))
      assert.equal(await panel.evaluate(element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }), true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const invite = new URL('/join?code=DEMO01', baseUrl).href
      const whatsapp = new URL(await page.getByRole('link', { name: 'WhatsApp' }).getAttribute('href'))
      const telegram = new URL(await page.getByRole('link', { name: 'Telegram' }).getAttribute('href'))
      assert.ok(whatsapp.searchParams.get('text').includes(invite))
      assert.equal(telegram.searchParams.get('url'), invite)
      if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/share-session-${width}.png` })
      await page.keyboard.press('ArrowRight')
      assert.equal(state.reactions.length, 0)
      await page.getByRole('button', { name: 'Mais opções' }).click()
      assert.equal(await page.evaluate(() => window.sharePayload.url), invite)
      assert.equal(await page.evaluate(() => window.copiedInvite), '')
      assert.equal(await panel.count(), 1)
      await page.keyboard.press('Escape')
      await panel.waitFor({ state: 'detached' })
      assert.equal(await panel.count(), 0)
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
      await trigger.click()
      await page.getByRole('button', { name: 'Copiar link', exact: true }).click()
      await panel.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.copiedInvite), invite)
      assert.equal(await panel.count(), 0)
      await trigger.click()
      await page.locator('main').click({ position: { x: 4, y: 400 } })
      await panel.waitFor({ state: 'detached' })
      assert.equal(await panel.count(), 0)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await trigger.click()
      assert.equal(await panel.locator('.cinema-share-action').first().evaluate(element => getComputedStyle(element).animationName), 'none')
    } finally { await ctx.close() }
  })
}

test('retorno ao topo aparece após rolar, respeita movimento reduzido e devolve o foco', async () => {
  const { ctx, page } = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  try {
    await page.goto(baseUrl)
    assert.equal(await page.getByRole('button', { name: 'Voltar ao topo' }).count(), 0)
    await page.evaluate(() => window.scrollTo(0, 700))
    const top = page.getByRole('button', { name: 'Voltar ao topo' })
    await top.waitFor()
    assert.equal(await top.evaluate(element => getComputedStyle(element).transitionDuration), '0s')
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/back-to-top-390.png' })
    await top.click()
    await page.waitForFunction(() => window.scrollY === 0)
    await top.waitFor({ state: 'detached' })
    assert.equal(await page.locator('main h1').evaluate(element => element === document.activeElement), true)
    assert.equal(await top.count(), 0)
    await page.goto(new URL('/s/DEMO01', baseUrl).href)
    await page.getByRole('button', { name: 'Compartilhar sessão' }).waitFor()
    assert.equal(await top.count(), 0)
  } finally { await ctx.close() }
})
