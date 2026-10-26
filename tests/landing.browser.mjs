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
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const postcss = createRequire(require.resolve('autoprefixer'))('postcss')

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

test('idioma escolhido na home é aplicado ao retomar o swipe preservando filme, votos e região',async()=>{
  const {ctx,page,state}=await context({locale:'en-US',serviceWorkers:'block'})
  try{
    await page.goto(sessionUrl.href)
    await page.getByRole('button',{name:'Want to watch',exact:true}).waitFor()
    const title=await page.locator('.swipe-film-title').textContent()
    assert.equal(await page.locator('.language-select').count(),0)
    const localizedDetails=page.waitForResponse(response=>response.url().includes('/functions/v1/movie_details')&&new URL(response.url()).searchParams.get('language')==='es-ES')
    await page.goto(baseUrl)
    await page.getByRole('button',{name:'Interface language',exact:true}).click(); await page.getByRole('menuitemradio',{name:/Español/}).click(); await page.evaluate(()=>window.scrollTo(0,0))
    await page.goto(sessionUrl.href)
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
    await page.goto(baseUrl)
    await page.getByRole('button',{name:'Idioma de la interfaz',exact:true}).click(); await page.getByRole('menuitemradio',{name:/Português/}).click(); await page.evaluate(()=>window.scrollTo(0,0))
    await page.goto(sessionUrl.href)
    await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor()
    assert.equal(await page.locator('.swipe-film-title').textContent(),next)
    assert.equal(state.reactions.length,1)
  }finally{await ctx.close()}
})

test('nova sala usa a região do navegador, separada do idioma escolhido manualmente',async()=>{
  const {ctx,page,state}=await context({locale:'en-CA',serviceWorkers:'block'})
  try{
    await page.goto(baseUrl)
    await page.getByRole('button',{name:'Interface language',exact:true}).click(); await page.getByRole('menuitemradio',{name:/Español/}).click(); await page.evaluate(()=>window.scrollTo(0,0))
    await page.getByRole('button',{name:'Crear una sesión',exact:true}).click()
    await page.waitForURL(sessionUrl.href)
    const setting=state.requests.find(x=>x.path.includes('/rest/v1/session_filters')&&x.method==='POST')
    assert.equal(setting.body.watch_region,'CA')
    assert.equal(state.creates,1)
  }finally{await ctx.close()}
})

test('anúncio lento permanece montado e só se oculta quando o Google informa unfilled',async()=>{
  const {ctx,page}=await context({viewport:{width:1440,height:900}})
  try{
    await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/,route=>route.fulfill({contentType:'application/javascript',body:'window.adsbygoogle=window.adsbygoogle||[];'}))
    await page.goto(sessionUrl.href)
    await page.waitForFunction(()=>window.adsbygoogle?.length===2)
    await page.waitForTimeout(2000)
    assert.equal(await page.locator('.swipe-ad ins.adsbygoogle').count(),2)
    await page.locator('.swipe-ad-left ins').evaluate(el=>el.setAttribute('data-ad-status','filled'))
    await page.locator('.swipe-ad-right ins').evaluate(el=>el.setAttribute('data-ad-status','filled'))
    assert.equal(await page.locator('.swipe-ad-right').isVisible(),true)
    assert.equal(await page.locator('.swipe-ad-left').isVisible(),true)
    await page.locator('.swipe-ad-left ins').evaluate(el=>el.setAttribute('data-ad-status','unfilled'))
    await page.waitForFunction(()=>document.querySelector('.swipe-ad-left [data-ad-empty=true]'))
    assert.equal(await page.locator('.swipe-ad-left').isVisible(),false)
    assert.equal(await page.locator('.swipe-ad-right ins').count(),1)
  }finally{await ctx.close()}
})
after(async () => { await browser?.close(); server?.kill() })

test('anotações: pôster maior, controles proporcionais e dicas separadas mesmo com hover em 1536x724', async () => {
  const { ctx, page } = await context({ viewport: { width: 1536, height: 724 } })
  try {
    await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, route => route.fulfill({ contentType: 'application/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];' }))
    await page.goto(sessionUrl.href)
    const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
    await like.waitFor()
    await page.evaluate(() => document.fonts.ready)
    const poster = await page.locator('.swipe-poster-frame').boundingBox()
    assert.ok(poster.height >= 430, JSON.stringify(poster))
    assert.ok((await like.boundingBox()).width <= 64)
    const tabs = await page.getByRole('toolbar', { name: 'Conheça o filme' }).boundingBox()
    assert.ok(tabs.x >= poster.x + poster.width + 8, 'film controls must leave the entire poster visible')
    await like.hover()
    await delay(600)
    const hovered = await like.boundingBox()
    const hint = await page.locator('.cinema-vote-actions .cinema-dock-shortcut').last().boundingBox()
    assert.ok(hovered.width <= 80, JSON.stringify(hovered))
    assert.ok(hint.y >= hovered.y + hovered.height + 8, 'keyboard hints must clear the enlarged button')
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1), false)
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/swipe-proportions-1536.png' })
    await page.setViewportSize({ width: 1440, height: 1200 })
    const reviews = page.getByRole('button', { name: 'Avaliações dos usuários' })
    await reviews.hover()
    const tooltip = await reviews.locator('../..').locator('.cinema-dock-label').boundingBox()
    const advertisement = await page.locator('.swipe-ad-right').boundingBox()
    assert.ok(tooltip.x + tooltip.width + 8 <= advertisement.x, 'film tooltips must not cover advertisements on tall screens')
  } finally { await ctx.close() }
})

test('anotações: compartilhar mantém fundo até a base, sem rodapé de idioma nem barra branca', async () => {
  const { ctx, page } = await context({ viewport: { width: 1536, height: 724 } })
  try {
    await page.goto(sessionUrl.href)
    await page.getByRole('button', { name: 'Compartilhar sessão' }).click()
    await page.getByRole('dialog', { name: 'Convidar para a sessão' }).waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('.cinema-share-action')].every(el => getComputedStyle(el).opacity === '1'))
    assert.equal(await page.locator('.site-language-footer').count(), 0)
    const box = await page.locator('.swipe-page').boundingBox()
    assert.equal(box.y + box.height, 724)
    assert.equal(await page.evaluate(() => !!document.elementFromPoint(5, innerHeight - 2)?.closest('.swipe-page')), true)
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/swipe-share-1536.png' })
  } finally { await ctx.close() }
})

test('anotações: resumo dos filtros acomoda um ou vários chips sem barras de rolagem', async () => {
  const { ctx, page } = await context({ viewport: { width: 1536, height: 724 } })
  try {
    await page.route(/\/rest\/v1\/users\?/, route => route.fulfill({ json: { id: '11111111-1111-4111-8111-111111111111', is_adult: true } }))
    await page.route(/\/rest\/v1\/session_filters\?/, route => route.fulfill({ json: { include_adult: true } }))
    await page.goto(sessionUrl.href)
    await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
    const summary = page.locator('.filter-summary-chips')
    await summary.getByRole('button', { name: 'Remover filtro: Conteúdo adulto' }).hover()
    await delay(400)
    assert.equal(await summary.evaluate(el => getComputedStyle(el).overflowX), 'visible')
    assert.equal(await summary.evaluate(el => getComputedStyle(el).overflowY), 'visible')
    await page.getByRole('button', { name: 'Gêneros', exact: true }).click()
    for (const name of ['Ação', 'Aventura', 'Animação', 'Comédia', 'Drama']) await page.getByRole('button', { name, exact: true }).first().click()
    await page.setViewportSize({ width: 320, height: 740 })
    const chips = await summary.locator('button').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right } }))
    assert.ok(chips.every(r => r.left >= 0 && r.right <= 320), JSON.stringify(chips))
    assert.equal(await summary.evaluate(el => getComputedStyle(el).flexWrap), 'wrap')
    assert.equal(await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).isVisible(), true)
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/filter-summary-320.png' })
  } finally { await ctx.close() }
})

