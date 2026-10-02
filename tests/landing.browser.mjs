import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

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

test('trocar idioma no swipe preserva filme, votos e região; metadados usam o novo idioma',async()=>{
  const {ctx,page,state}=await context({locale:'en-US',serviceWorkers:'block'})
  try{
    await page.goto(sessionUrl.href)
    await page.getByRole('button',{name:'Want to watch',exact:true}).waitFor()
    const title=await page.locator('.swipe-film-title').textContent()
    const localizedDetails=page.waitForResponse(response=>response.url().includes('/functions/v1/movie_details')&&new URL(response.url()).searchParams.get('language')==='es-ES')
    await page.getByLabel('Interface language',{exact:true}).selectOption('es')
    await localizedDetails
    await page.getByRole('button',{name:'Quiero verla',exact:true}).waitFor()
    assert.equal(await page.locator('.swipe-film-title').textContent(),title)
    assert.equal(state.reactions.length,0)
    await page.waitForFunction(()=>document.documentElement.lang==='es-ES')
    const details=state.requests.filter(x=>x.path.includes('/functions/v1/movie_details'))
    assert.ok(details.some(x=>new URL(x.url).searchParams.get('language')==='es-ES'))
    assert.ok(details.every(x=>new URL(x.url).searchParams.get('region')==='BR'))
    assert.equal(state.requests.find(x=>x.path.includes('/functions/v1/discover')).body.displayLanguage,'en-US')
    await page.getByRole('button',{name:'Quiero verla',exact:true}).click()
    await page.waitForFunction(old=>document.querySelector('.swipe-film-title')?.textContent!==old,title)
    const next=await page.locator('.swipe-film-title').textContent()
    await page.getByLabel('Idioma de la interfaz',{exact:true}).selectOption('pt')
    await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor()
    assert.equal(await page.locator('.swipe-film-title').textContent(),next)
    assert.equal(state.reactions.length,1)
  }finally{await ctx.close()}
})

test('nova sala usa a região do navegador, separada do idioma escolhido manualmente',async()=>{
  const {ctx,page,state}=await context({locale:'en-CA',serviceWorkers:'block'})
  try{
    await page.goto(baseUrl)
    await page.getByLabel('Interface language',{exact:true}).selectOption('es')
    await page.getByRole('button',{name:'Crear una sesión',exact:true}).click()
    await page.waitForURL(sessionUrl.href)
    const setting=state.requests.find(x=>x.path.includes('/rest/v1/session_filters')&&x.method==='POST')
    assert.equal(setting.body.watch_region,'CA')
    assert.equal(state.creates,1)
  }finally{await ctx.close()}
})
after(async () => { await browser?.close(); server?.kill() })

