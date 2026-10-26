import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/discover/index.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
async function request({allowed=false,auth=true,fail=false,includeAdult=true}={}) {
 let handler;const calls=[]
 runInNewContext(code,{Request,Response,URL,URLSearchParams,AbortSignal,console,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://fixture.supabase.co':name==='SUPABASE_ANON_KEY'?'public-key':'tmdb-fixture'},serve:value=>{handler=value}},fetch:async(url,options)=>{calls.push({url:new URL(url),options});if(String(url).includes('/rpc/')){if(fail)throw Error('Unavailable');return Response.json(allowed)}return Response.json({results:[],total_pages:1})}})
 const response=await handler(new Request('https://fixture/discover',{method:'POST',headers:auth?{authorization:'Bearer viewer-token'}:{},body:JSON.stringify({filters:{includeAdult},is_adult:true,user_metadata:{birthdate:'1900-01-01'}})}))
 return {response,calls,tmdb:calls.find(call=>call.url.hostname==='api.themoviedb.org')}
}
test('adult discovery requires the viewer-scoped database response true',async()=>{
 const f=await request({allowed:true});assert.equal(f.response.status,200);assert.equal(f.tmdb.url.searchParams.get('include_adult'),'true');assert.equal(f.calls[0].options.headers.authorization,'Bearer viewer-token');assert.equal(f.calls[0].options.headers.apikey,'public-key');assert.equal(f.response.headers.get('cache-control'),'private, no-store')
})
test('minors, unknown age, spoofed claims and RPC failures remain on the safe catalogue',async()=>{
 for(const options of [{allowed:false},{allowed:null},{allowed:{is_adult:true}},{allowed:true,auth:false},{fail:true}]){const f=await request(options);assert.equal(f.response.status,200);assert.equal(f.tmdb.url.searchParams.get('include_adult'),'false')}
})
test('a disabled adult filter does not fetch age or become enabled by eligibility',async()=>{
 const f=await request({allowed:true,includeAdult:false});assert.equal(f.calls.length,1);assert.equal(f.tmdb.url.searchParams.get('include_adult'),'false')
})
