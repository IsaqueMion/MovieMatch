import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function functionFixture(name, registered = true) {
  const requests = []
  let handler
  const code = ts.transpileModule(readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  runInNewContext(code.replace(/^import .*createClient.*;?$/m, ''), {
    Request, Response, URL, URLSearchParams, AbortSignal,
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { is_anonymous: !registered, email_confirmed_at: registered ? '2026-10-01' : null } }, error: null }) } }),
    Deno: { env: { get: () => 'fixture-key' }, serve: callback => { handler = callback } },
    fetch: async url => { requests.push(new URL(url)); return Response.json(name !== 'movie_details' ? { results: [] } : { title: 'Fixture', overview: 'Fixture synopsis', release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG' }] }, { iso_3166_1: 'ES', release_dates: [{ certification: '7' }] }] } }) },
  })
  return { requests, invoke: request => handler(request) }
}
test('API display language is whitelisted and independent from original language and streaming region', async () => {
  for (const displayLanguage of ['pt-BR', 'en-US', 'es-ES', 'invalid']) {
    const f = functionFixture('discover')
    const res = await f.invoke(new Request('https://fixture/discover', { method: 'POST', body: JSON.stringify({ displayLanguage, filters: { language: 'ja', watchRegion: 'MX', providers: [8] } }) }))
    assert.equal(res.status, 200)
    assert.equal(f.requests[0].searchParams.get('language'), displayLanguage === 'invalid' ? 'pt-BR' : displayLanguage)
    assert.equal(f.requests[0].searchParams.get('with_original_language'), 'ja')
    assert.equal(f.requests[0].searchParams.get('watch_region'), 'MX')
  }
})

test('favorite search localizes results while still requiring a confirmed account',async()=>{
  const request=()=>new Request('https://fixture/search_movies',{method:'POST',body:JSON.stringify({query:'Interstellar',language:'en-US'})})
  const signedIn=functionFixture('search_movies')
  assert.equal((await signedIn.invoke(request())).status,200)
  assert.equal(signedIn.requests[0].searchParams.get('language'),'en-US')
  assert.equal(signedIn.requests[0].searchParams.get('include_adult'),'false')
  const guest=functionFixture('search_movies',false)
  assert.equal((await guest.invoke(request())).status,401)
  assert.equal(guest.requests.length,0)
})
test('details use localized data and the requested certification; invalid IDs never reach TMDB', async () => {
  const f = functionFixture('movie_details')
  const res = await f.invoke(new Request('https://fixture/movie_details?tmdb_id=123&language=es-ES&region=ES'))
  assert.equal((await res.json()).age_rating, '7')
  assert.equal(f.requests[0].searchParams.get('language'), 'es-ES')
  const before = f.requests.length
  assert.equal((await f.invoke(new Request('https://fixture/movie_details?tmdb_id=-1'))).status, 400)
  assert.equal(f.requests.length, before)
})