async function context(options = {}) {
  const { tutorial = false, ...browserOptions } = options
  const ctx = await browser.newContext({ locale: 'pt-BR', ...browserOptions })
  // Block the app worker by its route: Playwright's global blocker reads
  // navigator.serviceWorker inside sandboxed child frames and throws.
  await ctx.route('**/sw.js', route => route.abort())
  if (!tutorial) await ctx.addInitScript(() => { if (window === window.top) localStorage.setItem('mm:swipe-tutorial:v1:22222222-2222-4222-8222-222222222222', '1') })
  // Every test intercepts Supabase, including failures, so this suite never writes live data.
  const state = { requests: [], reactions: [], creates: 0 }
  const publicMembers = ['Luna','Leo','Ana'].map((display_name,index)=>({id:String(index+1),handle:display_name.toLowerCase(),display_name,bio:'Histórias que ficam.',avatar_path:null,cover_path:null}))
  const uid = '11111111-1111-4111-8111-111111111111'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} }
  const token = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test'
  const movie = { movie_id: 1, id: 1, tmdb_id: 157336, title: 'Interestelar', year: 2014, poster_url: '/demo/interstellar.jpg', genres: [878] }
  await ctx.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const body = req.postData() ? req.postDataJSON() : null
    state.requests.push({ path, method: req.method(), body, url: req.url() })
    let result = []
    if (path.includes('/auth/v1/')) {
      result = path.endsWith('/user') ? user : { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture', user }
    } else if (path.includes('/rpc/create_session')) {
      state.creates++
      result = [{ id: '22222222-2222-4222-8222-222222222222', code: 'DEMO01' }]
    } else if (path.includes('/rpc/join_session')) {
      if (['BAD001', 'OLD001'].includes(body?.p_code)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0002', message: 'Session not found or expired' }) })
      result = [{ id: '22222222-2222-4222-8222-222222222222', code: 'DEMO01' }]
    } else if (path.includes('/rpc/community_profiles')) result = publicMembers
    else if (path.includes('/rpc/session_participants')) result = [{...publicMembers[0],member_key:1,online:true},{member_key:2,id:null,handle:null,display_name:'Convidado',bio:null,avatar_path:null,cover_path:null,online:false},{member_key:3,id:null,handle:null,display_name:'Perfil privado',bio:null,avatar_path:null,cover_path:null,online:true}]
    else if (path.includes('/rpc/touch_session_presence')) result = 2
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

test('Gateway Flow mantém a fonte registrada, preenche a tela e reage sem bloquear os votos', async () => {
  for (const [path, sha] of [
    ['neuform-isolated/NeuformBatchEffects.tsx', 'dc68c51bea26b922965de44b4fb8d6c432607508fb2b61e16ed60d245da1a69f'],
    ['neuform-isolated/sources/gateway-flow.html', 'c5a1de43138ffba96b9f0ecdcf3c054ae251ec94344e88c6ad502bae362b17d0'],
    ['threeui.css', 'efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf'],
  ]) assert.equal(createHash('sha256').update(await readFile(new URL('../src/shaders/' + path, import.meta.url))).digest('hex'), sha)
  const { ctx, page, state } = await context({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(sessionUrl.href)
    const element = page.locator('.swipe-background iframe')
    await element.waitFor()
    assert.equal(await element.getAttribute('sandbox'), 'allow-scripts')
    assert.equal(await element.getAttribute('tabindex'), '-1')
    assert.equal(await page.locator('.swipe-background').evaluate(el => el.inert), true)
    const frame = await element.elementHandle().then(el => el.contentFrame())
    await frame.waitForFunction(() => document.body?.hasAttribute('data-threeui-ready') && document.querySelector('#flow-canvas')?.width > 0)
    const pixels = () => frame.evaluate(() => {
      const c = document.querySelector('#flow-canvas')
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      let lit = 0, hash = 0
      for (let i = 3; i < data.length; i += 4) { if (data[i]) lit++; hash = (hash * 31 + data[i]) | 0 }
      return { lit, hash }
    })
    await frame.waitForFunction(() => {
      const c = document.querySelector('#flow-canvas')
      return c && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0)
    })
    const first = await pixels()
    assert.ok(first.lit > 1000, 'authored trajectories must be painted')
    await delay(150)
    assert.notEqual((await pixels()).hash, first.hash, 'particles must animate')
    await frame.evaluate(() => { window.testClicks = []; window.addEventListener('click', e => window.testClicks.push([e.clientX, e.clientY])) })
    await page.mouse.click(20, 250)
    await frame.waitForFunction(() => window.testClicks.length === 1)
    assert.deepEqual(await frame.evaluate(() => window.testClicks[0]), [20, 250])
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await frame.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height && document.querySelector('#flow-canvas').width === width * devicePixelRatio, { width, height })
      const bounds = await element.boundingBox()
      assert.deepEqual(bounds, { x: 0, y: 0, width, height })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/gateway-flow-${width}x${height}.png` })
    }
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.is-undo').disabled)
    assert.equal(state.reactions.at(-1).value, 1)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await element.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.is-undo').disabled)
    assert.equal(await page.getByRole('button', { name: 'Quero assistir', exact: true }).isVisible(), true)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await element.waitFor()
    await page.locator('.swipe-header a[href="/"]').first().click()
    await element.waitFor({ state: 'detached' })
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})

for (const width of [320, 390, 768, 1440]) {
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
      assert.equal(state.requests.filter(request => !request.path.includes('/rpc/community_profiles')).length, 0)
      assert.deepEqual(errors, [])
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('.cinema-skip-link').evaluate(element => element === document.activeElement), true)
      assert.equal(await page.locator('.cinema-skip-link').evaluate(element => getComputedStyle(element).outlineStyle), 'solid')
      await page.getByRole('button', { name: 'Tenho um código' }).click()
      assert.equal(await page.locator('#session-code').evaluate(element => element === document.activeElement), true)
      await page.locator('#session-code').fill('abc')
      await page.locator('#session-code').press('Enter')
      assert.equal(state.requests.filter(request => !request.path.includes('/rpc/community_profiles')).length, 0)
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
      assert.equal(state.requests.filter(request => !request.path.includes('/rpc/community_profiles')).length, 0)
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
    const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
    const undo = page.getByRole('button', { name: 'Desfazer', exact: true })
    const dislike = page.getByRole('button', { name: 'Passo', exact: true })
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
      for (const viewport of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1440,height:900},{width:844,height:390}]) {
        await page.setViewportSize(viewport)
        const center = await loader.locator('.cinema-wave-orb').evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.left+r.width/2-innerWidth/2,y:r.top+r.height/2-innerHeight/2} })
        assert.ok(Math.abs(center.x)<1 && Math.abs(center.y)<1, `Loader not centered in ${viewport.width}x${viewport.height}: ${JSON.stringify(center)}`)
      }
      await page.setViewportSize({width:390,height:844})
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

for (const [width, height] of [[390, 844], [768, 1024], [1101, 884], [1440, 900], [320, 568], [390, 1000], [844, 390]]) {
  test(`swipe editorial ${width}x${height}: pôster 2:3 e controles dentro da tela`, async () => {
    const { ctx, page } = await context({ viewport: { width, height }, reducedMotion: 'reduce' })
    try {
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(sessionUrl.href)
      await page.getByRole('button', { name: 'Quero assistir', exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('.swipe-poster-image')?.classList.contains('is-ready'))
      await page.evaluate(() => document.fonts.ready)
      const layout = await page.evaluate(() => {
        const bounds = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
        return { poster: bounds(document.querySelector('.swipe-poster-frame')), buttons: [...document.querySelectorAll('.cinema-vote-button')].map(bounds), tabs: [...document.querySelectorAll('.swipe-carousel-tabs button')].map(bounds), header: bounds(document.querySelector('.swipe-header')), scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, height: innerHeight, width: innerWidth }
      })
      assert.ok(Math.abs(layout.poster.width / layout.poster.height - 2 / 3) < .01, JSON.stringify(layout.poster))
      assert.ok(layout.poster.height > 140)
      assert.ok(Math.abs((layout.poster.left + layout.poster.right) / 2 - width / 2) < 2, JSON.stringify(layout.poster))
      const voteCenter = (Math.min(...layout.buttons.map(button => button.left)) + Math.max(...layout.buttons.map(button => button.right))) / 2
      assert.ok(Math.abs(voteCenter - width / 2) < 2, JSON.stringify(layout.buttons))
      assert.equal(await page.locator('.swipe-film-copy').count(), 0)
      assert.ok(layout.scrollWidth <= width)
      assert.ok(layout.scrollHeight <= height + 1)
      assert.ok(layout.buttons.every(button => button.top >= 0 && button.bottom <= height && button.left >= 0 && button.right <= width), JSON.stringify(layout.buttons))
      assert.ok(layout.tabs.every(tab => tab.left >= layout.poster.left - 1 && tab.right <= layout.poster.right + 1), JSON.stringify(layout.tabs))
      assert.deepEqual(errors, [])
      if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/swipe-modern-${width}x${height}.png` })
    } finally { await ctx.close() }
  })
}