test('anotações: seletor de idioma existe somente na página inicial e a preferência persiste', async () => {
  const { ctx, page } = await context()
  try {
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Idioma da interface', exact: true }).click()
    await page.getByRole('menuitemradio', { name: /Español/ }).click()
    for (const path of ['/s/DEMO01', '/s/DEMO01/matches', '/conta', '/assistidos', '/perfil']) {
      await page.goto(new URL(path, baseUrl).href)
      await page.locator('main').waitFor()
      await page.waitForFunction(() => document.documentElement.lang === 'es-ES')
      assert.equal(await page.locator('.language-select').count(), 0, path)
      assert.equal(await page.locator('html').getAttribute('lang'), 'es-ES')
    }
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Idioma de la interfaz', exact: true }).waitFor()
  } finally { await ctx.close() }
})

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`AdSense em ${width}px: solicita somente espaços visíveis, separados dos votos`, async () => {
    const height = width === 320 ? 844 : 900
    const { ctx, page, state } = await context({ viewport: { width, height } })
    try {
      await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, route => route.fulfill({ contentType: 'application/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];' }))
      await page.goto(sessionUrl.href)
      await page.waitForFunction(count => window.adsbygoogle?.length === count, width >= 1400 ? 2 : 1)
      const visible = page.locator('ins.adsbygoogle:visible')
      assert.equal(await visible.count(), width >= 1400 ? 2 : 1)
      assert.equal(await page.locator('ins.adsbygoogle').count(), width >= 1400 ? 2 : 1, 'hidden, uninitialized units must not enter the Google queue')
      for (const ad of await visible.all()) {
        const box = await ad.boundingBox()
        assert.equal(box.width, 300)
        assert.equal(box.height, width >= 1400 ? 250 : 50)
        assert.ok(box.x >= 0 && box.x + box.width <= width)
        assert.equal(await ad.getAttribute('data-ad-format'), null, 'fixed dimensions must not be overridden by auto sizing')
        if (width < 1400) {
          const poster = await page.locator('.swipe-poster-frame').boundingBox()
          assert.ok(box.y + box.height + 24 <= poster.y, 'keep the ad away from swipe interactions')
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const vote = await page.getByRole('button', { name: 'Quero assistir', exact: true }).boundingBox()
      assert.ok(vote.y + vote.height <= height, 'voting must remain on screen')
      await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('.is-undo').disabled)
      assert.equal(state.reactions.length, 1)
      if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/adsense-${width}.png` })
    } finally { await ctx.close() }
  })
}

for (const scenario of ['premium', 'adult', 'empty']) {
  test(`AdSense não carrega em sessão ${scenario}`, async () => {
    const { ctx, page } = await context()
    let loads = 0
    try {
      await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, route => { loads++; return route.fulfill({ contentType: 'application/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];' }) })
      await page.route(/\/rest\/v1\/users\?/, route => route.fulfill({ json: { id: '11111111-1111-4111-8111-111111111111', is_adult: scenario === 'adult', is_premium: scenario === 'premium' } }))
      if (scenario === 'adult') await page.route(/\/rest\/v1\/session_filters\?/, route => route.fulfill({ json: { include_adult: true } }))
      if (scenario === 'empty') await page.route(/\/functions\/v1\/discover/, route => route.fulfill({ json: { page: 1, total_pages: 1, results: [] } }))
      await page.goto(sessionUrl.href)
      await page.locator('.swipe-page').waitFor()
      await page.waitForTimeout(300)
      assert.equal(loads, 0)
      assert.equal(await page.locator('ins.adsbygoogle').count(), 0)
    } finally { await ctx.close() }
  })
}

test('AdSense preserva as unidades ao redimensionar e permite carregar novamente após uma falha de rede', async () => {
  const { ctx, page } = await context({ viewport: { width: 390, height: 844 } })
  let attempts = 0
  try {
    await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, route => {
      attempts++
      return attempts === 1 ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];' })
    })
    await page.goto(sessionUrl.href)
    await page.locator('.swipe-mobile-ad [data-ad-empty=true]').waitFor({ state: 'attached' })
    assert.equal(await page.locator('.swipe-mobile-ad').isVisible(), false)
    assert.equal(await page.locator('.adblock-notice').count(), 0, 'network failure alone is not adblock')
    await page.locator('.swipe-header a[href="/"]').first().click()
    await page.getByRole('button', { name: 'Criar uma sessão', exact: true }).click()
    await page.waitForURL(sessionUrl.href)
    await page.waitForFunction(() => window.adsbygoogle?.length === 1)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForFunction(() => window.adsbygoogle?.length === 3)
    assert.equal(await page.locator('ins.adsbygoogle:visible').count(), 2)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.swipe-mobile-ad ins').waitFor({ state: 'visible' })
    assert.equal(await page.evaluate(() => window.adsbygoogle.length), 3, 'resizing must not refresh an initialized unit')
    assert.equal(attempts, 2, 'one shared script per page')
    await page.locator('.swipe-mobile-ad ins').evaluate(el => el.setAttribute('data-ad-status', 'unfilled'))
    await page.locator('.swipe-mobile-ad').waitFor({ state: 'hidden' })
  } finally { await ctx.close() }
})

for (const [width, height] of [[320, 568], [844, 390]]) {
test(`AdSense não solicita faixa em tela baixa de ${width}x${height}`, async () => {
  const { ctx, page } = await context({ viewport: { width, height } })
  let loads = 0
  try {
    await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, route => { loads++; return route.fulfill({ contentType: 'application/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];' }) })
    await page.goto(sessionUrl.href)
    await page.locator('.swipe-page').waitFor()
    await page.waitForTimeout(300)
    assert.equal(loads, 0)
    assert.equal(await page.locator('ins.adsbygoogle:visible').count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Quero assistir', exact: true }).isVisible(), true)
  } finally { await ctx.close() }
})
}

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
    else if (path.includes('/rpc/set_birthdate')) result = body.p_birthdate
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

test('Gateway Flow nativo mantém referência preservada, desenha e pausa sem bloquear votos', async () => {
  for (const [path,sha] of [
    ['neuform-isolated/NeuformBatchEffects.tsx','dc68c51bea26b922965de44b4fb8d6c432607508fb2b61e16ed60d245da1a69f'],
    ['neuform-isolated/sources/gateway-flow.html','c5a1de43138ffba96b9f0ecdcf3c054ae251ec94344e88c6ad502bae362b17d0'],
    ['threeui.css','efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf'],
  ]) assert.equal(createHash('sha256').update(await readFile(new URL('../src/shaders/'+path,import.meta.url))).digest('hex'),sha)
  const {ctx,page,state}=await context({viewport:{width:1440,height:900},deviceScaleFactor:3})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.goto(sessionUrl.href)
    const background=page.locator('.swipe-background')
    await page.waitForFunction(()=>document.querySelector('.swipe-flow-lines')?.width>0)
    assert.equal(await background.evaluate(el=>el.inert),true)
    assert.equal(await background.locator('iframe').count(),0)
    const hash=()=>page.locator('.swipe-flow-particles').evaluate(c=>{
      const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data
      let hash=0;for(let i=3;i<data.length;i+=4)hash=(hash*31+data[i])|0
      return hash
    })
    assert.ok(await page.locator('.swipe-flow-lines').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((n,i)=>i%4===3&&n>0)))
    const first=await hash();await delay(180);assert.notEqual(await hash(),first)
    for(const [width,height] of [[1440,900],[390,844],[844,390]]){
      await page.setViewportSize({width,height})
      await page.waitForFunction(w=>document.querySelector('.swipe-flow-lines').width===Math.round(w*1.5),width)
      assert.deepEqual(await background.boundingBox(),{x:0,y:0,width,height})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    }
    await page.getByRole('button',{name:'Abrir filtros',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.swipe-background').dataset.animated==='false')
    const stopped=await hash();await delay(180);assert.equal(await hash(),stopped)
    await page.keyboard.press('Escape')
    await page.waitForFunction(()=>document.querySelector('.swipe-background').dataset.animated==='true')
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.waitForFunction(()=>document.querySelector('.swipe-background').dataset.animated==='false')
    const still=await hash();await delay(180);assert.equal(await hash(),still)
    assert.equal(await background.isVisible(),true,'reduced motion keeps a static background')
    await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
    await page.waitForFunction(()=>!document.querySelector('.is-undo').disabled)
    assert.equal(state.reactions.at(-1).value,1)
    await page.getByRole('button',{name:'Desfazer',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.is-undo').disabled)
    assert.equal(await page.getByText('Último swipe desfeito',{exact:true}).count(),0)
    assert.deepEqual(errors,[])
  }finally{await ctx.close()}
})

for (const width of [320, 390, 768, 781, 1440]) {
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
      const example = page.locator('.cinema-match-example')
      await example.scrollIntoViewIfNeeded()
      const alignment = await example.evaluate(element => {
        const poster = element.querySelector('.cinema-poster').getBoundingClientRect()
        const card = element.querySelector('figcaption').getBoundingClientRect()
        return Math.abs(poster.x + poster.width / 2 - card.x - card.width / 2)
      })
      assert.ok(alignment < 1, 'Session card must share the poster center')
      if (process.env.VISUAL_CAPTURE_DIR) await example.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/home-session-card-${width}.png` })
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
      const circleWidth = await button.locator('.cinema-button-circle').evaluate(e=>e.getBoundingClientRect().width)
      await button.hover()
      const arrow = button.locator('.cinema-button-arrow svg')
      await arrow.evaluate(element => {
        const animation = element.getAnimations().find(animation => animation instanceof CSSAnimation)
        animation.pause()
        animation.currentTime = 10
      })
      const movement = await arrow.evaluate(element => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return [Math.sign(matrix.m41), Math.sign(matrix.m42)]
      })
      assert.deepEqual(movement, [xSign, ySign])
      await page.waitForFunction(element => getComputedStyle(element.querySelector('.cinema-button-circle')).clipPath.startsWith('inset(0px round'), await button.elementHandle())
      assert.equal(await button.locator('.cinema-button-circle').evaluate(e=>e.getBoundingClientRect().width),circleWidth)
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
    assert.equal(await like.locator('.filled').evaluate(element => getComputedStyle(element).animationName), 'none')
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
    await page.getByRole('dialog').waitFor({state:'hidden'})
    await page.keyboard.press('ArrowRight')
    for (let attempt = 0; attempt < 50 && state.reactions.length === 0; attempt++) await delay(100)
    assert.equal(state.reactions.length, 1)
    await dismiss.click()
    await page.locator('.adblock-notice').waitFor({state:'detached'})
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mm:ads-notice-dismissed:v2')), null)
    await page.reload()
    await page.getByRole('button', { name: 'Abrir filtros' }).waitFor()
    await page.locator('.adblock-notice').waitFor()
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

