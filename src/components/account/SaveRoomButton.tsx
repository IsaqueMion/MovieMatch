import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useState } from 'react'
import { Bookmark, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { accountHref, savedRooms } from '../../lib/account'
import { useAccount } from '../../hooks/useAccount'
import CinemaButton from '../ui/cinema-button'

export default function SaveRoomButton({ sessionId, code }: { sessionId: string | null; code: string }) {
  useLocale()
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState(t("Sessão {0}", [code]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (account.registered && sessionId) void savedRooms().then(rows => { if (active) { const room = rows.find(row => row.session_id === sessionId); setSaved(Boolean(room)); if (room) setName(room.name) } }).catch(() => { if (active) setError(t("Não foi possível consultar se a sala está salva.")) })
    return () => { active = false }
  }, [account.registered, sessionId])
  async function save() {
    setBusy(true); setError('')
    const { error } = await supabase.rpc('save_session', { p_session_id: sessionId, p_name: name.trim() })
    if (error) setError(t("Não foi possível salvar a sala. Tente novamente."))
    else { setSaved(true); setOpen(false) }
    setBusy(false)
  }
  return <div className="account-save-room"><button className="swipe-tool" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={saved ? t("Sala salva, editar nome") : t("Salvar sala")}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /><span>{saved ? t("Salva") : t("Salvar sala")}</span></button>
    {open ? <section className="account-save-popover" aria-label={t("Salvar esta sala")}><button className="account-popover-close" aria-label={t("Fechar opção de salvar")} onClick={() => setOpen(false)}><X size={16} /></button>{account.registered ? <form onSubmit={event => { event.preventDefault(); void save() }}><label>{t("Nome da sala")}<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required autoFocus disabled={busy} /></label><p>{t("A sala fica disponível enquanto alguém do grupo a mantiver salva.")}</p><CinemaButton compact type="submit" disabled={busy || !sessionId || !name.trim()}>{busy ? t("Salvando…") : t("Salvar sala")}</CinemaButton><a href="/#minhas-salas">{t("Minhas salas")}</a></form> : <><h2>{t("Continuar outro dia?")}</h2><p>{t("Entre para salvar esta sala. Votar continua sem cadastro.")}</p><Link className="account-link" to={accountHref()}>{t("Entrar ou criar conta")}</Link></>}{error ? <p role="alert" className="library-error">{error}</p> : null}</section> : null}
  </div>
}