test('pôster, trailer e sinopse usam clique/Tab; as setas votam mesmo com foco nesses botões', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await ctx.route(/\/functions\/v1\/movie_details/, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tmdb_id: 157336, title: 'Interestelar', year: 2014, runtime: 169, vote_average: 8.6, genres: [{ id: 878, name: 'Ficção científica' }], age_rating: '12', trailer: { key: 'fixture' }, overview: 'Uma viagem além das estrelas. '.repeat(80) }) }))
  await ctx.route(/youtube\.com\/embed/, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><button>Reproduzir</button>' }))
  try {
    await page.goto(sessionUrl.href)
    const poster = page.getByRole('button', { name: 'Pôster', exact: true })
    const trailer = page.getByRole('button', { name: 'Trailer', exact: true })
    await trailer.waitFor()
    const title = await page.locator('.swipe-film-title').innerText()
    assert.equal(await page.locator('.swipe-carousel iframe').count(), 0)
    await trailer.click()
    await page.locator('.swipe-carousel iframe').waitFor()
    assert.equal(await page.locator('.swipe-carousel iframe').getAttribute('title'), `Trailer de ${title}`)
    assert.equal(state.reactions.length, 0)
    await page.keyboard.press('Tab')
    assert.equal(await page.getByRole('button', { name: 'Sinopse', exact: true }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Enter')
    await page.locator('.swipe-carousel iframe').waitFor({ state: 'detached' })
    const synopsis = page.getByRole('region', { name: 'Sinopse', exact: true }).getByLabel('Sinopse do filme')
    await synopsis.focus()
    await page.keyboard.press('ArrowDown')
    assert.equal(state.reactions.length, 0)
    assert.ok(await synopsis.evaluate(element => element.scrollHeight > element.clientHeight))
    await page.getByRole('button', { name: 'Sinopse', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Desfazer', exact: true }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('.cinema-vote-button.is-undo')?.disabled)
    assert.equal(state.reactions.length, 1)
    assert.equal(state.reactions[0].value, 1)
    await page.keyboard.press('Backspace')
    await page.waitForFunction(expected => document.querySelector('.swipe-film-title')?.innerText === expected && document.querySelector('.is-undo').disabled, title)
    await poster.focus()
    await page.keyboard.press('ArrowLeft')
    await page.waitForFunction(() => !document.querySelector('.cinema-vote-button.is-undo')?.disabled)
    assert.equal(state.reactions.length, 2)
    assert.equal(state.reactions[1].value, -1)
  } finally { await ctx.close() }
})

test('tutorial ao criar sala bloqueia atalhos, não reaparece ao retomar e permite reabrir', async () => {
  const { ctx, page, state } = await context({ tutorial: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  try {
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).click()
    await page.waitForURL(sessionUrl.href)
    const dialog = page.getByRole('dialog', { name: 'Como votar no MovieMatch' })
    await dialog.waitFor()
    await page.getByRole('heading', { name: /Seu gosto entra/ }).waitFor()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Backspace')
    assert.equal(state.reactions.length, 0)
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true)
    }
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/swipe-tutorial-390.png' })
    await page.getByRole('button', { name: 'Próximo', exact: true }).click()
    await page.getByRole('heading', { name: /Do jeito de vocês/ }).waitFor()
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await page.getByRole('heading', { name: /Seu gosto entra/ }).waitFor()
    await page.getByRole('button', { name: 'Etapa 3' }).click()
    await page.getByRole('heading', { name: /O mesmo sim/ }).waitFor()
    await page.getByRole('button', { name: 'Começar a votar' }).click()
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => localStorage.getItem('mm:swipe-tutorial:v1:22222222-2222-4222-8222-222222222222')), '1')
    await page.reload()
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).waitFor()
    assert.equal(await dialog.count(), 0)
    const help = page.getByRole('button', { name: 'Abrir tutorial de votação' })
    await help.click()
    await dialog.waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await help.evaluate(element => element === document.activeElement), true)
    assert.equal(state.reactions.length, 0)
  } finally { await ctx.close() }
})

