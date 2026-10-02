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
const makeUser=(guest=false)=>({id:uid,aud:'authenticated',role:'authenticated',is_anonymous:guest,email:guest?undefined:'luna@example.test',email_confirmed_at:guest?undefined:'2026-10-01T12:00:00Z',app_metadata:{},user_metadata:{}})
const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture'
const session=user=>({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})
async function fixture({path='/perfil',width=390,height=900,guest=false,loggedIn=true,privateProfile=false,locale='pt-BR',blockedStorage=false}={}){
  const context=await browser.newContext({locale,viewport:{width,height},serviceWorkers:'block'})
  if(blockedStorage)await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}}))
  const state={user:makeUser(guest),profile:{id:pid,handle:'luna',display_name:'Luna',bio:'Histórias que ficam.',genres:[878],avatar_path:null,cover_path:null,is_public:!privateProfile,show_favorites:true,show_reviews:true},favorites:[],rooms:[{session_id:'22222222-2222-4222-8222-222222222222',code:'DEMO01',name:'Sexta do grupo',saved_at:'2026-10-01T12:00:00Z'}],requests:[],errors:[],fail:false}
  if(loggedIn)await context.addInitScript(({value,key})=>{if(!sessionStorage.getItem('fixture:account-seeded')){localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('fixture:account-seeded','1')}},{value:session(state.user),key:storageKey})
  await context.route(/https:\/\/[^/]+\.supabase\.co\//,async route=>{
    const request=route.request(),u=new URL(request.url()),method=request.method(),body=request.headers()['content-type']?.includes('application/json')&&request.postData()?request.postDataJSON():null
    state.requests.push({path:u.pathname,method,body})
    let result=[]
    const error=(status=503,code='fixture')=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({code,error_code:code,message:'Fixture error'})})
    if(u.pathname.includes('/auth/v1/token')){if(state.fail)return error(400,'invalid_credentials');state.user=makeUser();result=session(state.user)}
    else if(u.pathname.includes('/auth/v1/signup'))result={user:{...makeUser(),email_confirmed_at:undefined},session:null}
    else if(u.pathname.includes('/auth/v1/user'))result=state.user
    else if(u.pathname.includes('/auth/v1/')){if(state.fail&&u.pathname.includes('/logout'))return error();result={}}
    else if(u.pathname.includes('/rpc/prepare_guest_transfer'))result='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    else if(u.pathname.includes('/rpc/claim_guest_transfer'))result=null
    else if(u.pathname.includes('/rpc/community_profiles'))result=state.profile.is_public?[state.profile]:[]
    else if(u.pathname.includes('/rpc/my_profile'))result=state.profile
    else if(u.pathname.includes('/rpc/my_saved_sessions')){if(state.fail)return error();result=state.rooms}
    else if(u.pathname.includes('/rpc/profile_reviews'))result=[]
    else if(u.pathname.includes('/rest/v1/profiles')){
      if(method==='PATCH'){if(state.fail)return error();Object.assign(state.profile,body)}
      result=state.profile.is_public||!path.startsWith('/p/')?state.profile:null
    }else if(u.pathname.includes('/rest/v1/profile_favorites')){
      if(method==='POST')state.favorites.push(body)
      if(method==='DELETE')state.favorites=state.favorites.filter(x=>x.slot!==Number(u.searchParams.get('slot')?.slice(3)))
      result=method==='POST'?body:method==='DELETE'?{slot:1}:state.favorites
    }else if(u.pathname.includes('/rest/v1/saved_sessions')){if(state.fail)return error();state.rooms=[];result={session_id:'22222222-2222-4222-8222-222222222222'}}
    else if(u.pathname.includes('/functions/v1/search_movies'))result={movies:[{tmdb_id:157336,title:'Interestelar',year:2014,poster_url:'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'}]}
    else if(u.pathname.includes('/storage/v1/object')){if(state.fail)return error();result={Key:u.pathname.split('/object/')[1]}}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)})
  })
  await context.route(/googlesyndication|fundingchoicesmessages/,route=>route.abort())
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>state.errors.push(error.message));await page.goto(base+path)
  return {context,page,state}
}