for (const [width, height] of [[390, 844], [768, 1024], [1074, 884], [1101, 884], [1440, 900], [320, 568], [390, 1000], [844, 390]]) {
  test(`swipe editorial ${width}x${height}: pôster 2:3 e controles dentro da tela`, async () => {
    const { ctx, page } = await context({ viewport: { width, height }, reducedMotion: 'reduce' })
    try {
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(sessionUrl.href)
      await page.getByRole('button', { name: 'Quero assistir', exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('.swipe-poster-image')?.classList.contains('is-ready'))
      await page.getByRole('button', { name: 'Ver participantes da sessão' }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      const layout = await page.evaluate(() => {
        const bounds = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
        return { poster: bounds(document.querySelector('.swipe-poster-frame')), members: bounds(document.querySelector('.swipe-header-members')), actions: bounds(document.querySelector('.swipe-header-actions')), buttons: [...document.querySelectorAll('.cinema-vote-button')].map(bounds), tabs: [...document.querySelectorAll('.swipe-carousel-tabs button')].map(bounds), header: bounds(document.querySelector('.swipe-header')), scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, height: innerHeight, width: innerWidth }
      })
      assert.ok(Math.abs(layout.poster.width / layout.poster.height - 2 / 3) < .01, JSON.stringify(layout.poster))
      assert.ok(layout.poster.height > 140)
      assert.ok(Math.abs((layout.members.left + layout.members.right) / 2 - width / 2) < 2, JSON.stringify(layout.members))
      assert.ok(layout.members.top <= layout.actions.top + 1, JSON.stringify(layout))
      assert.ok(Math.abs((layout.poster.left + layout.poster.right) / 2 - width / 2) < 2, JSON.stringify(layout.poster))
      const voteCenter = (Math.min(...layout.buttons.map(button => button.left)) + Math.max(...layout.buttons.map(button => button.right))) / 2
      assert.ok(Math.abs(voteCenter - width / 2) < 2, JSON.stringify(layout.buttons))
      const centers = layout.buttons.map(button => (button.top + button.bottom) / 2)
      assert.ok(Math.max(...centers) - Math.min(...centers) < 1, JSON.stringify(layout.buttons))
      assert.equal(await page.locator('.swipe-film-copy').count(), 0)
      assert.ok(layout.scrollWidth <= width)
      assert.ok(layout.scrollHeight <= height + 1)
      assert.ok(layout.buttons.every(button => button.top >= 0 && button.bottom <= height && button.left >= 0 && button.right <= width), JSON.stringify(layout.buttons))
      assert.ok(layout.tabs.every(tab => tab.left >= 0 && tab.right <= width && tab.top >= 0 && tab.bottom <= height), JSON.stringify(layout.tabs))
      assert.ok(layout.tabs.every(tab => tab.left >= layout.poster.right || tab.top >= layout.poster.bottom), 'the dock must not cover the poster')
      assert.ok(layout.tabs.every(tab => tab.bottom <= Math.min(...layout.buttons.map(button => button.top)) || tab.left >= layout.poster.right), 'film and voting controls remain separate')
      assert.deepEqual(errors, [])
      if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + `/swipe-modern-${width}x${height}.png` })
    } finally { await ctx.close() }
  })
}