test('Dock amplia os controles com mouse e mantém tamanhos estáveis no toque e com movimento reduzido', async () => {
  for (const touch of [false, true]) {
    const { ctx, page } = await context({ viewport: { width: touch ? 390 : 1440, height: 900 }, hasTouch: touch, isMobile: touch })
    try {
      await page.goto(sessionUrl.href)
      const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
      await like.waitFor()
      const control = like.locator('..')
      await like.hover()
      if (!touch) await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.is-like').parentElement).transform).a > 1.2)
      else assert.equal(await control.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a), 1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.is-like').parentElement).transform).a === 1)
      assert.equal(await page.locator('.cinema-dock [role="button"]').count(), 0, 'Os controles mantêm botões nativos, sem botões aninhados.')
      assert.equal(await page.getByRole('button', { name: 'Desfazer', exact: true }).isDisabled(), true)
      if (process.env.VISUAL_CAPTURE_DIR && !touch) {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await like.hover()
        await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.is-like').parentElement).transform).a > 1.2)
        await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/swipe-dock-1440.png' })
      }
    } finally { await ctx.close() }
  }
})

test('brilho especular é adiado, libera o canvas ao sair e mantém o botão sem WebGL', async () => {
  const { ctx, page } = await context()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(baseUrl)
    const button = page.getByRole('button', { name: 'Criar uma sessão', exact: true })
    assert.equal(await button.locator('canvas').count(), 0)
    const webgl = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      return !!gl
    })
    await button.hover()
    if (webgl) {
      await button.locator('canvas').waitFor()
      assert.ok(await button.locator('canvas').evaluate(canvas => canvas.width > 0))
      if (process.env.VISUAL_CAPTURE_DIR) await button.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/specular-cinema-button.png' })
      await page.mouse.move(0, 0)
      await button.locator('canvas').waitFor({ state: 'detached' })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await button.hover()
      await delay(700)
      assert.equal(await button.locator('canvas').count(), 0)
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.mouse.move(0, 0)
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(kind, ...options) { return kind === 'webgl2' ? null : original.call(this, kind, ...options) }
    })
    await button.hover()
    await delay(750)
    assert.equal(await button.locator('canvas').count(), 0)
    assert.equal(await button.isEnabled(), true)
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})

