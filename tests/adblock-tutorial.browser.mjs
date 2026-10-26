import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
let browser
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React, { useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import AdblockWall from './src/components/AdblockWall'
import SwipeTutorial from './src/components/swipe/SwipeTutorial'
function Harness() {
  const navigate = useNavigate(), tutorial = useRef(null)
  window.navigateNotice = navigate
  return <main className="swipe-page"><button className="cinema-vote-button is-like" aria-label="Quero assistir" onClick={() => window.votes++}>Vote</button><button onClick={() => tutorial.current.open()}>Tutorial</button><AdblockWall /><SwipeTutorial ref={tutorial} sessionId="fixture" code="TEST01" /></main>
}
window.votes = 0
window.mountNotice = () => createRoot(document.querySelector('#root')).render(<MemoryRouter initialEntries={['/s/ONE']}><Harness /></MemoryRouter>)
` }, bundle: true, write: false, jsx: 'automatic', format: 'iife', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"' } })
const styles = (await Promise.all(['src/index.css', 'src/styles/swipe.css', 'src/styles/adblock-notice.css'].map(path => readFile(new URL('../' + path, import.meta.url), 'utf8')))).join('\n')
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) }) })
after(async () => { await browser?.close() })
async function fixture(blocked = false, width = 390, height = 844) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'pt-BR' })
  page.setDefaultTimeout(6000)
  await page.route('**/*', route => route.abort())
  await page.route('http://fixture.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }))
  await page.goto('http://fixture.test/')
  await page.addStyleTag({ content: styles + (blocked ? '\n.adsbox{display:none!important}' : '') })
  if (blocked) await page.evaluate(() => sessionStorage.setItem('mm:ads-notice-dismissed:v2', '1'))
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.evaluate(() => window.mountNotice())
  await page.getByRole('button', { name: 'Quero assistir', exact: true }).waitFor()
  await page.waitForTimeout(50)
  return page
}

test('script errors and unfilled ads alone never claim an ad blocker', async () => {
  const page = await fixture()
  try {
    await page.evaluate(() => {
      sessionStorage.removeItem('mm:ads-notice-dismissed:v2')
      const script = document.createElement('script')
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
      document.body.append(script)
      script.dispatchEvent(new Event('error'))
      const slot = document.createElement('ins'); slot.dataset.adStatus = 'unfilled'; document.body.append(slot)
      window.dispatchEvent(new Event('offline'))
    })
    await page.waitForTimeout(2200)
    assert.equal(await page.locator('.adblock-notice, .mm-ad-notice').count(), 0)
  } finally { await page.close() }
})

test('unrelated styles hiding both bait and control are not evidence of a blocker', async () => {
  const page = await fixture()
  try {
    await page.addStyleTag({ content: '[aria-hidden="true"]{visibility:hidden!important}' })
    await page.waitForTimeout(2200)
    assert.equal(await page.locator('.adblock-notice').count(), 0)
  } finally { await page.close() }
})

test('cosmetic blocking shows a dismissible card without covering votes and checks a new visit', async () => {
  const page = await fixture(true)
  try {
    const card = page.locator('.adblock-notice')
    await card.waitFor()
    const vote = page.getByRole('button', { name: 'Quero assistir', exact: true })
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/adblock-notice.png' })
    const noticeBounds = await card.boundingBox(), voteBounds = await vote.boundingBox()
    assert.ok(noticeBounds.y >= voteBounds.y + voteBounds.height || noticeBounds.y + noticeBounds.height <= voteBounds.y)
    await vote.click(); assert.equal(await page.evaluate(() => window.votes), 1)
    const close = card.getByRole('button', { name: 'Dispensar aviso de publicidade', exact: true })
    await close.focus(); await page.keyboard.press('Enter'); await card.waitFor({ state: 'detached' })
    assert.equal(await vote.evaluate(element => element === document.activeElement), true)
    await page.evaluate(() => window.navigateNotice('/s/TWO'))
    await card.waitFor()
    await card.getByRole('button', { name: 'Continuar votando', exact: true }).click()
    await card.waitFor({ state: 'detached' })
    assert.equal(await page.locator('[role="dialog"]').count(), 0)
  } finally { await page.close() }
})

for (const width of [320, 480]) test('tutorial shortcut order and centers match the preview at ' + width, async () => {
  const page = await fixture(false, width)
  try {
    await page.getByRole('button', { name: 'Tutorial', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Como votar no MovieMatch', exact: true })
    await dialog.waitFor()
    if (process.env.VISUAL_CAPTURE_DIR) await page.screenshot({ path: process.env.VISUAL_CAPTURE_DIR + '/tutorial-' + width + '.png' })
    const labels = await dialog.locator('.swipe-tutorial-keys > span').allTextContents()
    assert.deepEqual(labels, ['←Passo', '⌫Desfazer', '→Quero assistir'])
    const buttons = await dialog.locator('.swipe-tutorial-votes button').all()
    const keys = await dialog.locator('.swipe-tutorial-keys > span').all()
    for (let index = 0; index < 3; index++) {
      const button = await buttons[index].boundingBox(), key = await keys[index].boundingBox()
      assert.ok(Math.abs(button.x + button.width / 2 - key.x - key.width / 2) < 2)
    }
  } finally { await page.close() }
})
