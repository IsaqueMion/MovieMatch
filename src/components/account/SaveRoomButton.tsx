import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useState } from 'react'
import { Bookmark, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { accountHref, savedRooms } from '../../lib/account'
import { useAccount } from '../../hooks/useAccount'

export default function SaveRoomButton({ sessionId, code }: { sessionId: string | null; code: string }) {
  useLocale()
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState(t("Sessão {0}", [code]))
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setSaved(false); setLoading(true); setError(''); setMessage('')
    if (account.loading) return
    if (account.registered && sessionId) void savedRooms().then(rows => { if (active) { const room = rows.find(row => row.session_id === sessionId); setSaved(Boolean(room)); setName(room?.name ?? t("Sessão {0}", [code])) } }).catch(() => { if (active) setError(t("Não foi possível consultar se a sala está salva.")) }).finally(() => { if (active) setLoading(false) })
    else setLoading(false)
    return () => { active = false }
  }, [account.loading, account.registered, account.user?.id, sessionId, code])
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 2200)
    return () => window.clearTimeout(timer)
  }, [message])
  async function toggle() {
    if (busy || loading || !sessionId) return
    if (!account.registered) { setOpen(value => !value); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const result = saved
        ? await supabase.from('saved_sessions').delete().eq('session_id', sessionId).select('session_id').single()
        : await supabase.rpc('save_session', { p_session_id: sessionId, p_name: name.trim() })
      if (result.error) throw result.error
      setSaved(!saved); setMessage(saved ? t("Sala removida da sua lista.") : t("Sala salva."))
    } catch { setError(saved ? t("Não foi possível remover. Tente novamente.") : t("Não foi possível salvar a sala. Tente novamente.")) }
    finally { setBusy(false) }
  }
  return <div className="account-save-room"><button className="swipe-tool account-save-trigger" type="button" disabled={busy || loading || !sessionId} onClick={() => void toggle()} aria-pressed={saved} aria-expanded={!account.registered ? open : undefined} aria-label={saved ? t("Deixar de salvar sala") : t("Salvar sala")} title={saved ? t("Deixar de salvar sala") : t("Salvar sala")}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /></button>
    {message ? <span className="account-save-feedback" role="status">{message}</span> : null}
    {error ? <p className="account-save-feedback account-auth-error" role="alert">{error}</p> : null}
    {open && !account.registered ? <section className="account-save-popover" aria-label={t("Salvar esta sala")}><button className="account-popover-close" aria-label={t("Fechar opção de salvar")} onClick={() => setOpen(false)}><X size={16} /></button><h2>{t("Continuar outro dia?")}</h2><p>{t("Entre para salvar esta sala. Votar continua sem cadastro.")}</p><Link className="account-link" to={accountHref()}>{t("Entrar ou criar conta")}</Link></section> : null}
  </div>
}
