import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4183'
const origin = 'https://moviematch-three.vercel.app'
function url(path) { const value = new URL(base); value.pathname = path; return value.href }
let server, browser
before(async () => {
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', '4183', '--strictPort'], { stdio: 'ignore', windowsHide: true })
    for (let n = 0; n < 50; n++) {
      try { if ((await fetch(base)).ok) break } catch { /* Starting Vite. */ }
      await delay(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) })
})
after(async () => { await browser?.close(); server?.kill() })

test('public HTML has content, unique headings, canonical and share metadata without JavaScript', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' })
  await ctx.route(/fundingchoicesmessages|image\.tmdb\.org/, route => route.abort())
  const page = await ctx.newPage()
  try {
    for (const path of ['/', '/privacy.html', '/terms.html', '/ads.html']) {
      const response = await page.goto(url(path))
      assert.equal(response.status(), 200)
      assert.equal(await page.locator('h1').count(), 1)
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), origin + path)
      assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), origin + path)
      assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), origin + '/og-image-v2.png')
      assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), origin + '/og-image-v2.png')
      assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 60)
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), await page.title())
      assert.ok(!((await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes[0]?.content || '')).includes('noindex')))
    }
    await page.goto(url('/'))
    assert.match(await page.locator('main').innerText(), /pelo menos duas pessoas/)
    const structured = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
    assert.equal(structured['@type'], 'WebApplication')
    assert.equal(structured.url, origin + '/')
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + width)
    }
    const sitemap = await (await ctx.request.get(url('/sitemap.xml'))).text()
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(item => item[1])
    assert.deepEqual(locations.sort(), ['/', '/ads.html', '/privacy.html', '/terms.html'].map(path => origin + path).sort())
    const robots = await (await ctx.request.get(url('/robots.txt'))).text()
    assert.match(robots, /User-agent: \*\s+Allow: \//)
    assert.ok(!robots.includes('Disallow: /'))
  } finally { await ctx.close() }
})

test('private shell is noindex before JavaScript and never contains home content or canonical', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  try {
    await page.goto(url('/session.html'))
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0)
    assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0)
    assert.equal(await page.locator('#root').innerHTML(), '')
    if (process.env.TEST_BASE_URL) {
      for (const path of ['/s/DEMO01', '/s/DEMO01/matches', '/s/DEMO01/assistidos', '/assistidos', '/join']) {
        const response = await ctx.request.get(url(path))
        assert.equal(response.status(), 200)
        assert.match(response.headers()['x-robots-tag'], /noindex/)
        assert.match(await response.text(), /content="noindex,nofollow,noarchive"/)
      }
      assert.equal((await ctx.request.get(url('/seo-inexistente'))).status(), 404)
      assert.equal((await ctx.request.get(url('/assets/seo-inexistente.js'))).status(), 404)
    } else {
      const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
      assert.ok(config.rewrites.every(route => route.destination === '/session.html'))
      assert.ok(!config.rewrites.some(route => route.source === '/(.*)'))
    }
  } finally { await ctx.close() }
})

test('home paints before delayed scripts and remains interactive without automatic authentication', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errors = [], auth = []
  page.on('pageerror', error => errors.push(error.message))
  await ctx.route(/supabase\.co/, route => { auth.push(route.request().url()); return route.abort() })
  await ctx.route(/fundingchoicesmessages|image\.tmdb\.org/, route => route.abort())
  await ctx.route(/\/assets\/.*\.js$/, async route => { await delay(1200); await route.continue() })
  try {
    await page.goto(url('/'), { waitUntil: 'commit' })
    await page.locator('h1').waitFor({ state: 'visible' })
    assert.match(await page.locator('h1').innerText(), /O próximo filme/)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Tenho um código', exact: true }).click()
    assert.equal(await page.locator('#session-code').evaluate(el => el === document.activeElement), true)
    assert.equal(await page.locator('h1').count(), 1)
    await page.goto(url('/session.html'))
    await page.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content.includes('noindex'))
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0)
    await page.getByRole('link', { name: 'Voltar para o início' }).click()
    await page.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content === 'index,follow')
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), origin + '/')
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), await page.title())
    assert.deepEqual(auth, [])
    assert.deepEqual(errors, [])
  } finally { await ctx.close() }
})
