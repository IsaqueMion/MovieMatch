import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import ts from 'typescript'
import process from 'node:process'

let browser
const source = await readFile(new URL('../src/lib/dialogFocus.ts', import.meta.url), 'utf8')
const script = ts.transpileModule(source.replace(/^import type .*$/gm, '').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2017 } }).outputText + '\nwindow.dialogCompatibility = { openDialog };'
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) }) })
after(async () => { await browser?.close() })

for (const fallback of [false, true]) {
  test(`dialog preserves modality, focus and cancellation (${fallback ? 'fallback' : 'native'})`, async () => {
    const page = await browser.newPage()
    try {
      await page.setContent('<style>dialog[data-dialog-fallback]{position:fixed;inset:0;z-index:2147483647;margin:auto}.dialog-fallback-backdrop{position:fixed;inset:0;z-index:2147483646;background:#0009}</style><main aria-hidden="false"><button id="opener">Open</button><button id="outside">Outside</button><section><dialog aria-label="Test"><input id="first" autofocus><button id="last">Last</button></dialog></section></main>')
      await page.addScriptTag({ content: script })
      await page.evaluate(fallback => {
        if (fallback) { HTMLDialogElement.prototype.showModal = undefined; HTMLDialogElement.prototype.close = undefined }
        document.querySelector('#opener').focus()
        window.openerElement = document.activeElement
        window.outsideClicks = 0
        document.querySelector('#outside').addEventListener('click', () => window.outsideClicks++)
        const dialog = document.querySelector('dialog')
        window.disposeDialog = window.dialogCompatibility.openDialog(dialog)
        dialog.addEventListener('cancel', event => { event.preventDefault(); window.cancelled = true })
      }, fallback)
      assert.equal(await page.locator('#first').evaluate(el => document.activeElement === el), true)
      assert.equal(await page.locator('body').getAttribute('data-dialog-open'), '')
      if (fallback) {
        await page.locator('#last').focus()
        await page.keyboard.press('Tab')
        assert.equal(await page.locator('#first').evaluate(el => document.activeElement === el), true)
        await page.keyboard.press('Shift+Tab')
        assert.equal(await page.locator('#last').evaluate(el => document.activeElement === el), true)
        await page.evaluate(() => document.querySelector('#outside').click())
        assert.equal(await page.evaluate(() => window.outsideClicks), 0)
        await page.evaluate(() => document.querySelector('#outside').focus())
        assert.equal(await page.locator('dialog').evaluate(el => el.contains(document.activeElement)), true)
        assert.equal(await page.locator('dialog').getAttribute('aria-modal'), 'true')
        assert.equal(await page.locator('#outside').getAttribute('aria-hidden'), 'true')
      }
      await page.keyboard.press('Escape')
      assert.equal(await page.evaluate(() => window.cancelled), true)
      assert.equal(await page.locator('dialog').evaluate(el => el.hasAttribute('open')), true)
      await page.evaluate(() => { window.disposeDialog(); window.openerElement.focus() })
      assert.equal(await page.locator('dialog').evaluate(el => el.hasAttribute('open')), false)
      assert.equal(await page.locator('#opener').evaluate(el => document.activeElement === el), true)
      assert.equal(await page.locator('main').getAttribute('aria-hidden'), 'false')
      assert.equal(await page.locator('#outside').getAttribute('aria-hidden'), null)
      assert.equal(await page.locator('.dialog-fallback-backdrop').count(), 0)
      assert.equal(await page.evaluate(() => document.body.style.overflow), '')
      assert.equal(await page.locator('body').getAttribute('data-dialog-open'), null)
    } finally { await page.close() }
  })
}

