import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/discover/index.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
async function request({includeAdult=true}={}) {
 let handler;const calls=[]
 runInNewContext(code,{Request,Response,URL,URLSearchParams,AbortSignal,console,Deno:{env:{get:name=>name==='TMDB_KEY'?'tmdb-fixture':''},serve:value=>{handler=value}},fetch:async(url,options)=>{calls.push({url:new URL(url),options});return Response.json({results:[],total_pages:1})}})
 const response=await handler(new Request('https://fixture/discover',{method:'POST',body:JSON.stringify({filters:{includeAdult},is_adult:true,user_metadata:{birthdate:'1900-01-01'}})}))
 return {response,calls,tmdb:calls.find(call=>call.url.hostname==='api.themoviedb.org')}
}
test('discovery always excludes explicit adult catalog even when a stale client requests it',async()=>{
 const f=await request({includeAdult:true});assert.equal(f.response.status,200);assert.equal(f.tmdb.url.searchParams.get('include_adult'),'false');assert.equal(f.calls.length,1);assert.equal(f.response.headers.get('cache-control'),'private, no-store')
})
