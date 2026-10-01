import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const clientAsset=readdirSync(new URL('../dist/assets/',import.meta.url)).find(name=>name.startsWith('supabase-')&&name.endsWith('.js'))
const project=readFileSync(new URL('../dist/assets/'+clientAsset,import.meta.url),'utf8').match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)[1]
const storageKey=`sb-${project}-auth-token`
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4184'
let browser,server
before(async()=>{
  if(!process.env.TEST_BASE_URL){server=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'preview','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'ignore',windowsHide:true});for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}await delay(100)}}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})})
})
after(async()=>{await browser?.close();server?.kill()})
const uid='cccccccc-cccc-4ccc-8ccc-cccccccccccc',pid='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const makeUser=(guest=false)=>({id:uid,aud:'authenticated',role:'authenticated',is_anonymous:guest,email_confirmed_at:guest?undefined:'2026-10-01T12:00:00Z',app_metadata:{},user_metadata:{}})
const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture'
const session=user=>({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})
async function fixture({path='/perfil',width=390,guest=false,loggedIn=true,privateProfile=false}={}){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'})
  const state={user:makeUser(guest),profile:{id:pid,handle:'luna',display_name:'Luna',bio:'Histórias que ficam.',genres:[878],avatar_path:null,cover_path:null,is_public:!privateProfile,show_favorites:true,show_reviews:true},favorites:[],rooms:[{session_id:'22222222-2222-4222-8222-222222222222',code:'DEMO01',name:'Sexta do grupo',saved_at:'2026-10-01T12:00:00Z'}],requests:[],errors:[],fail:false}
  if(loggedIn)await context.addInitScript(({value,key})=>localStorage.setItem(key,JSON.stringify(value)),{value:session(state.user),key:storageKey})
  await context.route(/https:\/\/[^/]+\.supabase\.co\//,async route=>{
    const request=route.request(),u=new URL(request.url()),method=request.method(),body=request.headers()['content-type']?.includes('application/json')&&request.postData()?request.postDataJSON():null
    state.requests.push({path:u.pathname,method,body})
    let result=[]
    const error=(status=503,code='fixture')=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({code,error_code:code,message:'Fixture error'})})
    if(u.pathname.includes('/auth/v1/token')){if(state.fail)return error(400,'invalid_credentials');state.user=makeUser();result=session(state.user)}
    else if(u.pathname.includes('/auth/v1/signup'))result={user:{...makeUser(),email_confirmed_at:undefined},session:null}
    else if(u.pathname.includes('/auth/v1/user'))result=state.user
    else if(u.pathname.includes('/auth/v1/'))result={}
    else if(u.pathname.includes('/rpc/prepare_guest_transfer'))result='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    else if(u.pathname.includes('/rpc/claim_guest_transfer'))result=null
    else if(u.pathname.includes('/rpc/my_profile'))result=state.profile
    else if(u.pathname.includes('/rpc/my_saved_sessions'))result=state.rooms
    else if(u.pathname.includes('/rpc/profile_reviews'))result=[]
    else if(u.pathname.includes('/rest/v1/profiles')){
      if(method==='PATCH'){if(state.fail)return error();Object.assign(state.profile,body)}
      result=state.profile.is_public||!path.startsWith('/p/')?state.profile:null
    }else if(u.pathname.includes('/rest/v1/profile_favorites')){
      if(method==='POST')state.favorites.push(body)
      if(method==='DELETE')state.favorites=state.favorites.filter(x=>x.slot!==Number(u.searchParams.get('slot')?.slice(3)))
      result=method==='POST'?body:method==='DELETE'?{slot:1}:state.favorites
    }else if(u.pathname.includes('/rest/v1/saved_sessions')){state.rooms=[];result={session_id:'22222222-2222-4222-8222-222222222222'}}
    else if(u.pathname.includes('/functions/v1/search_movies'))result={movies:[{tmdb_id:157336,title:'Interestelar',year:2014,poster_url:'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'}]}
    else if(u.pathname.includes('/storage/v1/object')){if(state.fail)return error();result={Key:u.pathname.split('/object/')[1]}}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)})
  })
  await context.route(/googlesyndication|fundingchoicesmessages/,route=>route.abort())
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>state.errors.push(error.message));await page.goto(base+path)
  return {context,page,state}
}

