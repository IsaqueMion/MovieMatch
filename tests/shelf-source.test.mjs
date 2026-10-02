import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildMovieShelf } from '../scripts/build-movie-shelf.mjs'

test('shelf keeps the registered canonical source, frame and export', () => {
  const files = {
    'public/landing-pages/complete-shelf-v2.html': '606f200fed8602c243f40a11c8c364f0e625c57f80e7c97dc76419da207f198e',
    'src/shaders/landing-pages/LandingPageFrame.tsx': '61de2cc50888aac4ac5557420b07fa47ed3543bb57c1e0055fafdefa53dbaa78',
    'docs/threeui-shelf/LandingPages.tsx.txt': '4d379461ad00eb4de7900df312878035383de7e1ed4e13283b8143a2eea9d30a',
    'src/shaders/threeui.css': 'efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf',
  }
  for (const [path, expected] of Object.entries(files)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex'), expected, path)
  const registered = readFileSync(new URL('../docs/threeui-shelf/LandingPages.tsx.txt', import.meta.url), 'utf8')
  const start = registered.indexOf('export function CompleteShelfLandingPage(')
  const end = registered.indexOf('\nexport function ', start + 10)
  assert.ok(readFileSync(new URL('../src/shaders/landing-pages/LandingPages.tsx', import.meta.url), 'utf8').includes(registered.slice(start, end).trimEnd()))
})

test('movie variant derives the authored engine and accepts only its same-origin parent', async () => {
  const html = await buildMovieShelf()
  assert.ok(html.includes('new THREE.WebGLRenderer('))
  assert.ok(html.includes('createBookRig(book, index)'))
  assert.ok(html.includes('BOOKS = movies.map('))
  assert.ok(html.includes('ctx.drawImage(poster,'))
  assert.ok(html.includes('event.source !== parent || event.origin !== location.origin'))
  assert.ok(html.includes('moviematch:shelf:open'))
  assert.ok(html.includes('textContent = book.title'))
  assert.ok(html.includes('const COVER_ATLAS_DATA = "";'))
})