test('nested fallback dialogs retain background and scroll locks until the last closes', async () => {
  const page = await browser.newPage()
  try {
    await page.setContent('<style>dialog[data-dialog-fallback]{position:fixed;inset:0}</style><button id="opener">Open</button><dialog id="outer"><button id="next">Next</button></dialog><dialog id="inner"><button id="done">Done</button></dialog>')
    await page.addScriptTag({ content: script })
    await page.evaluate(() => {
      HTMLDialogElement.prototype.showModal = undefined
      HTMLDialogElement.prototype.close = undefined
      document.body.style.overflow = 'clip'
      document.body.setAttribute('data-dialog-open', 'previous')
      document.querySelector('#opener').focus()
      window.closeOuter = window.dialogCompatibility.openDialog(document.querySelector('#outer'))
      window.closeInner = window.dialogCompatibility.openDialog(document.querySelector('#inner'))
      window.cancelledOuter = 0
      window.cancelledInner = 0
      document.querySelector('#outer').addEventListener('cancel', event => { event.preventDefault(); window.cancelledOuter++ })
      document.querySelector('#inner').addEventListener('cancel', event => { event.preventDefault(); window.cancelledInner++ })
    })
    await page.keyboard.press('Escape')
    assert.deepEqual(await page.evaluate(() => [window.cancelledOuter, window.cancelledInner]), [0, 1])
    await page.evaluate(() => window.closeInner())
    assert.equal(await page.locator('#outer').getAttribute('aria-hidden'), null)
    assert.equal(await page.locator('#outer').evaluate(el => el.contains(document.activeElement)), true)
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
    assert.equal(await page.locator('body').getAttribute('data-dialog-open'), '')
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => window.cancelledOuter), 1)
    await page.evaluate(() => window.closeOuter())
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip')
    assert.equal(await page.locator('body').getAttribute('data-dialog-open'), 'previous')
    assert.equal(await page.locator('#opener').getAttribute('aria-hidden'), null)
    assert.equal(await page.locator('#inner').getAttribute('aria-hidden'), null)
    assert.equal(await page.locator('#opener').evaluate(el => document.activeElement === el), true)
  } finally { await page.close() }
})

test('out-of-order fallback cleanup restores all original attributes and supports reopening', async () => {
  const page = await browser.newPage()
  try {
    await page.setContent('<style>dialog[data-dialog-fallback]{position:fixed;inset:0}</style><main aria-hidden="false"><button id="opener">Open</button><dialog id="outer"><button>First</button></dialog><dialog id="inner"><button>Second</button></dialog></main><footer aria-hidden="false">Footer</footer>')
    await page.addScriptTag({ content: script })
    await page.evaluate(() => {
      HTMLDialogElement.prototype.showModal = undefined
      HTMLDialogElement.prototype.close = undefined
      document.body.style.overflow = 'clip'
      document.body.setAttribute('data-dialog-open', 'previous')
      window.closeOuter = window.dialogCompatibility.openDialog(document.querySelector('#outer'))
      window.closeInner = window.dialogCompatibility.openDialog(document.querySelector('#inner'))
      window.closeOuter()
    })
    assert.equal(await page.locator('footer').getAttribute('aria-hidden'), 'true')
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
    assert.equal(await page.locator('body').getAttribute('data-dialog-open'), '')
    await page.evaluate(() => window.closeInner())
    assert.equal(await page.locator('footer').getAttribute('aria-hidden'), 'false')
    assert.equal(await page.locator('main').getAttribute('aria-hidden'), 'false')
    for (const id of ['#opener', '#outer', '#inner']) assert.equal(await page.locator(id).getAttribute('aria-hidden'), null)
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip')
    assert.equal(await page.locator('body').getAttribute('data-dialog-open'), 'previous')
    await page.evaluate(() => {
      const dialog = document.querySelector('#outer')
      window.dialogCompatibility.openDialog(dialog)()
      window.closeAgain = window.dialogCompatibility.openDialog(dialog)
      window.cancelCount = 0
      dialog.addEventListener('cancel', event => { event.preventDefault(); window.cancelCount++ })
    })
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => window.cancelCount), 1)
    assert.equal(await page.locator('.dialog-fallback-backdrop').count(), 1)
    await page.evaluate(() => window.closeAgain())
    assert.equal(await page.locator('.dialog-fallback-backdrop').count(), 0)
    assert.equal(await page.locator('footer').getAttribute('aria-hidden'), 'false')
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip')
    assert.equal(await page.locator('body').getAttribute('data-dialog-open'), 'previous')
  } finally { await page.close() }
})
