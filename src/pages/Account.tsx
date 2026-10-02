import { translate as t, useLocale } from '../hooks/useLocale'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Clapperboard, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { claimGuestTransfer, discardGuestTransfer, hasAccount, prepareGuestTransfer, safeReturnTo } from '../lib/account'
import { useAccount } from '../hooks/useAccount'
import { usePageMeta } from '../hooks/usePageMeta'
import CinemaButton from '../components/ui/cinema-button'
import FloatingPaths from '../components/account/FloatingPaths'
import PasswordStrength from '../components/account/PasswordStrength'
import PasswordConfirmation, { PasswordMatchDots } from '../components/account/PasswordConfirmation'
import { passwordStrength } from '../lib/passwordStrength'
import '../styles/account.css'
import LanguageSelect from '../components/ui/language-select'

export default function Account() {
  useLocale()
  const account = useAccount()
  const [params, setParams] = useSearchParams()
  const returnTo = safeReturnTo(params.get('voltar'))
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>(params.get('recuperar') ? 'password' : params.get('modo') === 'cadastro' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [confirming, setConfirming] = useState(false)
  const assisted = confirming && passwordStrength(password).complete && (mode === 'signup' || mode === 'password')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function changeMode(next: typeof mode) {
    setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); setShowPassword(false); setConfirming(false)
    const search = new URLSearchParams(params)
    search.delete('recuperar')
    if (next === 'signup') search.set('modo', 'cadastro'); else search.delete('modo')
    setParams(search, { replace: true })
  }
  usePageMeta({ title: t("Sua conta — MovieMatch"), description: t("Entre para salvar salas e compartilhar avaliações."), robots: 'noindex,nofollow,noarchive' })
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('password') })
    return () => subscription.unsubscribe()
  }, [])
  async function continueToRoom() {
    setBusy(true); setError('')
    try { await claimGuestTransfer(); window.location.replace('/') }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("Não foi possível retomar seu histórico.")); setBusy(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if ((mode === 'signup' || mode === 'password') && (password.length < 8 || password !== confirmation)) { setError(t("Use pelo menos 8 caracteres e confirme a mesma senha.")); return }
    setBusy(true); setError(''); setMessage('')
    try {
      if (mode === 'reset') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/conta?recuperar=1` })
        if (result.error) throw result.error
        setMessage(t("Se esse e-mail tiver uma conta, você receberá um link para redefinir a senha."))
      } else if (mode === 'password') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setPassword(''); setConfirmation(''); setMessage(t("Senha atualizada. Você pode continuar.")); setMode('login')
      } else {
        await prepareGuestTransfer()
        const result = mode === 'signup'
          ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/conta?voltar=${encodeURIComponent(returnTo)}` } })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (result.error) throw result.error
        setPassword(''); setConfirmation('')
        if (hasAccount(result.data.user) && result.data.session) { await claimGuestTransfer(); window.location.replace('/'); return }
        setMessage(t("Confira seu e-mail para confirmar a conta. Depois entre nesta mesma aba para preservar o histórico de visitante."))
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code
      setError(code === 'invalid_credentials' ? t("E-mail ou senha incorretos.") : code === 'email_not_confirmed' ? t("Confirme seu e-mail antes de entrar.") : code === 'over_email_send_rate_limit' ? t("O limite de envio de e-mails foi atingido. Tente novamente mais tarde.") : cause instanceof Error && cause.message.includes('histórico') ? cause.message : t("Não foi possível concluir. Confira os dados e tente novamente."))
    } finally { setBusy(false) }
  }
  const signedIn = account.registered && mode !== 'password'
  const heading = signedIn ? t("Bom ter você de volta.") : mode === 'signup' ? t("Seu cinema começa aqui.") : mode === 'reset' ? t("Vamos recuperar seu acesso.") : mode === 'password' ? t("Uma nova senha. Um novo começo.") : t("A sessão continua.")
  const description = signedIn ? t("Sua conta está conectada. Retome a sessão ou deixe o perfil com a sua cara.") : mode === 'signup' ? t("Crie sua conta para guardar as salas e compartilhar o que achou de cada filme.") : mode === 'reset' ? t("Enviaremos um link para você escolher uma nova senha.") : mode === 'password' ? t("Escolha uma senha com pelo menos 8 caracteres.") : t("Entre para reencontrar suas salas, seus filmes e suas histórias.")
  return <div className="cinema-page account-page account-entry">
    <main className="account-auth" id="conteudo">
      <aside className="account-story" aria-label="MovieMatch">
        <Link className="cinema-brand" to="/"><Clapperboard size={24} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link>
        <div className="account-paths"><FloatingPaths position={1} /><FloatingPaths position={-1} /></div>
        <div className="account-story-copy"><p className="cinema-eyebrow">{t("O próximo filme. A escolha de todos.")}</p><p className="account-story-title">{t("O play acaba.")}<br /><span>{t("A conversa continua.")}</span></p><p>{t("Guarde as sessões que renderam, os filmes que ficaram e a sua opinião depois dos créditos.")}</p><span className="account-story-signature">{t("Seu lugar na próxima sessão.")}</span></div>
      </aside>
      <section className="account-entry-panel">
        <div className="account-language"><LanguageSelect /></div>
        <Link className="account-guest-link" to={returnTo}><ArrowLeft size={16} aria-hidden="true" />{t("Continuar sem cadastro")}</Link>
        <div className="account-form" data-mode={mode}>
          <div className="account-form-transition" key={signedIn ? 'connected' : mode}>
          <Link className="cinema-brand account-mobile-brand" to="/"><Clapperboard size={24} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></Link>
          <p className="cinema-eyebrow">{mode === 'signup' ? t("Crie sua conta") : mode === 'reset' || mode === 'password' ? t("Recuperar acesso") : t("Bem-vindo ao MovieMatch")}</p>
          <h1>{heading}</h1><p className="account-form-description">{description}</p>
          {!signedIn && (mode === 'login' || mode === 'signup') ? <div className="account-mode-switch" role="group" aria-label={t("Acesso à conta")}>
            <button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => changeMode('login')}>{t("Entrar")}</button>
            <button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => changeMode('signup')}>{t("Criar conta")}</button>
          </div> : null}
      {error || account.error ? <p className="account-auth-error" role="alert">{error || account.error}</p> : null}{message ? <p className="account-auth-message" role="status">{message}</p> : null}
      {signedIn ? <><CinemaButton onClick={() => void continueToRoom()} disabled={busy}>{t("Continuar para o início")}</CinemaButton>{error.includes('transferido') ? <button disabled={busy} onClick={() => { if (window.confirm(t("Continuar apenas com o histórico da conta? O histórico de visitante não será transferido."))) { discardGuestTransfer(); window.location.replace('/') } }}>{t("Continuar apenas com o histórico da conta")}</button> : null}<Link to="/perfil">{t("Personalizar meu perfil")}</Link></> : mode === 'password' && !account.loading && !account.registered ? <p>{t("Este link não está ativo.") + " "}<button onClick={() => changeMode('reset')}>{t("Solicitar novo link de recuperação")}</button></p> : <form onSubmit={submit} aria-label={mode === 'signup' ? t("Criar conta") : mode === 'login' ? t("Entrar") : t("Recuperar senha")}>
        {mode !== 'password' ? <div className="account-field"><label htmlFor="account-email">{t("E-mail")}</label><div className="account-input-group"><Mail size={18} aria-hidden="true" /><input id="account-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} disabled={busy} /></div></div> : null}
        {mode !== 'reset' ? <div className="account-field"><label htmlFor="account-password">{t("Senha")}</label><div className="account-input-group" data-assisted={assisted}><LockKeyhole size={18} aria-hidden="true" /><input id="account-password" onFocus={() => setConfirming(false)} type={showPassword ? 'text' : 'password'} placeholder={mode === 'login' ? t("Sua senha") : t("Pelo menos 8 caracteres")} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} aria-describedby={mode === 'login' ? undefined : 'account-password-hint'} required disabled={busy} />{assisted ? <PasswordMatchDots password={password} value={confirmation} /> : null}<button className="account-password-toggle" type="button" aria-label={showPassword ? t("Ocultar senha") : t("Mostrar senha")} aria-pressed={showPassword} disabled={busy} onClick={() => { setConfirming(false); setShowPassword(!showPassword) }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{mode === 'login' ? <button className="account-forgot-password" type="button" disabled={busy} onClick={() => changeMode('reset')}>{t("Esqueci minha senha")}</button> : <div hidden={assisted}><small id="account-password-hint">{t("Use pelo menos 8 caracteres.")}</small><PasswordStrength value={password} /></div>}</div> : null}
        {mode === 'signup' || mode === 'password' ? <PasswordConfirmation password={password} value={confirmation} onChange={setConfirmation} onFocus={() => setConfirming(true)} disabled={busy} /> : null}
        <CinemaButton type="submit" disabled={busy || account.loading}>{busy ? t("Aguarde…") : mode === 'signup' ? t("Criar conta") : mode === 'reset' ? t("Enviar link") : mode === 'password' ? t("Salvar senha") : t("Entrar")}</CinemaButton>
        {mode === 'login' ? <p className="account-switch-copy">{t("Novo por aqui?") + " "}<button type="button" disabled={busy} onClick={() => changeMode('signup')}>{t("Ainda não tenho conta")}</button></p> : <p className="account-switch-copy"><button type="button" disabled={busy} onClick={() => changeMode('login')}>{t("Voltar para entrar")}</button></p>}
      </form>}
      <p className="account-legal">{t("Criar salas e votar continuam sem cadastro.")}<br /><a href="/terms.html">{t("Termos de uso")}</a><span aria-hidden="true"> · </span><a href="/privacy.html">{t("Privacidade")}</a></p>
          </div>
        </div>
      </section>
    </main>
  </div>
}
