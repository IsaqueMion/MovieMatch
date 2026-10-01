import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clapperboard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { claimGuestTransfer, discardGuestTransfer, hasAccount, prepareGuestTransfer, safeReturnTo } from '../lib/account'
import { useAccount } from '../hooks/useAccount'
import { usePageMeta } from '../hooks/usePageMeta'
import CinemaButton from '../components/ui/cinema-button'
import '../styles/account.css'

export default function Account() {
  const account = useAccount()
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('voltar'))
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>(params.get('recuperar') ? 'password' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  usePageMeta({ title: 'Sua conta — MovieMatch', description: 'Entre para salvar salas e compartilhar avaliações.', robots: 'noindex,nofollow,noarchive' })
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('password') })
    return () => subscription.unsubscribe()
  }, [])
  async function continueToRoom() {
    setBusy(true); setError('')
    try { await claimGuestTransfer(); window.location.replace(returnTo) }
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
        if (hasAccount(result.data.user) && result.data.session) { await claimGuestTransfer(); window.location.replace(returnTo); return }
        setMessage('Confira seu e-mail para confirmar a conta. Depois entre nesta mesma aba para preservar o histórico de visitante.')
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code
      setError(code === 'invalid_credentials' ? 'E-mail ou senha incorretos.' : code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : code === 'over_email_send_rate_limit' ? 'O limite de envio de e-mails foi atingido. Tente novamente mais tarde.' : cause instanceof Error && cause.message.includes('histórico') ? cause.message : 'Não foi possível concluir. Confira os dados e tente novamente.')
    } finally { setBusy(false) }
  }
  const signedIn = account.registered && mode !== 'password'
  return <div className="cinema-page account-page"><header className="cinema-container account-header"><Link className="cinema-brand" to="/"><Clapperboard size={22} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link><Link to={returnTo === '/salas' ? '/' : returnTo}>Continuar sem cadastro</Link></header>
    <main className="cinema-container account-auth" id="conteudo"><section><p className="cinema-eyebrow">Seu lugar na próxima sessão</p><h1>{signedIn ? 'Bom ter você de volta.' : mode === 'signup' ? 'O seu cinema.\nEm qualquer tela.' : mode === 'reset' || mode === 'password' ? 'Uma nova senha.' : 'A sessão continua.'}</h1><p>Salve as salas do seu grupo, monte sua seleção de favoritos e compartilhe o que ficou depois do play.</p><small>Criar sessões e votar continuam sem cadastro. Sua lista de assistidos é pessoal.</small></section>
    <section className="account-form"><h2>{signedIn ? 'Sua conta está conectada.' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Recuperar acesso' : mode === 'password' ? 'Definir senha' : 'Entrar'}</h2>
      {error || account.error ? <p className="library-error" role="alert">{error || account.error}</p> : null}<p role="status">{message}</p>
      {signedIn ? <><CinemaButton onClick={() => void continueToRoom()} disabled={busy}>Continuar</CinemaButton>{error.includes('transferido') ? <button disabled={busy} onClick={() => { if (window.confirm('Continuar apenas com o histórico da conta? O histórico de visitante não será transferido.')) { discardGuestTransfer(); window.location.replace(returnTo) } }}>Continuar apenas com o histórico da conta</button> : null}<Link to="/perfil">Personalizar meu perfil</Link></> : mode === 'password' && !account.loading && !account.registered ? <p>Este link não está ativo. <button onClick={() => setMode('reset')}>Solicitar novo link de recuperação</button></p> : <form onSubmit={submit}>
        {mode !== 'password' ? <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} disabled={busy} /></label> : null}
        {mode !== 'reset' ? <label>Senha<input aria-label="Senha" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} required disabled={busy} />{mode !== 'login' ? <small>Use pelo menos 8 caracteres.</small> : null}</label> : null}
        <CinemaButton type="submit" disabled={busy || account.loading}>{busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link' : mode === 'password' ? 'Salvar senha' : 'Entrar'}</CinemaButton>
        {mode === 'login' ? <><button type="button" onClick={() => { setMode('signup'); setError(''); setMessage('') }}>Ainda não tenho conta</button><button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}>Esqueci minha senha</button></> : <button type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}>Voltar para entrar</button>}
      </form>}
    </section></main></div>
}