// Feature removal in Chromium isolates fallbacks; it does not emulate an old browser engine.
for (const feature of ['viewport', 'container', 'has']) {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    test(`compatibilidade por retirada de CSS ${feature} em ${width}x${height}: home e swipe continuam utilizáveis`, async () => {
      const { ctx, page, state } = await context({ viewport: { width, height }, reducedMotion: 'reduce' })
      page.setDefaultTimeout(5000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      let removed = 0
      if (feature === 'container') await ctx.addInitScript(() => {
        const supports = CSS.supports.bind(CSS)
        CSS.supports = (...args) => args.some(value => /cq[wh]/i.test(value)) ? false : supports(...args)
      })
      await ctx.route(/\/assets\/[^/?]+\.css(?:\?|$)/, async route => {
        const response = await route.fetch()
        const css = postcss.parse(await response.text())
        const unsupported = feature === 'viewport' ? /\b\d*(?:\.\d+)?[ds]vh\b/i : /\b\d*(?:\.\d+)?cq[wh]\b|container-type/i
        if (feature === 'has') css.walkRules(rule => { if (rule.selector.includes(':has(')) { removed++; rule.remove() } })
        else {
          css.walkAtRules('supports', rule => { if (unsupported.test(rule.params)) { removed++; rule.remove() } })
          css.walkDecls(declaration => { if (unsupported.test(`${declaration.prop}:${declaration.value}`)) { removed++; declaration.remove() } })
        }
        await route.fulfill({ response, body: css.toString() })
      })
      try {
        await page.goto(baseUrl)
        await page.getByRole('heading', { name: /A escolha de todos/ }).waitFor()
        if (feature === 'container') {
          assert.equal(await page.evaluate(() => CSS.supports('width', '1cqw')), false)
          await page.waitForFunction(() => [...document.querySelectorAll('.image-stream-card')].length > 0 && [...document.querySelectorAll('.image-stream-card')].every(element => element.offsetWidth > 0 && element.offsetHeight > 0))
          const cards = await page.locator('.image-stream-card').evaluateAll(elements => elements.map(element => ({ width: element.offsetWidth, height: element.offsetHeight, unit: getComputedStyle(element).getPropertyValue('--image-stream-unit').trim() })))
          assert.ok(cards.every(card => card.width > 0 && card.height > 0 && /^\d+(?:\.\d+)?px$/.test(card.unit)), JSON.stringify(cards))
        }
        const example = page.locator('.cinema-match-example .cinema-poster')
        await example.scrollIntoViewIfNeeded()
        const homePoster = await example.boundingBox()
        assert.ok(homePoster.width > 0 && homePoster.height > 0, JSON.stringify(homePoster))
        assert.ok(Math.abs(homePoster.width / homePoster.height - 2 / 3) < .01, JSON.stringify(homePoster))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.goto(sessionUrl.href)
        const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
        await like.waitFor()
        await page.waitForFunction(() => document.querySelector('.swipe-poster-image')?.classList.contains('is-ready'))
        await page.evaluate(() => document.fonts.ready)
        const layout = await page.evaluate(() => {
          const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
          return { poster: rect(document.querySelector('.swipe-poster-frame')), page: rect(document.querySelector('.swipe-page')), buttons: [...document.querySelectorAll('.cinema-vote-button')].map(rect), scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }
        })
        assert.ok(removed > 0, 'The served CSS must contain the feature removed by this regression test')
        assert.ok(layout.poster.width > 0 && layout.poster.height > 0, JSON.stringify(layout))
        assert.ok(Math.abs(layout.poster.width / layout.poster.height - 2 / 3) < .01, JSON.stringify(layout.poster))
        assert.ok(layout.scrollWidth <= width && layout.scrollHeight <= height + 1, JSON.stringify(layout))
        assert.ok(layout.page.top >= 0 && Math.abs(layout.page.height - height) <= 1 && layout.page.bottom <= height + 1, JSON.stringify(layout.page))
        assert.equal(await page.locator('.site-language-footer').count(), 0)
        assert.ok(layout.buttons.length > 0 && layout.buttons.every(button => button.width > 0 && button.height > 0 && button.top >= 0 && button.bottom <= height && button.left >= 0 && button.right <= width), JSON.stringify(layout.buttons))
        const title = await page.locator('.swipe-film-title').textContent()
        await like.click()
        await page.waitForFunction(previous => document.querySelector('.swipe-film-title')?.textContent !== previous, title)
        assert.equal(state.reactions.length, 1)
        assert.deepEqual(errors, [])
      } finally { await ctx.close() }
    })
  }
}

for (const feature of ['MediaQueryList.addEventListener', 'ResizeObserver']) {
  test(`compatibilidade por retirada de ${feature}: home carrega e swipe registra voto`, async () => {
    const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(5000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await ctx.addInitScript(feature => {
      if (feature === 'ResizeObserver') window.ResizeObserver = undefined
      else {
        // Bind the legacy API before removing modern methods; Chromium's alias uses them internally.
        const add = EventTarget.prototype.addEventListener
        const remove = EventTarget.prototype.removeEventListener
        Object.defineProperties(MediaQueryList.prototype, {
          addListener: { configurable: true, value(listener) { add.call(this, 'change', listener) } },
          removeListener: { configurable: true, value(listener) { remove.call(this, 'change', listener) } },
          addEventListener: { configurable: true, value: undefined },
          removeEventListener: { configurable: true, value: undefined },
        })
      }
    }, feature)
    try {
      await page.goto(baseUrl)
      await page.getByRole('heading', { name: /A escolha de todos/ }).waitFor()
      await page.evaluate(() => window.scrollTo(0, 700))
      const top = page.getByRole('button', { name: 'Voltar ao topo' })
      await top.waitFor()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await top.click()
      await page.waitForFunction(() => window.scrollY === 0)
      await page.goto(sessionUrl.href)
      const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
      await like.waitFor()
      const title = await page.locator('.swipe-film-title').textContent()
      await like.click()
      await page.waitForFunction(previous => document.querySelector('.swipe-film-title')?.textContent !== previous, title)
      assert.equal(state.reactions.length, 1)
      assert.deepEqual(errors, [])
    } finally { await ctx.close() }
  })
}

test('compatibilidade por retirada de dialog.showModal/close: tutorial mantém foco, bloqueia votos e fecha com Escape', async () => {
  const { ctx, page, state } = await context({ tutorial: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(5000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await ctx.addInitScript(() => {
    HTMLDialogElement.prototype.showModal = undefined
    HTMLDialogElement.prototype.close = undefined
    sessionStorage.setItem('mm:created-session', '22222222-2222-4222-8222-222222222222')
  })
  try {
    await page.goto(sessionUrl.href)
    const dialog = page.getByRole('dialog', { name: 'Como votar no MovieMatch' })
    await dialog.waitFor()
    await page.getByRole('heading', { name: /Seu gosto entra/ }).waitFor()
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true)
    }
    await page.keyboard.press('ArrowRight')
    assert.equal(state.reactions.length, 0)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    const like = page.getByRole('button', { name: 'Quero assistir', exact: true })
    const title = await page.locator('.swipe-film-title').textContent()
    await like.click()
    await page.waitForFunction(previous => document.querySelector('.swipe-film-title')?.textContent !== previous, title)
    assert.equal(state.reactions.length, 1)
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})

test('compatibilidade por retirada de popover: participantes mantêm teclado, fechamento e posicionamento', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(5000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await ctx.addInitScript(() => {
    for (const name of ['showPopover', 'hidePopover', 'togglePopover']) HTMLElement.prototype[name] = undefined
    const matches = Element.prototype.matches
    Element.prototype.matches = function (selector) {
      if (selector.includes(':popover-open')) throw new DOMException('Unsupported pseudo-class', 'SyntaxError')
      return matches.call(this, selector)
    }
    const querySelector = Document.prototype.querySelector
    Document.prototype.querySelector = function (selector) {
      if (selector.includes(':popover-open')) throw new DOMException('Unsupported pseudo-class', 'SyntaxError')
      return querySelector.call(this, selector)
    }
  })
  try {
    await page.goto(sessionUrl.href)
    const trigger = page.getByRole('button', { name: 'Ver participantes da sessão', exact: true })
    await trigger.waitFor()
    const panel = page.locator('.session-participants-panel')
    assert.equal(await panel.isVisible(), false)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    await trigger.click(); await panel.waitFor()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(await panel.evaluate(element => getComputedStyle(element).opacity), '1')
    const bounds = await panel.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844)
    assert.ok(await panel.locator('.session-participant').count() > 0)
    await page.keyboard.press('ArrowRight'); assert.equal(state.reactions.length, 0)
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
    await trigger.press('Enter'); await panel.waitFor()
    await page.setViewportSize({ width: 400, height: 844 }); await panel.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
    await trigger.click(); await panel.waitFor()
    await page.mouse.click(2, 842); await panel.waitFor({ state: 'hidden' })
    await trigger.click(); await panel.waitFor()
    await panel.getByRole('button', { name: 'Fechar participantes', exact: true }).click()
    await panel.waitFor({ state: 'hidden' })
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(state.reactions.length, 0)
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})

test('pôster, trailer e sinopse usam clique/Tab; as setas votam mesmo com foco nesses botões', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await ctx.route(/\/functions\/v1\/movie_details/, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tmdb_id: 157336, title: 'Interestelar', year: 2014, runtime: 169, vote_average: 8.6, genres: [{ id: 878, name: 'Ficção científica' }], age_rating: '12', trailer: { key: 'fixture' }, overview: 'Uma viagem além das estrelas. '.repeat(80) }) }))
  await ctx.route(/youtube\.com\/embed/, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><button>Reproduzir</button>' }))
  try {
    await page.goto(sessionUrl.href)
    const poster = page.getByRole('button', { name: 'Pôster', exact: true })
    const trailer = page.getByRole('button', { name: 'Trailer', exact: true })
    await trailer.waitFor()
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport)
      const image = await page.locator('.swipe-poster-frame').boundingBox()
      for (const button of await page.locator('.swipe-carousel-tabs button').all()) {
        const box = await button.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44, 'film controls retain touch targets')
        assert.ok(box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height)
        assert.ok(box.x >= image.x + image.width || box.y >= image.y + image.height, 'all four controls must stay off the poster')
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
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
    await page.getByLabel('Mais opções da sessão', { exact: true }).click()
    await help.click()
    await dialog.waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await page.getByLabel('Mais opções da sessão', { exact: true }).evaluate(element => element === document.activeElement), true)
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
      if (!touch) await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.is-like').parentElement).transform).a > 1.1)
      else assert.equal(await control.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a), 1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.is-like').parentElement).transform).a === 1)
      assert.equal(await page.locator('.cinema-dock [role="button"]').count(), 0, 'Os controles mantêm botões nativos, sem botões aninhados.')
      assert.equal(await page.getByRole('button', { name: 'Desfazer', exact: true }).isDisabled(), true)
      if (process.env.VISUAL_CAPTURE_DIR && !touch) {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await like.hover()
        await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.is-like').parentElement).transform).a > 1.1)
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

for (const width of [320, 768, 1024, 1440]) {
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
      assert.equal(await dialog.evaluate(el => el.matches(':modal')), true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const bounds = await dialog.boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
      await dialog.evaluate(el => [...el.querySelectorAll('button:not(:disabled)')].filter(button => button.getClientRects().length).at(-1).focus())
      await page.keyboard.press('Tab')
      assert.equal(await dialog.getByRole('button', { name: 'Fechar', exact: true }).evaluate(el => el === document.activeElement), true)
      if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/filters-' + width + '.png' })
      assert.equal(await dialog.getByRole('button', { name: 'Filtros aplicados' }).isDisabled(), true)
      for (const name of ['Gêneros', 'Período e duração', 'Qualidade e idioma', 'Avançado', 'Onde assistir']) {
        await dialog.getByRole('button', { name, exact: true }).click()
        assert.equal(await dialog.locator('.filter-content').evaluate(el => el.scrollWidth > el.clientWidth), false, name + ' must fit its panel')
      }
      assert.equal(await dialog.locator('button:not(.cinema-filter-button)').count(), 0)
      if (width === 1440) {
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
      const region = dialog.getByRole('combobox', { name: 'Região do catálogo', exact: true })
      await region.selectOption('US')
      await dialog.getByRole('button', { name: /^Período e duração/ }).click()
      await dialog.getByRole('button', { name: 'Aumentar De', exact: true }).click()
      assert.equal(await dialog.getByRole('spinbutton', { name: 'De', exact: true }).inputValue(), '1991')
      await dialog.getByRole('button', { name: 'Limpar filtros', exact: true }).click()
      assert.equal(await dialog.getByRole('spinbutton', { name: 'De', exact: true }).inputValue(), '1990')
      assert.equal(await dialog.getByRole('button', { name: 'Filtros aplicados' }).isDisabled(), true)
      await dialog.getByRole('button', { name: 'Onde assistir', exact: true }).click()
      assert.equal(await netflix.getAttribute('aria-pressed'), 'false')
      await netflix.click()
      await region.selectOption('US')
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
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.equal(state.requests.filter(request => request.path.includes('/rest/v1/session_filters') && request.method === 'POST').length, 1)
      assert.equal(await page.getByRole('button', { name: 'Abrir filtros', exact: true }).evaluate(el => el === document.activeElement), true)
      assert.deepEqual(errors, [])
    } finally { await ctx.close() }
  })
}