test('arrastar o pôster salva um único voto e permite desfazer', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  try {
    await page.goto(sessionUrl.href)
    const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
    await like.waitFor()
    await page.waitForFunction(() => !document.querySelector('.is-like').disabled)
    const title = await page.locator('.swipe-film-title').innerText()
    const bounds = await page.locator('.swipe-poster-frame').boundingBox()
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width / 2 + 190, bounds.y + bounds.height / 2, { steps: 16 })
    await page.mouse.up()
    await page.waitForFunction(() => !document.querySelector('.is-undo').disabled)
    assert.equal(state.reactions.length, 1)
    assert.equal(state.reactions[0].value, 1)
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await page.waitForFunction(expected => document.querySelector('.swipe-film-title')?.innerText === expected && document.querySelector('.is-undo').disabled, title)
    assert.equal(state.requests.filter(request => request.path.includes('/reactions') && request.method === 'DELETE').length, 1)
  } finally { await ctx.close() }
})

test('o match usa o novo diálogo, contém o foco e devolve a votação ao fechar', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await ctx.route(/\/rpc\/check_session_match/, route => route.fulfill({ contentType: 'application/json', body: '[{"is_match":true,"member_count":2,"like_count":2}]' }))
  try {
    await page.goto(sessionUrl.href)
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('.is-like').disabled)
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Deu match.' })
    await dialog.waitFor()
    assert.equal(state.reactions.length, 1)
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth))
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true)
    }
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/swipe-match-dialog-390.png' })
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    await page.waitForFunction(() => !document.querySelector('.is-like').disabled)
    assert.equal(state.reactions.length, 1)
  } finally { await ctx.close() }
})

for (const width of [390, 1101]) {
  test(`filtros em ${width}px: brilho, seleção, números, menus, limpeza e aplicação sem votos`, async () => {
    const { ctx, page, state } = await context({ viewport: { width, height: 884 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(sessionUrl.href)
      await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Encontre o filme certo' })
      const netflix = dialog.getByRole('button', { name: 'Netflix', exact: true })
      await netflix.waitFor()
      assert.equal(await dialog.getByRole('button', { name: 'Filtros aplicados' }).isDisabled(), true)
      assert.equal(await dialog.locator('button:not(.cinema-filter-button)').count(), 0)
      if (width === 1101) {
        await netflix.hover()
        const webgl = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2')
          gl?.getExtension('WEBGL_lose_context')?.loseContext()
          return !!gl
        })
        if (webgl) {
          await netflix.locator('canvas').waitFor()
          await delay(500)
          assert.equal(await netflix.locator('.cinema-specular-fx').evaluate(el => getComputedStyle(el).opacity), '1')
          if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/filters-white-hover.png' })
          await page.mouse.move(0, 0)
          await netflix.locator('canvas').waitFor({ state: 'detached' })
        }
      }
      await netflix.click()
      assert.equal(await netflix.getAttribute('aria-pressed'), 'true')
      await dialog.getByTitle('Remover filtro: Netflix', { exact: true }).click()
      assert.equal(await netflix.getAttribute('aria-pressed'), 'false')
      await netflix.click()
      const region = dialog.getByRole('button', { name: 'Brasil (BR)', exact: true })
      await region.click()
      const us = page.getByRole('option', { name: 'Estados Unidos (US)', exact: true })
      assert.ok((await us.getAttribute('class')).includes('cinema-filter-button'))
      await us.click()
      assert.equal(await page.getByRole('listbox').count(), 0)
      await dialog.getByRole('button', { name: /^Período e duração/ }).click()
      await dialog.getByRole('button', { name: 'Aumentar De', exact: true }).click()
      assert.equal(await dialog.getByRole('spinbutton', { name: 'De', exact: true }).inputValue(), '1991')
      await dialog.getByRole('button', { name: 'Limpar filtros', exact: true }).click()
      assert.equal(await netflix.getAttribute('aria-pressed'), 'false')
      assert.equal(await dialog.getByRole('spinbutton', { name: 'De', exact: true }).inputValue(), '1990')
      assert.equal(await dialog.getByRole('button', { name: 'Filtros aplicados' }).isDisabled(), true)
      await netflix.click()
      await region.click()
      await page.getByRole('option', { name: 'Estados Unidos (US)', exact: true }).click()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await netflix.hover()
      await delay(350)
      assert.equal(await netflix.locator('canvas').count(), 0)
      assert.equal(await netflix.evaluate(el => getComputedStyle(el).transform), 'none')
      await dialog.getByRole('button', { name: /^Aplicar/ }).click()
      await dialog.waitFor({ state: 'detached' })
      const saves = state.requests.filter(request => request.path.includes('/rest/v1/session_filters') && request.method === 'POST')
      assert.equal(saves.length, 1)
      assert.deepEqual(saves[0].body.providers, [8])
      assert.equal(saves[0].body.watch_region, 'US')
      assert.equal(saves[0].body.year_min, 1990)
      assert.equal(state.reactions.length, 0)
      await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
      await dialog.waitFor()
      await dialog.getByRole('button', { name: 'Limpar filtros', exact: true }).click()
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      assert.equal(state.requests.filter(request => request.path.includes('/rest/v1/session_filters') && request.method === 'POST').length, 1)
      assert.deepEqual(errors, [])
    } finally { await ctx.close() }
  })
}