test('login transfere visitante antes de retomar, e senha incorreta preserva a sessão',async()=>{
  const {context,page,state}=await fixture({path:'/conta?voltar=%2Fsalas',guest:true})
  try{
    await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByLabel('Senha',{exact:true}).fill('correct-password')
    state.fail=true;await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByText('E-mail ou senha incorretos.').waitFor()
    assert.equal(state.requests.some(x=>x.path.includes('claim_guest_transfer')),false)
    state.fail=false;await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/salas')
    assert.ok(state.requests.findIndex(x=>x.path.includes('prepare_guest_transfer'))<state.requests.findIndex(x=>x.path.includes('/auth/v1/token')))
    assert.equal(state.requests.filter(x=>x.path.includes('claim_guest_transfer')).length,1)
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('mm:guest-transfer')),null)
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('cadastro exige confirmação e nunca armazena senha; visitante continua sem cadastro',async()=>{
  const {context,page,state}=await fixture({path:'/conta',loggedIn:false})
  try{
    await page.getByRole('button',{name:'Ainda não tenho conta'}).click();await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByLabel('Senha',{exact:true}).fill('new-password-123')
    await page.getByRole('button',{name:'Criar conta',exact:true}).click();await page.getByText(/Confira seu e-mail/).waitFor()
    assert.equal(state.requests.some(x=>x.path.includes('signInAnonymously')),false)
    assert.equal(await page.evaluate(()=>Object.values({...localStorage,...sessionStorage}).some(value=>String(value).includes('new-password-123'))),false)
    await page.getByRole('link',{name:'Continuar sem cadastro'}).click();await page.waitForURL(base+'/')
  }finally{await context.close()}
})
for(const width of [320,390,768,1440])test(`perfil em ${width}px: personalização, privacidade, favoritos, upload e falha preservando foto`,async()=>{
  const {context,page,state}=await fixture({width})
  try{
    await page.getByLabel('Nome público').waitFor();await page.evaluate(()=>document.fonts.ready)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.getByLabel('Nome público').fill('Luna Cinema');await page.getByLabel('Bio',{exact:true}).fill('Ficção científica e histórias para rever.')
    await page.getByRole('button',{name:'Comédia',exact:true}).click();await page.getByLabel('Mostrar minhas avaliações neste perfil').uncheck();await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await page.getByText('Perfil salvo.',{exact:true}).waitFor()
    assert.equal(state.profile.show_reviews,false);assert.ok(state.profile.genres.includes(35))
    await page.getByLabel('Buscar filme',{exact:true}).fill('Interestelar');await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.locator('.profile-search-results button').click();await page.locator('.profile-favorites figure').waitFor()
    assert.equal(state.favorites[0].tmdb_id,157336)
    const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=100;c.getContext('2d').fillRect(0,0,100,100);return c.toDataURL('image/png').split(',')[1]})
    await page.getByLabel('Foto de perfil',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.getByText('Imagem atualizada.',{exact:true}).waitFor()
    assert.match(state.profile.avatar_path,new RegExp(`^${pid}/avatar-.+\\.webp$`));const previous=state.profile.avatar_path
    state.fail=true;await page.getByLabel('Foto de perfil',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.getByText(/A foto anterior foi preservada/).waitFor();assert.equal(state.profile.avatar_path,previous)
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/profile-${width}.png`,fullPage:true})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('salas salvas e perfil privado apresentam estados corretos',async()=>{
  const {context,page,state}=await fixture({path:'/salas'})
  try{await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor();assert.match(await page.getByRole('link',{name:'Retomar'}).getAttribute('href'),/DEMO01/);await page.getByRole('button',{name:'Deixar de salvar'}).click();await page.getByRole('button',{name:'Remover da minha lista'}).click();await page.getByText('A próxima sessão começa com você.').waitFor();assert.equal(state.rooms.length,0)}finally{await context.close()}
  const hidden=await fixture({path:'/p/luna',loggedIn:false,privateProfile:true})
  try{await hidden.page.getByRole('heading',{name:'Perfil indisponível.'}).waitFor();assert.equal(hidden.state.requests.some(x=>x.path.includes('/auth/v1/')),false)}finally{await hidden.context.close()}
})