for (const width of [390, 957]) test('salvar sala exibe texto apenas no computador em '+width+'px', async () => {
  const { ctx, page } = await context({ viewport: { width, height: 884 } })
  try {
    await page.goto(sessionUrl.href)
    await page.locator('.swipe-more summary').click()
    const button = page.getByRole('button', { name: 'Salvar sala', exact: true })
    await button.waitFor()
    assert.equal(await button.locator('.account-save-label').isVisible(), width > 600)
    await button.click()
    await page.getByRole('heading', { name: 'Continuar outro dia?' }).waitFor()
  } finally { await ctx.close() }
})

test('filtros preservam gêneros exclusivos, autorização 18+ e rascunho após falha', async () => {
  const { ctx, page, state } = await context({ viewport: { width: 390, height: 884 } })
  try {
    await page.goto(sessionUrl.href)
    await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Encontre o filme certo' })
    await dialog.getByRole('button', { name: 'Gêneros', exact: true }).click()
    const action = dialog.getByRole('button', { name: 'Ação', exact: true })
    await action.nth(0).click(); await action.nth(1).click()
    assert.equal(await action.nth(0).getAttribute('aria-pressed'), 'false')
    assert.equal(await action.nth(1).getAttribute('aria-pressed'), 'true')
    await dialog.getByRole('button', { name: 'Avançado', exact: true }).click()
    await dialog.getByRole('button', { name: /Permitir conteúdo 18/ }).click()
    const age = page.getByRole('dialog', { name: 'Confirme sua idade' })
    await age.waitFor()
    assert.equal(await age.evaluate(el => el.matches(':modal')), true)
    await page.keyboard.press('Escape'); await age.waitFor({ state: 'detached' })
    assert.equal(await dialog.getByRole('button', { name: /Permitir conteúdo 18/ }).getAttribute('aria-pressed'), 'false')
    await dialog.getByRole('button', { name: /Permitir conteúdo 18/ }).click()
    await age.getByLabel('Data de nascimento').fill('2000-01-01')
    await age.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await age.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.querySelector('.filter-section:not([hidden]) button[aria-pressed=true]'))
    assert.equal(await dialog.getByRole('button', { name: /Permitir conteúdo 18/ }).getAttribute('aria-pressed'), 'true')
    let attempts = 0
    await page.route('**/rest/v1/session_filters*', async route => {
      if (route.request().method() !== 'POST') return route.fallback()
      attempts++
      if (attempts === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Test failure"}' })
      return route.fallback()
    })
    await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click()
    await dialog.getByRole('alert').waitFor({ timeout: 5000 })
    await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click()
    await dialog.waitFor({ state: 'detached' })
    const save = state.requests.find(req => req.path.includes('/rest/v1/session_filters') && req.method === 'POST')
    assert.deepEqual(save.body.genres, [])
    assert.deepEqual(save.body.exclude_genres, [28])
    assert.equal(save.body.include_adult, true)
    assert.equal(attempts, 2)
    assert.equal(state.reactions.length, 0)
  } finally { await ctx.close() }
})

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
    await participants.getByRole('button',{name:'Ver participantes da sessão',exact:true}).click()
    const panel=page.getByRole('dialog',{name:'Participantes da sessão'})
    await panel.getByRole('button',{name:/Luna/}).waitFor()
    assert.equal(await panel.locator('.member-avatar-trigger').count(),2); assert.equal(await panel.getByRole('button',{name:/Convidado/}).count(),0)
    await panel.getByRole('button',{name:/Perfil privado/}).focus()
    const privatePreview=page.getByRole('region',{name:'Perfil de Perfil privado'});await privatePreview.waitFor();await page.keyboard.press('ArrowRight');assert.equal(state.reactions.length,0);assert.equal(await privatePreview.getByRole('link').count(),0)
    const privateBounds=await privatePreview.boundingBox();assert.ok(privateBounds.x>=0&&privateBounds.x+privateBounds.width<=width&&privateBounds.y>=0&&privateBounds.y+privateBounds.height<=900)
    await page.keyboard.press('Escape');await privatePreview.waitFor({state:'detached'})
    await participants.getByRole('button',{name:'Ver participantes da sessão',exact:true}).click()
    await page.emulateMedia({reducedMotion:'reduce'});await panel.getByRole('button',{name:/Luna/}).hover()
    await page.getByRole('region',{name:'Perfil de Luna'}).waitFor()
    assert.equal(await panel.getByRole('button',{name:/Luna/}).locator('span').evaluate(el=>getComputedStyle(el).transform),'none')
    await page.keyboard.press('Escape');await page.getByRole('region',{name:'Perfil de Luna'}).waitFor({state:'detached'})
    assert.equal(state.reactions.length,0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/swipe-participants-${width}.png`})
  } finally { await ctx.close() }
})


test('otimização: Dock mantém largura e posição durante hover', async () => {
  const {ctx,page}=await context({viewport:{width:1536,height:724}})
  try {
    await page.goto(sessionUrl.href)
    const items=page.locator('.cinema-vote-actions .cinema-dock-item')
    await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor()
    await page.evaluate(()=>document.fonts.ready)
    const before=await items.evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})))
    await page.getByRole('button',{name:'Quero assistir',exact:true}).hover();await delay(250)
    const after=await items.evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})))
    assert.deepEqual(after,before)
  } finally {await ctx.close()}
})

test('otimização: campos de login e filtros usam 16px em toque', async () => {
  const {ctx,page}=await context({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  try {
    await page.goto(baseUrl+'/conta');await page.locator('input[type=email]').waitFor()
    assert.ok((await page.locator('input').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)))).every(n=>n>=16))
    await page.goto(sessionUrl.href);await page.getByRole('button',{name:'Abrir filtros',exact:true}).click()
    assert.ok((await page.locator('.filter-dialog input').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)))).every(n=>n>=16))
    assert.match(await page.locator('meta[name=viewport]').getAttribute('content'),/viewport-fit=cover/)
  }finally{await ctx.close()}
})

test('otimização: faixa mobile pode ser fechada sem afetar os votos', async () => {
  const {ctx,page,state}=await context({viewport:{width:390,height:844}})
  try {
    await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/,r=>r.fulfill({contentType:'application/javascript',body:'window.adsbygoogle=window.adsbygoogle||[];'}))
    await page.goto(sessionUrl.href)
    const close=page.getByRole('button',{name:'Fechar anúncio do topo',exact:true})
    await close.click();assert.equal(await page.locator('.swipe-mobile-ad').count(),0)
    await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
    await page.waitForFunction(()=>!document.querySelector('.is-undo').disabled)
    assert.equal(state.reactions.length,1)
    await page.reload();await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor()
    assert.equal(await page.locator('.swipe-mobile-ad').count(),0)
  }finally{await ctx.close()}
})

test('otimização: anúncio central em todas as telas, sem registrar voto ou atualizar automaticamente', async () => {
  const {ctx,page,state}=await context({viewport:{width:1536,height:900},reducedMotion:'reduce'})
  try {
    await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/,r=>r.fulfill({contentType:'application/javascript',body:'window.adsbygoogle=window.adsbygoogle||[];'}))
    await page.route(/\/functions\/v1\/discover/,r=>r.fulfill({json:{page:1,total_pages:1,results:Array.from({length:35},(_,i)=>({id:i+1,tmdb_id:157336+i,title:'Filme '+i,year:2014,poster_url:'/demo/interstellar.jpg'}))}}))
    await page.goto(sessionUrl.href)
    for(let i=0;i<14&&!await page.locator('.swipe-ad-card:visible').count();i++){
      await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
      await page.waitForFunction(()=>document.querySelector('.swipe-ad-card:not([hidden])')||!document.querySelector('.cinema-vote-button.is-like')?.disabled)
    }
    await page.locator('.swipe-ad-card ins:visible').waitFor()
    const votes=state.reactions.length
    const ad=await page.locator('.swipe-ad-card ins:visible').elementHandle()
    for(const [width,height] of [[1536,900],[911,668],[390,844],[844,390],[320,568]]){
      await page.setViewportSize({width,height});await delay(80)
      assert.equal(await page.locator('.swipe-ad-card ins:visible').count(),1)
      const box=await page.locator('.swipe-ad-card ins:visible').boundingBox()
      assert.equal(box.width,300);assert.equal(box.height,height<=500?50:250)
      assert.ok(box.x>=0&&box.x+box.width<=width)
      if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+'/central-ad-'+width+'x'+height+'.png'})
      const next=await page.getByRole('button',{name:'Quero assistir',exact:true}).boundingBox()
      assert.ok(next.y+next.height<=height)
      assert.equal(await page.locator('.swipe-ad-card').evaluate(e=>e.closest('[draggable=true]')!==null),false)
    }
    await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
    await page.waitForFunction(()=>!document.querySelector('.swipe-ad-card:not([hidden])'))
    await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor()
    assert.equal(state.reactions.length,votes)
    assert.equal(await ad.evaluate(e=>e.isConnected),true,'preserve the initialized unit between steps')
    assert.equal(await page.locator('.swipe-ad-card').isVisible(),false)
    const pushes=await page.evaluate(()=>window.adsbygoogle.length)
    for(let i=0;i<14&&!await page.locator('.swipe-ad-card:visible').count();i++){
      await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
      await page.waitForFunction(()=>document.querySelector('.swipe-ad-card:not([hidden])')||!document.querySelector('.cinema-vote-button.is-like')?.disabled)
    }
    assert.equal(await page.locator('.swipe-ad-card').isVisible(),true)
    assert.equal(await page.evaluate(()=>window.adsbygoogle.length),pushes,'revisiting the card must not refresh ads')
  }finally{await ctx.close()}
})


test('ajustes: cabeçalho compacto em 911x668 mantém pôster maior e participantes centralizados',async()=>{
 const {ctx,page}=await context({viewport:{width:911,height:668}})
 try{
  await page.goto(sessionUrl.href);await page.getByRole('button',{name:'Quero assistir',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready)
  const header=await page.locator('.swipe-header').boundingBox();const poster=await page.locator('.swipe-poster-frame').boundingBox();const members=await page.locator('.swipe-header-members').boundingBox()
  assert.ok(header.height<=76,JSON.stringify(header));assert.ok(poster.height>=450,JSON.stringify(poster))
  assert.ok(Math.abs(members.x+members.width/2-911/2)<2)
  if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+'/header-911x668.png'})
  await page.setViewportSize({width:911,height:390});await page.waitForFunction(()=>innerHeight===390&&document.querySelector('.swipe-header').getBoundingClientRect().height<=68)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 }finally{await ctx.close()}
})

test('ajustes: partículas se movem dos dois lados do fundo',async()=>{
 const {ctx,page}=await context({viewport:{width:911,height:668}})
 try{
  await page.goto(sessionUrl.href);await page.waitForFunction(()=>document.querySelector('.swipe-flow-particles')?.width>0)
  const hash=()=>page.locator('.swipe-flow-particles').evaluate(c=>{
   const ctx=c.getContext('2d'),w=Math.floor(c.width/2)
   return [0,w].map(x=>{const d=ctx.getImageData(x,0,w,c.height).data;let v=0;for(let i=3;i<d.length;i+=4)v=(v*31+d[i])|0;return v})
  })
  const before=await hash();await delay(180);const after=await hash()
  assert.notEqual(before[0],after[0]);assert.notEqual(before[1],after[1])
 }finally{await ctx.close()}
})

test('ajustes: seletor usa bandeiras gráficas, independente dos emojis do sistema',async()=>{
 const {ctx,page}=await context()
 try{
  await page.goto(baseUrl);const flag=page.locator('.language-trigger img');await flag.waitFor({timeout:2000})
  assert.match(await flag.getAttribute('src'),/br\.svg$/);assert.ok(await flag.evaluate(e=>e.complete&&e.naturalWidth>0))
  await page.getByRole('button',{name:'Idioma da interface',exact:true}).click();await page.getByRole('menuitemradio',{name:/English/}).click()
  assert.match(await flag.getAttribute('src'),/us\.svg$/)
 }finally{await ctx.close()}
})


test('ajustes: anúncio aceita recusar e gesto na moldura sem registrar votos nem capturar o criativo',async()=>{
 const {ctx,page,state}=await context({viewport:{width:911,height:668},reducedMotion:'reduce'})
 try{
  await page.route(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/,r=>r.fulfill({contentType:'application/javascript',body:'window.adsbygoogle=window.adsbygoogle||[];'}))
  await page.route(/\/functions\/v1\/discover/,r=>r.fulfill({json:{page:1,total_pages:1,results:Array.from({length:60},(_,i)=>({id:i+1,tmdb_id:157336+i,title:'Filme '+i,year:2014,poster_url:'/demo/interstellar.jpg'}))}}))
  await page.goto(sessionUrl.href)
  for(const action of ['pass','swipe']){
   for(let i=0;i<14&&!await page.locator('.swipe-ad-card:visible').count();i++){
    await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.swipe-ad-card:not([hidden])')||!document.querySelector('.cinema-vote-button.is-like')?.disabled)
   }
   await page.locator('.swipe-ad-card ins:visible').waitFor();const before=state.reactions.length
   await page.locator('.swipe-ad-card ins:visible').click();assert.equal(await page.locator('.swipe-ad-card').isVisible(),true)
   if(action==='pass')await page.getByRole('button',{name:'Passo',exact:true}).click()
   else{
    const label=await page.locator('.swipe-ad-card .cinema-eyebrow').boundingBox()
    await page.mouse.move(label.x+20,label.y+label.height/2);await page.mouse.down();await page.mouse.move(label.x+170,label.y+label.height/2,{steps:8});await page.mouse.up()
   }
   await page.waitForFunction(()=>!document.querySelector('.swipe-ad-card:not([hidden])'))
   assert.equal(state.reactions.length,before)
  }
 }finally{await ctx.close()}
})

test('ajustes: aviso de bloqueador é discreto, dispensável e não cobre votação',async()=>{
 const {ctx,page}=await context({viewport:{width:911,height:668}})
 try{
  await page.goto(sessionUrl.href)
  await page.addStyleTag({content:'.adsbox{display:none!important}'})
  const notice=page.getByRole('status',{name:'Ajude a manter o MovieMatch gratuito'})
  await notice.waitFor();assert.match(await notice.innerText(),/desative-o neste site/)
  const box=await notice.boundingBox(),vote=await page.getByRole('button',{name:'Quero assistir',exact:true}).boundingBox()
  assert.ok(box.height<=250,JSON.stringify(box));assert.ok(box.y>=vote.y+vote.height)
  await page.getByRole('button',{name:'Dispensar aviso de publicidade'}).click();await notice.waitFor({state:'detached'})
 }finally{await ctx.close()}
})

for (const blockedStorage of [false, true]) test('convidado mantém identidade e votos após dez recargas, localStorage bloqueado=' + blockedStorage, async () => {
  const { ctx, page } = await context({ tutorial: true, reducedMotion: 'reduce' })
  let signups = 0
  const votes = []
  if (blockedStorage) await ctx.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } }))
  await ctx.route(/supabase\.co\/auth\/v1\/signup/, async route => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(++signups).padStart(12, '0')
    const user = { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {} }
    const token = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.test'
    await route.fulfill({ json: { access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, user } })
  })
  await ctx.route(/supabase\.co\/rest\/v1\/reactions/, async route => {
    const req = route.request(), url = new URL(req.url())
    if (req.method() === 'POST') { votes.push(req.postDataJSON()); await route.fulfill({ contentType: 'application/json', body: 'null' }); return }
    await route.fulfill({ json: votes.filter(v => 'eq.' + v.user_id === url.searchParams.get('user_id')).map(v => ({ movie_id: v.movie_id })) })
  })
  await ctx.route(/supabase\.co\/rest\/v1\/movies/, route => {
    const req=route.request()
    const rows=[{id:1,tmdb_id:157336},{id:2,tmdb_id:194}]
    if(req.method()==='POST') return route.fulfill({json:{id:rows.find(row=>row.tmdb_id===req.postDataJSON().tmdb_id).id}})
    return route.fulfill({json:rows.filter(row=>votes.some(v=>v.movie_id===row.id))})
  })
  try {
    await page.goto(sessionUrl.href)
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.is-like').disabled)
    assert.equal(votes.length, 1)
    const uid = votes[0].user_id
    // The ad between movies advances without a vote.
    if (await page.locator('.swipe-page').getAttribute('data-ad-step') === 'true') {
      await page.getByRole('button', { name: 'Passo', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.swipe-page')?.dataset.adStep !== 'true' && !document.querySelector('.is-dislike').disabled)
    }
    await page.getByRole('button', { name: 'Passo', exact: true }).click()
    await page.locator('.swipe-empty').waitFor()
    assert.deepEqual(votes.map(v => v.value), [1, -1])
    assert.ok(votes.every(v => v.user_id === uid))
    for (let n = 0; n < 10; n++) {
      await page.reload()
      await page.locator('.swipe-header').waitFor()
      await page.locator('.swipe-empty').waitFor()
      await page.getByRole('button', { name: 'Abrir filtros', exact: true }).waitFor()
      assert.equal(signups, 1, 'refresh must not create another anonymous account')
      assert.equal(await page.locator('.swipe-poster-image img').count(), 0, 'already rated movies stay excluded')
    }
    assert.ok(uid)
    assert.equal(votes.length, 2)
  } finally { await ctx.close() }
})

test('sem armazenamento disponível não cria convidados descartáveis', async () => {
  const { ctx, page, state } = await context({ tutorial: true })
  await ctx.addInitScript(() => { for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('Blocked', 'SecurityError') } }) })
  try {
    await page.goto(sessionUrl.href)
    await page.getByText(/Permita o armazenamento deste site/).first().waitFor()
    await page.reload()
    await page.getByText(/Permita o armazenamento deste site/).first().waitFor()
    assert.equal(state.requests.filter(req => req.path.endsWith('/signup')).length, 0)
  } finally { await ctx.close() }
})

test('duas abas abertas juntas compartilham a mesma criação de convidado', async () => {
  const { ctx, page, state } = await context({ tutorial: true, reducedMotion: 'reduce' })
  await ctx.route(/supabase\.co\/auth\/v1\/signup/, async route => { await delay(150); await route.fallback() })
  const second = await ctx.newPage()
  await second.routeWebSocket(/supabase\.co/, socket => socket.close())
  try {
    await Promise.all([page.goto(sessionUrl.href), second.goto(sessionUrl.href)])
    await Promise.all([page.locator('.swipe-poster-image').waitFor(), second.locator('.swipe-poster-image').waitFor()])
    assert.equal(state.requests.filter(req => req.path.endsWith('/signup')).length, 1)
  } finally { await ctx.close() }
})

test('pôster mostra miniatura enquanto a imagem grande carrega e prepara a próxima imagem', async () => {
  const { ctx, page } = await context({ tutorial: true, reducedMotion: 'reduce' })
  const requested = []
  let release
  const fullImage = new Promise(resolve => { release = resolve })
  const movies = [1, 2, 3].map(n => ({ movie_id: n, tmdb_id: n, title: 'Filme ' + n, year: 2026, poster_url: 'https://image.tmdb.org/t/p/w500/poster-' + n + '.jpg', genres: [] }))
  await ctx.route(/supabase\.co\/functions\/v1\/discover/, route => route.fulfill({ json: { page: 1, total_pages: 1, results: movies } }))
  await ctx.route(/https:\/\/image\.tmdb\.org\//, async route => {
    requested.push(route.request().url())
    if (!route.request().url().includes('/w92/')) await fullImage
    try { await route.fulfill({ contentType: 'image/jpeg', body: posterFixture }) } catch { /* A cancelled test can close its context. */ }
  })
  try {
    await page.goto(sessionUrl.href)
    const preview = page.locator('.swipe-poster-preview')
    await page.waitForFunction(() => document.querySelector('.swipe-poster-preview')?.naturalWidth > 0)
    assert.equal(await preview.evaluate(el => getComputedStyle(el).opacity), '1')
    assert.equal(await page.locator('.swipe-poster-image').evaluate(el => el.classList.contains('is-ready')), false)
    assert.equal(new Set(requested.filter(url => !url.includes('/w92/')).map(url => url.split('/').pop())).size, 3, 'current + two future posters requested before voting')
    const filename = (await preview.getAttribute('src')).split('/').pop()
    assert.equal((await page.locator('.swipe-poster-image > img:not(.swipe-poster-preview)').getAttribute('src')).split('/').pop(), filename)
    release()
    await page.waitForFunction(() => document.querySelector('.swipe-poster-image')?.classList.contains('is-ready'))
    assert.equal(await preview.count(), 0)
    await page.getByRole('button', { name: 'Quero assistir', exact: true }).click()
  } finally { release(); await ctx.close() }
})

for (const [width, height] of [[320, 668], [911, 668], [1440, 900], [844, 390]]) test('participantes expandem sem reduzir pôster, com privacidade e teclado em ' + width + 'x' + height, async () => {
  const { ctx, page, state } = await context({ viewport: { width, height } })
  const people = Array.from({length: 8}, (_, n) => ({ member_key:n, id:null, handle:null, display_name:n === 0 ? 'Convidado com um nome muito longo 🎬' : 'Convidado ' + n, online:true, avatar_path:null }))
  await ctx.route(/supabase\.co\/rest\/v1\/rpc\/session_participants/, route => route.fulfill({ json: people }))
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(sessionUrl.href)
    const trigger = page.getByRole('button', {name:'Ver participantes da sessão',exact:true})
    await trigger.getByText('+5').waitFor()
    const before = await page.locator('.swipe-poster-frame').boundingBox()
    await trigger.click()
    const panel = page.getByRole('dialog', {name:'Participantes da sessão',exact:true})
    await panel.waitFor()
    await page.waitForFunction(() => document.querySelector('.session-participants-panel').getAnimations({subtree:true}).every(animation=>animation.playState==='finished'))
    assert.deepEqual(await page.locator('.swipe-poster-frame').boundingBox(),before)
    const box = await panel.boundingBox()
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height)
    assert.equal(await panel.locator('.session-participant').count(),8)
    assert.equal(await panel.getByRole('link').count(),0,'guests do not expose profile links')
    await page.keyboard.press('ArrowRight'); assert.equal(state.reactions.length,0)
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR + '/participants-expanded-' + width + '.png'})
    await page.keyboard.press('Escape'); await panel.waitFor({state:'hidden'})
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true)
    await trigger.press('Enter'); await panel.waitFor()
    assert.equal(await panel.evaluate(el=>el.getAnimations().length),0,'keyboard opens instantly')
    await page.getByRole('button',{name:'Fechar participantes',exact:true}).click(); await panel.waitFor({state:'hidden'})
    await page.emulateMedia({reducedMotion:'reduce'})
    await trigger.click(); await panel.waitFor()
    assert.equal(await panel.evaluate(el=>el.getAnimations({subtree:true}).length),0)
    await page.mouse.click(2,height-2); await panel.waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.deepEqual(errors,[])
  } finally { await ctx.close() }
})

for (const name of ['Quero assistir','Passo']) test('botão ' + name + ' deixa a animação terminar antes de trocar o pôster, mesmo com gravação rápida', async () => {
  const {ctx,page,state}=await context({viewport:{width:911,height:668},reducedMotion:'no-preference'})
  try {
    await page.goto(sessionUrl.href)
    const card=await page.locator('.swipe-film').elementHandle()
    const button=page.getByRole('button',{name,exact:true})
    await page.waitForFunction(()=>!document.querySelector('.is-like').disabled)
    const started=Date.now()
    await button.click()
    await delay(120)
    assert.equal(await card.evaluate(el=>el.isConnected),true,'fast API must not cut off the card exit')
    assert.equal(state.reactions.length,1)
    const offset=await card.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)
    assert.ok(name==='Passo'?offset<0:offset>0)
    await page.waitForFunction(el=>!el.isConnected,card)
    assert.ok(Date.now()-started>=270,'button exit should remain perceptible')
    assert.equal(state.reactions.length,1,'animation completion must not save a second vote')
  } finally {await ctx.close()}
})

test('falha ao salvar voto devolve o card e permite tentar novamente sem perder filme',async()=>{
 const {ctx,page,state}=await context({reducedMotion:'no-preference'})
 let fail=true
 await ctx.route(/supabase\.co\/rest\/v1\/reactions/,route=>route.request().method()==='POST'&&fail?route.fulfill({status:403,json:{message:'Voto não salvo'}}):route.fallback())
 try {
   await page.goto(sessionUrl.href)
   const card=await page.locator('.swipe-film').elementHandle()
   await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
   await page.getByText(/Erro ao salvar reação/).waitFor()
   await page.waitForFunction(()=>!document.querySelector('.is-like').disabled)
   assert.equal(await card.evaluate(el=>el.isConnected),true)
   assert.equal(state.reactions.length,0)
   fail=false
   await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
   await page.waitForFunction(el=>!el.isConnected,card)
   assert.equal(state.reactions.length,1)
 }finally{await ctx.close()}
})

test('match com armazenamento bloqueado permite abrir a lista sem lançar erro',async()=>{
 const {ctx,page}=await context({tutorial:true,reducedMotion:'reduce'})
 await ctx.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}))
 await ctx.route(/\/rpc\/check_session_match/,route=>route.fulfill({json:[{is_match:true,member_count:2,like_count:2}]}))
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 try {
   await page.goto(sessionUrl.href)
   await page.getByRole('button',{name:'Quero assistir',exact:true}).click()
   await page.getByRole('dialog',{name:'Deu match.'}).getByRole('link',{name:'Ver matches'}).click()
   await page.waitForURL('**/s/DEMO01/matches')
   await page.locator('#matches-title').waitFor()
   assert.deepEqual(errors,[])
 }finally{await ctx.close()}
})

for (const legacy of [false, true]) test('data de nascimento menor bloqueia conteúdo 18+ mesmo com flag legada '+legacy,async()=>{
 const {ctx,page,state}=await context()
 try {
  await page.route(/\/rest\/v1\/users\?/,route=>route.fulfill({json:{id:'11111111-1111-4111-8111-111111111111',birthdate:'2015-01-01',is_adult:legacy,is_premium:false}}))
  await page.route(/\/rest\/v1\/session_filters\?/,route=>route.request().method()==='GET'?route.fulfill({json:{include_adult:true}}):route.fallback())
  await page.goto(sessionUrl.href);await page.getByRole('button',{name:'Abrir filtros',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Encontre o filme certo'});await dialog.getByRole('button',{name:'Avançado',exact:true}).click()
  const toggle=dialog.getByRole('button',{name:/Permitir conteúdo 18/});assert.equal(await toggle.isDisabled(),true);assert.equal(await toggle.getAttribute('aria-pressed'),'false')
  assert.equal(await page.getByRole('dialog',{name:'Confirme sua idade'}).count(),0)
  await dialog.getByRole('button',{name:'Aplicar filtros',exact:true}).click()
  assert.ok(state.requests.filter(r=>r.path.includes('/session_filters')&&r.method==='POST').every(r=>r.body.include_adult===false))
 }finally{await ctx.close()}
})
test('aniversário libera o filtro na aba aberta sem ligá-lo automaticamente',async()=>{
 const {ctx,page}=await context()
 const now=new Date(), tomorrow=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1))
 const birthday=String(tomorrow.getUTCFullYear()-18)+tomorrow.toISOString().slice(4,10)
 try {
  await page.clock.install({time:now})
  await page.route(/\/rest\/v1\/users\?/,route=>route.fulfill({json:{id:'11111111-1111-4111-8111-111111111111',birthdate:birthday,is_adult:false,is_premium:false}}))
  await page.goto(sessionUrl.href);await page.getByRole('button',{name:'Abrir filtros',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Encontre o filme certo'});await dialog.getByRole('button',{name:'Avançado',exact:true}).click()
  const toggle=dialog.getByRole('button',{name:/Permitir conteúdo 18/});assert.equal(await toggle.isDisabled(),true)
  await page.clock.fastForward(tomorrow.getTime()-now.getTime()+1500)
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Permitir conteúdo 18+')).disabled)
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('dialog',{name:'Confirme sua idade'}).count(),0)
 }finally{await ctx.close()}
})