for (const width of [390,1440]) test(`avatares em ${width}px: perfis reais, prévia após ampliação e sala existente sem tutorial`, async () => {
  const {ctx,page,state}=await context({viewport:{width,height:900}})
  try {
    await ctx.addInitScript(() => { if (window === window.top) localStorage.removeItem('mm:swipe-tutorial:v1:22222222-2222-4222-8222-222222222222') })
    await page.goto(baseUrl)
    await page.locator('.cinema-match-example').scrollIntoViewIfNeeded()
    const community=page.getByRole('group',{name:'Perfis públicos da comunidade'})
    await community.getByRole('button',{name:/Luna/}).waitFor()
    assert.equal(await community.getByRole('button').count(),3)
    assert.equal(state.requests.some(request=>request.path.includes('/auth/v1/')),false)
    const avatar=community.getByRole('button',{name:/Luna/})
    await avatar.hover()
    assert.equal(await page.getByRole('region',{name:'Perfil de Luna'}).count(),0)
    const preview=page.getByRole('region',{name:'Perfil de Luna'})
    await preview.waitFor();assert.equal(await preview.getByRole('link',{name:'Ver perfil'}).getAttribute('href'),'/p/luna')
    assert.equal(await avatar.locator('span').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a>1),true)
    const bounds=await preview.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=900)
    await page.keyboard.press('Escape');await preview.waitFor({state:'detached'})
    await page.goto(sessionUrl.href)
    await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor()
    assert.equal(await page.getByRole('dialog',{name:'Como votar no MovieMatch'}).count(),0)
    const participants=page.getByRole('group',{name:'Participantes da sessão'})
    await participants.getByRole('button',{name:/Luna/}).waitFor()
    assert.equal(await participants.getByRole('button').count(),3)
    const guest=participants.getByRole('button',{name:/Convidado/});await guest.click()
    const guestPreview=page.getByRole('region',{name:'Perfil de Convidado'});await guestPreview.waitFor();assert.equal(await guestPreview.getByRole('link').count(),0)
    await page.keyboard.press('Escape');await guestPreview.waitFor({state:'detached'})
    await participants.getByRole('button',{name:/Perfil privado/}).focus()
    const privatePreview=page.getByRole('region',{name:'Perfil de Perfil privado'});await privatePreview.waitFor();await page.keyboard.press('ArrowRight');assert.equal(state.reactions.length,0);assert.equal(await privatePreview.getByRole('link').count(),0)
    const privateBounds=await privatePreview.boundingBox();assert.ok(privateBounds.x>=0&&privateBounds.x+privateBounds.width<=width&&privateBounds.y>=0&&privateBounds.y+privateBounds.height<=900)
    await page.keyboard.press('Escape');await privatePreview.waitFor({state:'detached'})
    await page.emulateMedia({reducedMotion:'reduce'});await participants.getByRole('button',{name:/Luna/}).hover()
    await page.getByRole('region',{name:'Perfil de Luna'}).waitFor()
    assert.equal(await participants.getByRole('button',{name:/Luna/}).locator('span').evaluate(el=>getComputedStyle(el).transform),'none')
    await page.keyboard.press('Escape');await page.getByRole('region',{name:'Perfil de Luna'}).waitFor({state:'detached'})
    assert.equal(state.reactions.length,0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/swipe-participants-${width}.png`})
  } finally { await ctx.close() }
})