test('login transfere visitante e volta ao início, mesmo com retorno antigo; senha incorreta preserva a sessão',async()=>{
  const {context,page,state}=await fixture({path:'/conta?voltar=%2Fsalas',guest:true})
  try{
    await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByLabel('Senha',{exact:true}).fill('correct-password')
    state.fail=true;await page.getByRole('form',{name:'Entrar',exact:true}).getByRole('button',{name:'Entrar',exact:true}).click();await page.getByText('E-mail ou senha incorretos.').waitFor()
    assert.equal(state.requests.some(x=>x.path.includes('claim_guest_transfer')),false)
    state.fail=false;await page.getByRole('form',{name:'Entrar',exact:true}).getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');await page.getByRole('heading',{name:'Continue de onde parou.'}).waitFor()
    assert.ok(state.requests.findIndex(x=>x.path.includes('prepare_guest_transfer'))<state.requests.findIndex(x=>x.path.includes('/auth/v1/token')))
    assert.equal(state.requests.filter(x=>x.path.includes('claim_guest_transfer')).length,1)
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('mm:guest-transfer')),null)
    await page.reload();await page.getByRole('button',{name:'Abrir menu do perfil',exact:true}).waitFor();await page.getByRole('heading',{name:'Continue de onde parou.'}).waitFor()
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('login mantém a conta no início quando o navegador bloqueia localStorage',async()=>{
  const {context,page,state}=await fixture({path:'/conta',height:600,loggedIn:false,blockedStorage:true})
  try{
    await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByLabel('Senha',{exact:true}).fill('correct-password')
    const documentStart=await page.evaluate(()=>performance.timeOrigin)
    const submit=page.getByRole('form',{name:'Entrar',exact:true}).getByRole('button',{name:'Entrar',exact:true})
    await submit.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>scrollY)>0)
    await submit.click();await page.waitForURL(base+'/')
    await page.getByRole('button',{name:'Abrir menu do perfil',exact:true}).waitFor();await page.getByRole('heading',{name:'Continue de onde parou.'}).waitFor()
    assert.equal(await page.evaluate(()=>performance.timeOrigin),documentStart)
    assert.equal(await page.evaluate(()=>scrollY),0)
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('cadastro exige confirmação e nunca armazena senha; visitante continua sem cadastro',async()=>{
  const {context,page,state}=await fixture({path:'/conta',loggedIn:false})
  try{
    await page.getByRole('button',{name:'Ainda não tenho conta'}).click();await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByLabel('Senha',{exact:true}).fill('new-password-123');await page.getByLabel('Confirmar senha',{exact:true}).fill('new-password-123')
    await page.getByRole('form',{name:'Criar conta',exact:true}).getByRole('button',{name:'Criar conta',exact:true}).click();await page.getByText(/Confira seu e-mail/).waitFor()
    assert.equal(state.requests.some(x=>x.path.includes('signInAnonymously')),false)
    assert.equal(await page.evaluate(()=>Object.values({...localStorage,...sessionStorage}).some(value=>String(value).includes('new-password-123'))),false)
    await page.getByRole('link',{name:'Continuar sem cadastro'}).click();await page.waitForURL(base+'/')
  }finally{await context.close()}
})
for(const width of [320,390,768,1440])test(`acesso em ${width}px: cadastro direto, teclado, senha e recuperação sem autenticação automática`,async()=>{
  const {context,page,state}=await fixture({path:'/conta?modo=cadastro&voltar=%2Fs%2FDEMO01',loggedIn:false,width})
  try{
    await page.getByRole('heading',{name:'Seu cinema começa aqui.'}).waitFor();await page.evaluate(()=>document.fonts.ready)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.equal(await page.locator('h1').count(),1)
    assert.equal(state.requests.some(x=>x.path.includes('/auth/v1/')),false)
    await page.getByLabel('Senha',{exact:true}).fill('never-stored-password')
    const toggle=page.getByRole('button',{name:'Mostrar senha',exact:true});await toggle.focus();await page.keyboard.press('Enter')
    assert.equal(await page.getByLabel('Senha',{exact:true}).getAttribute('type'),'text')
    await page.getByRole('button',{name:'Ocultar senha',exact:true}).click()
    assert.equal(await page.getByLabel('Senha',{exact:true}).getAttribute('type'),'password')
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/auth-signup-${width}.png`,fullPage:true})
    await page.getByRole('group',{name:'Acesso à conta'}).getByRole('button',{name:'Entrar',exact:true}).click()
    assert.equal(await page.getByLabel('Senha',{exact:true}).inputValue(),'')
    assert.equal(new URL(page.url()).searchParams.get('voltar'),'/s/DEMO01')
    await page.getByLabel('E-mail',{exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.getByLabel('Senha',{exact:true}).evaluate(el=>el===document.activeElement),true)
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/auth-login-${width}.png`,fullPage:true})
    await page.getByRole('button',{name:'Esqueci minha senha',exact:true}).click()
    await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByRole('button',{name:'Enviar link',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Se esse e-mail tiver uma conta'}).waitFor()
    assert.equal(state.requests.filter(x=>x.path.includes('/auth/v1/recover')).length,1)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.getByRole('button',{name:'Voltar para entrar'}).click();await page.getByRole('heading',{name:'A sessão continua.'}).waitFor()
    await page.emulateMedia({reducedMotion:'reduce'})
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('link de recuperação expirado permite pedir novo e preserva o retorno',async()=>{
  const {context,page,state}=await fixture({path:'/conta?recuperar=1&voltar=%2Fs%2FDEMO01',loggedIn:false})
  try{
    await page.getByText('Este link não está ativo.',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Solicitar novo link de recuperação'}).click()
    await page.getByRole('heading',{name:'Vamos recuperar seu acesso.'}).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('recuperar'),null)
    assert.equal(new URL(page.url()).searchParams.get('voltar'),'/s/DEMO01')
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('confirmação acompanha cada caractere, bloqueia divergência e aceita oito caracteres; senha não sai do formulário',async()=>{
  const {context,page,state}=await fixture({path:'/conta?modo=cadastro',loggedIn:false})
  try{
    await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test')
    assert.equal(await page.locator('.account-input-group .lucide-mail').count(),1)
    const password=page.getByLabel('Senha',{exact:true}),confirm=page.getByLabel('Confirmar senha',{exact:true}),submit=page.getByRole('form',{name:'Criar conta'}).getByRole('button',{name:'Criar conta',exact:true})
    await password.fill('qwerty12');await confirm.focus();assert.equal(await page.getByRole('meter',{name:'Força da senha'}).isVisible(),true);assert.equal(await page.locator('.password-confirmation-dots').count(),0);assert.equal(await page.getByRole('meter',{name:'Força da senha'}).getAttribute('aria-valuenow'),'1')
    await password.fill('Mm!7zQp8');assert.equal(await page.getByRole('meter',{name:'Força da senha'}).getAttribute('aria-valuenow'),'4')
    await confirm.focus();assert.equal(await page.getByRole('meter',{name:'Força da senha'}).count(),0);assert.equal(await page.locator('#account-password').evaluate(el=>el.parentElement.dataset.assisted),'true');assert.equal(await confirm.evaluate(el=>el===document.activeElement),true);await confirm.fill('Mm!7xQp8');await page.getByText('As senhas não coincidem.',{exact:true}).waitFor();await submit.click();assert.equal(state.requests.some(x=>x.path.includes('/auth/v1/signup')),false)
    assert.equal(await page.locator('.password-confirmation-dots span[data-state=mismatch]').count(),1)
    await confirm.fill('Mm!7z');await page.getByText('Continue para confirmar a senha.',{exact:true}).waitFor();await confirm.pressSequentially('Qp8');await page.getByText('As senhas coincidem.',{exact:true}).waitFor()
    assert.equal(await page.locator('.password-confirmation-dots span[data-state=matched]').count(),8)
    await password.fill('Mm!7zQp9');assert.equal(await page.getByRole('meter',{name:'Força da senha'}).isVisible(),true);assert.equal(await page.locator('.password-confirmation-dots').count(),0);await page.getByText('As senhas não coincidem.',{exact:true}).waitFor();await submit.click();assert.equal(state.requests.some(x=>x.path.includes('/auth/v1/signup')),false)
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.password-confirmation .account-input-group').evaluate(el=>getComputedStyle(el).animationName),'none')
    await confirm.fill('Mm!7zQp9');await submit.click();await page.getByText(/Confira seu e-mail/).waitFor()
    assert.equal(state.requests.filter(x=>x.path.includes('/auth/v1/signup')).length,1)
    assert.equal(await password.inputValue(),'');assert.equal(await confirm.inputValue(),'')
    assert.equal(await page.evaluate(()=>Object.values({...localStorage,...sessionStorage}).some(v=>String(v).includes('Mm!7zQp9'))),false)
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('avatar amplia antes da prévia; edição abre na home, cancela sem salvar, preserva falha e atualiza identidade',async()=>{
  const {context,page,state}=await fixture({path:'/',width:1440})
  try{
    const trigger=page.getByRole('button',{name:'Abrir menu do perfil',exact:true}),preview=page.getByRole('region',{name:'Prévia do perfil'})
    await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor();await trigger.hover();await preview.waitFor({state:'visible'});await page.waitForTimeout(250)
    assert.match(await trigger.locator('.account-menu-avatar').evaluate(el=>getComputedStyle(el).transform),/1\.15/)
    assert.equal(await preview.getByText('luna@example.test',{exact:true}).count(),0);await preview.getByText('Histórias que ficam.',{exact:true}).waitFor()
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+'/profile-avatar-preview.png'})
    await page.keyboard.press('Escape');await preview.waitFor({state:'hidden'})
    await page.mouse.move(5,150);await page.emulateMedia({reducedMotion:'reduce'});await trigger.hover();await preview.waitFor({state:'visible'});assert.equal(await trigger.locator('.account-menu-avatar').evaluate(el=>getComputedStyle(el).transform),'none')
    await trigger.click();assert.equal(await preview.count(),0);await page.getByRole('menuitem',{name:'Editar perfil',exact:true}).click()
    const editor=page.getByRole('dialog',{name:'Editar perfil',exact:true});await editor.waitFor();assert.equal(page.url(),base+'/')
    await editor.getByLabel('Nome público').fill('Não salvar');await editor.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(state.profile.display_name,'Luna')
    assert.equal(state.requests.filter(x=>x.path.includes('/rest/v1/profiles')&&x.method==='PATCH').length,0)
    assert.equal(await trigger.evaluate(el=>document.activeElement===el),true)
    await trigger.click();await page.getByRole('menuitem',{name:'Editar perfil',exact:true}).click();await editor.getByLabel('Nome público').fill('Luna Cinema')
    state.fail=true;await editor.getByRole('button',{name:'Salvar perfil',exact:true}).click();await editor.getByText(/Seus textos continuam aqui/).waitFor();assert.equal(await editor.getByLabel('Nome público').inputValue(),'Luna Cinema')
    await editor.getByRole('button',{name:'Salvar perfil',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await editor.getByRole('button',{name:'Fechar edição de perfil'}).evaluate(el=>el===document.activeElement),true)
    state.fail=false;await editor.getByRole('button',{name:'Salvar perfil',exact:true}).click();await editor.waitFor({state:'hidden'});await trigger.click();await page.getByRole('menu').getByText('Luna Cinema',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
for(const width of [320,390,768,1440])test(`perfil em ${width}px: personalização, privacidade, favoritos, upload e falha preservando foto`,async()=>{
  const {context,page,state}=await fixture({width,height:width===320?568:width===768?668:900})
  try{
    await page.getByRole('button',{name:'Editar perfil',exact:true}).click();await page.getByLabel('Nome público').waitFor();await page.evaluate(()=>document.fonts.ready)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.equal(await page.getByRole('dialog',{name:'Editar perfil',exact:true}).evaluate(el=>el.matches(':modal')&&el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().bottom<=innerHeight),true)
    await page.getByLabel('Nome público').fill('Luna Cinema');await page.getByLabel('Bio',{exact:true}).fill('Ficção científica e histórias para rever.')
    await page.getByText('Gêneros e privacidade',{exact:true}).click();await page.getByRole('button',{name:'Comédia',exact:true}).click();await page.getByLabel('Mostrar minhas avaliações neste perfil').uncheck();await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await page.getByText('Perfil salvo.',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0)
    assert.equal(state.profile.show_reviews,false);assert.ok(state.profile.genres.includes(35))
    await page.getByLabel('Buscar filme',{exact:true}).fill('Interestelar');await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.locator('.profile-search-results button').click();await page.locator('.profile-favorites figure').waitFor()
    assert.equal(state.favorites[0].tmdb_id,157336)
    const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=100;c.getContext('2d').fillRect(0,0,100,100);return c.toDataURL('image/png').split(',')[1]})
    await page.getByRole('button',{name:'Editar perfil',exact:true}).click();await page.getByLabel('Foto de perfil',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});assert.equal(state.profile.avatar_path,null);await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
    assert.match(state.profile.avatar_path,new RegExp(`^${pid}/avatar-.+\\.webp$`));const previous=state.profile.avatar_path
    await page.getByRole('button',{name:'Editar perfil',exact:true}).click();state.fail=true;await page.getByLabel('Foto de perfil',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await page.getByText(/Seus textos continuam aqui/).waitFor();assert.equal(state.profile.avatar_path,previous)
    if(process.env.VISUAL_CAPTURE_DIR)await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/profile-${width}.png`})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('salas salvas e perfil privado apresentam estados corretos',async()=>{
  const {context,page,state}=await fixture({path:'/salas'})
  try{await page.waitForURL(base+'/#minhas-salas');await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor();assert.match(await page.getByRole('link',{name:'Retomar'}).getAttribute('href'),/DEMO01/);await page.getByRole('button',{name:'Deixar de salvar Sexta do grupo'}).click();await page.getByRole('button',{name:'Remover da minha lista'}).click();await page.getByText('A próxima sessão começa com você.').waitFor();assert.equal(state.rooms.length,0)}finally{await context.close()}
  const hidden=await fixture({path:'/p/luna',loggedIn:false,privateProfile:true})
  try{await hidden.page.getByRole('heading',{name:'Perfil indisponível.'}).waitFor();assert.equal(hidden.state.requests.some(x=>x.path.includes('/auth/v1/')),false)}finally{await hidden.context.close()}
})
for(const width of [320,390,768,1440])test(`home em ${width}px: navegação de visitante e perfil com teclado, fora do menu e salas privadas`,async()=>{
  const guest=await fixture({path:'/',width,loggedIn:false})
  try{
    await guest.page.locator('.home-navigation').waitFor({state:'attached'});await guest.page.evaluate(()=>document.fonts.ready)
    assert.equal(await guest.page.locator('#minhas-salas').count(),0)
    assert.equal(guest.state.requests.some(x=>/auth\/v1|my_profile|my_saved_sessions/.test(x.path)),false)
    await guest.page.locator('.home-header').getByRole('link',{name:'Entrar',exact:true}).waitFor()
    assert.equal(await guest.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(width<1024){await guest.page.getByLabel('Menu de navegação',{exact:true}).click();await guest.page.getByRole('navigation',{name:'Navegação principal no celular'}).getByRole('link',{name:'Como funciona'}).waitFor();await guest.page.keyboard.press('Escape');assert.equal(await guest.page.locator('.home-nav-mobile').getAttribute('open'),null)}
    if(process.env.VISUAL_CAPTURE_DIR)await guest.page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/home-guest-${width}.png`})
    assert.deepEqual(guest.state.errors,[])
  }finally{await guest.context.close()}
  const {context,page,state}=await fixture({path:'/',width})
  try{
    await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor();await page.evaluate(()=>document.fonts.ready)
    assert.equal(await page.locator('.home-header').getByRole('link',{name:'Entrar',exact:true}).count(),0)
    assert.equal(await page.getByText('luna@example.test',{exact:true}).count(),0)
    const trigger=page.getByRole('button',{name:'Abrir menu do perfil',exact:true});await trigger.click()
    const menu=page.getByRole('menu',{name:'Menu do perfil'});await menu.getByText('Luna',{exact:true}).waitFor();await menu.getByText('luna@example.test',{exact:true}).waitFor()
    assert.equal(await menu.getByRole('menuitem',{name:'Meu perfil',exact:true}).getAttribute('href'),'/p/luna')
    await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Editar perfil')
    await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Sair da conta')
    await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true)
    await trigger.click();await page.mouse.click(5,110);assert.equal(await trigger.getAttribute('aria-expanded'),'false')
    await trigger.click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await menu.waitFor({state:'visible'})
    if(process.env.VISUAL_CAPTURE_DIR){await page.waitForTimeout(220);await page.screenshot({path:process.env.VISUAL_CAPTURE_DIR+`/home-account-menu-${width}.png`})}
    await menu.getByRole('menuitem',{name:'Minhas salas',exact:true}).click();await page.waitForURL(base+'/#minhas-salas');assert.equal(await page.locator('#minhas-salas').evaluate(el=>el.getBoundingClientRect().top<100),true)
    assert.equal(state.requests.filter(x=>x.path.includes('/auth/v1/signup')).length,0)
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('sair da conta preserva estado em falha e remove salas e perfil após sucesso',async()=>{
  const {context,page,state}=await fixture({path:'/'})
  try{
    await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor();await page.getByRole('button',{name:'Abrir menu do perfil'}).click()
    state.fail=true;await page.getByRole('menuitem',{name:'Sair da conta',exact:true}).click();await page.getByText('Não foi possível sair. Tente novamente.').waitFor()
    assert.equal(await page.locator('#minhas-salas').count(),1)
    state.fail=false;await page.getByRole('menuitem',{name:'Sair da conta',exact:true}).click();await page.locator('.home-header').getByRole('link',{name:'Entrar',exact:true}).waitFor()
    assert.equal(await page.locator('#minhas-salas').count(),0);assert.equal(await page.getByRole('button',{name:'Abrir menu do perfil'}).count(),0)
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),null)
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})
test('falha ao remover sala conserva os dados; confirmação pode ser cancelada',async()=>{
  const {context,page,state}=await fixture({path:'/#minhas-salas'})
  try{
    await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor();await page.getByRole('button',{name:'Deixar de salvar Sexta do grupo'}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click()
    assert.equal(state.requests.filter(x=>x.method==='DELETE').length,0)
    await page.getByRole('button',{name:'Deixar de salvar Sexta do grupo'}).click();state.fail=true;await page.getByRole('button',{name:'Remover da minha lista'}).click();await page.getByRole('alert').filter({hasText:'Não foi possível remover.'}).waitFor()
    assert.equal(state.rooms.length,1);await page.getByRole('heading',{name:'Sexta do grupo'}).waitFor()
    state.fail=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByRole('button',{name:'Remover da minha lista'}).click();await page.getByText('A próxima sessão começa com você.').waitFor();assert.equal(state.rooms.length,0)
    assert.deepEqual(state.errors,[])
  }finally{await context.close()}
})

test('idioma automático e manual preserva os campos; painel e fundo ficam estáveis ao trocar acesso',async()=>{
  const {context,page,state}=await fixture({path:'/conta',loggedIn:false,width:1440,height:884,locale:'en-US'})
  try{
    await page.getByRole('heading',{name:'The session continues.'}).waitFor()
    const story=await page.locator('.account-story').boundingBox(), panel=await page.locator('.account-entry-panel').boundingBox()
    assert.ok(await page.locator('.account-floating-paths path').count() > 0)
    await page.getByRole('group',{name:'Account access'}).getByRole('button',{name:'Create account',exact:true}).click()
    await page.getByLabel('Password',{exact:true}).fill('Mm!7zQp9')
    await page.getByRole('button',{name:'Interface language',exact:true}).click(); await page.getByRole('menuitemradio',{name:/Español/}).click(); await page.evaluate(()=>window.scrollTo(0,0))
    await page.getByRole('heading',{name:'Tu cine empieza aquí.'}).waitFor()
    assert.equal(await page.getByLabel('Contraseña',{exact:true}).inputValue(),'Mm!7zQp9')
    const nextStory=await page.locator('.account-story').boundingBox(), nextPanel=await page.locator('.account-entry-panel').boundingBox()
    assert.equal(nextStory.height,story.height);assert.equal(nextStory.y,story.y);assert.equal(nextPanel.height,panel.height)
    assert.equal(await page.locator('html').getAttribute('lang'),'es-ES')
    await page.emulateMedia({reducedMotion:'reduce'})
    assert.equal(await page.locator('.account-form-transition').evaluate(el=>getComputedStyle(el).animationName),'none')
    await page.reload();await page.getByRole('heading',{name:'Tu cine empieza aquí.'}).waitFor()
    assert.equal(await page.getByLabel('Contraseña',{exact:true}).inputValue(),'')
    assert.equal(state.requests.some(x=>x.path.includes('/auth/v1/')),false);assert.deepEqual(state.errors,[])
  }finally{await context.close()}
  const mobile=await fixture({path:'/conta',loggedIn:false,width:320,locale:'es-MX'})
  try{
    await mobile.page.getByRole('heading',{name:'La sesión continúa.'}).waitFor()
    const link=await mobile.page.locator('.account-guest-link').boundingBox(), language=await mobile.page.locator('.site-language-footer').boundingBox()
    assert.ok(language.y>=link.y+link.height)
    assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  }finally{await mobile.context.close()}
})
