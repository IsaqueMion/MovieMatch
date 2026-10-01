import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, AtSign, Clapperboard, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { claimGuestTransfer, discardGuestTransfer, hasAccount, prepareGuestTransfer, safeReturnTo } from '../lib/account'
import { useAccount } from '../hooks/useAccount'
import { usePageMeta } from '../hooks/usePageMeta'
import CinemaButton from '../components/ui/cinema-button'
import FloatingPaths from '../components/account/FloatingPaths'
import '../styles/account.css'

export default function Account() {
  const account = useAccount()
  const [params, setParams] = useSearchParams()
  const returnTo = safeReturnTo(params.get('voltar'))
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>(params.get('recuperar') ? 'password' : params.get('modo') === 'cadastro' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function changeMode(next: typeof mode) {
    setMode(next); setError(''); setMessage(''); setPassword(''); setShowPassword(false)
    const search = new URLSearchParams(params)
    search.delete('recuperar')
    if (next === 'signup') search.set('modo', 'cadastro'); else search.delete('modo')
    setParams(search, { replace: true })
  }
  usePageMeta({ title: 'Sua conta — MovieMatch', description: 'Entre para salvar salas e compartilhar avaliações.', robots: 'noindex,nofollow,noarchive' })
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('password') })
    return () => subscription.unsubscribe()
  }, [])
  async function continueToRoom() {
    setBusy(true); setError('')
    try { await claimGuestTransfer(); window.location.replace('/') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível retomar seu histórico.'); setBusy(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (mode === 'reset') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/conta?recuperar=1` })
        if (result.error) throw result.error
        setMessage('Se esse e-mail tiver uma conta, você receberá um link para redefinir a senha.')
      } else if (mode === 'password') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setPassword(''); setMessage('Senha atualizada. Você pode continuar.'); setMode('login')
      } else {
        await prepareGuestTransfer()
        const result = mode === 'signup'
          ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/conta?voltar=${encodeURIComponent(returnTo)}` } })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (result.error) throw result.error
        setPassword('')
        if (hasAccount(result.data.user) && result.data.session) { await claimGuestTransfer(); window.location.replace('/'); return }
        setMessage('Confira seu e-mail para confirmar a conta. Depois entre nesta mesma aba para preservar o histórico de visitante.')
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code
      setError(code === 'invalid_credentials' ? 'E-mail ou senha incorretos.' : code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : code === 'over_email_send_rate_limit' ? 'O limite de envio de e-mails foi atingido. Tente novamente mais tarde.' : cause instanceof Error && cause.message.includes('histórico') ? cause.message : 'Não foi possível concluir. Confira os dados e tente novamente.')
    } finally { setBusy(false) }
  }
  const signedIn = account.registered && mode !== 'password'
  const heading = signedIn ? 'Bom ter você de volta.' : mode === 'signup' ? 'Seu cinema começa aqui.' : mode === 'reset' ? 'Vamos recuperar seu acesso.' : mode === 'password' ? 'Uma nova senha. Um novo começo.' : 'A sessão continua.'
  const description = signedIn ? 'Sua conta está conectada. Retome a sessão ou deixe o perfil com a sua cara.' : mode === 'signup' ? 'Crie sua conta para guardar as salas e compartilhar o que achou de cada filme.' : mode === 'reset' ? 'Enviaremos um link para você escolher uma nova senha.' : mode === 'password' ? 'Escolha uma senha com pelo menos 8 caracteres.' : 'Entre para reencontrar suas salas, seus filmes e suas histórias.'
  return <div className="cinema-page account-page account-entry">
    <main className="account-auth" id="conteudo">
      <aside className="account-story" aria-label="MovieMatch">
        <Link className="cinema-brand" to="/"><Clapperboard size={24} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link>
        <div className="account-paths"><FloatingPaths position={1} /><FloatingPaths position={-1} /></div>
        <div className="account-story-copy"><p className="cinema-eyebrow">O próximo filme. A escolha de todos.</p><p className="account-story-title">O play acaba.<br /><span>A conversa continua.</span></p><p>Guarde as sessões que renderam, os filmes que ficaram e a sua opinião depois dos créditos.</p><span className="account-story-signature">Seu lugar na próxima sessão.</span></div>
      </aside>
      <section className="account-entry-panel">
        <Link className="account-guest-link" to={returnTo}><ArrowLeft size={16} aria-hidden="true" />Continuar sem cadastro</Link>
        <div className="account-form">
          <Link className="cinema-brand account-mobile-brand" to="/"><Clapperboard size={24} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link>
          <p className="cinema-eyebrow">{mode === 'signup' ? 'Crie sua conta' : mode === 'reset' || mode === 'password' ? 'Recuperar acesso' : 'Bem-vindo ao MovieMatch'}</p>
          <h1>{heading}</h1><p className="account-form-description">{description}</p>
          {!signedIn && (mode === 'login' || mode === 'signup') ? <div className="account-mode-switch" role="group" aria-label="Acesso à conta">
            <button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => changeMode('login')}>Entrar</button>
            <button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => changeMode('signup')}>Criar conta</button>
          </div> : null}
      {error || account.error ? <p className="account-auth-error" role="alert">{error || account.error}</p> : null}{message ? <p className="account-auth-message" role="status">{message}</p> : null}
      {signedIn ? <><CinemaButton onClick={() => void continueToRoom()} disabled={busy}>Continuar para o início</CinemaButton>{error.includes('transferido') ? <button disabled={busy} onClick={() => { if (window.confirm('Continuar apenas com o histórico da conta? O histórico de visitante não será transferido.')) { discardGuestTransfer(); window.location.replace('/') } }}>Continuar apenas com o histórico da conta</button> : null}<Link to="/perfil">Personalizar meu perfil</Link></> : mode === 'password' && !account.loading && !account.registered ? <p>Este link não está ativo. <button onClick={() => changeMode('reset')}>Solicitar novo link de recuperação</button></p> : <form onSubmit={submit} aria-label={mode === 'signup' ? 'Criar conta' : mode === 'login' ? 'Entrar' : 'Recuperar senha'}>
        {mode !== 'password' ? <div className="account-field"><label htmlFor="account-email">E-mail</label><div className="account-input-group"><AtSign size={18} aria-hidden="true" /><input id="account-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} disabled={busy} /></div></div> : null}
        {mode !== 'reset' ? <div className="account-field"><div className="account-label-row"><label htmlFor="account-password">Senha</label>{mode === 'login' ? <button type="button" disabled={busy} onClick={() => changeMode('reset')}>Esqueci minha senha</button> : null}</div><div className="account-input-group"><LockKeyhole size={18} aria-hidden="true" /><input id="account-password" type={showPassword ? 'text' : 'password'} placeholder={mode === 'login' ? 'Sua senha' : 'Pelo menos 8 caracteres'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} aria-describedby={mode === 'login' ? undefined : 'account-password-hint'} required disabled={busy} /><button className="account-password-toggle" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{mode !== 'login' ? <small id="account-password-hint">Use pelo menos 8 caracteres.</small> : null}</div> : null}
        <CinemaButton type="submit" disabled={busy || account.loading}>{busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link' : mode === 'password' ? 'Salvar senha' : 'Entrar'}</CinemaButton>
        {mode === 'login' ? <p className="account-switch-copy">Novo por aqui? <button type="button" disabled={busy} onClick={() => changeMode('signup')}>Ainda não tenho conta</button></p> : <p className="account-switch-copy"><button type="button" disabled={busy} onClick={() => changeMode('login')}>Voltar para entrar</button></p>}
      </form>}
      <p className="account-legal">Criar salas e votar continuam sem cadastro.<br /><a href="/terms.html">Termos de uso</a><span aria-hidden="true"> · </span><a href="/privacy.html">Privacidade</a></p>
        </div>
      </section>
    </main>
  </div>
}
