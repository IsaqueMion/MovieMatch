import { translate as t, useLocale, currentLocale } from '../../hooks/useLocale'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, Film, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { savedRooms, type SavedRoom } from '../../lib/account'
import { useAccount } from '../../hooks/useAccount'
import DeleteButton from '../ui/delete-button'
import '../../styles/account.css'

export default function HomeRooms() {
  useLocale()
  const account = useAccount()
  const [rooms, setRooms] = useState<SavedRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    if (!account.loading) {
      if (account.registered) { setLoading(true); setError(''); void savedRooms().then(rows => { if (active) setRooms(rows) }).catch(() => { if (active) setError(t("Não foi possível carregar suas salas.")) }).finally(() => { if (active) setLoading(false) }) }
      else { setRooms([]); setLoading(false) }
    }
    return () => { active = false }
  }, [account.loading, account.registered, account.user?.id, attempt])
  useEffect(() => {
    if (window.location.hash !== '#minhas-salas' || !account.registered) return
    document.getElementById('minhas-salas')?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, [account.registered])
  async function remove(id: string) {
    setBusy(true); setError('')
    const { error } = await supabase.from('saved_sessions').delete().eq('session_id', id).select('session_id').single()
    if (error) setError(t("Não foi possível remover. Tente novamente."))
    else { setRooms(rows => rows.filter(room => room.session_id !== id)); setConfirm(null) }
    setBusy(false)
  }
  if (!account.registered) return null
  return <section className="home-rooms cinema-container" id="minhas-salas" aria-labelledby="home-rooms-title">
    <div className="home-rooms-heading"><div><p className="cinema-eyebrow"><Bookmark size={14} aria-hidden="true" />{t("O próximo play está aqui")}</p><h2 id="home-rooms-title">{t("Continue de onde parou.")}</h2><p>{t("Suas salas salvas, com os votos e matches do grupo.")}</p></div><Link to="/assistidos"><Film size={17} aria-hidden="true" />{t("Meus assistidos")}<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    {error ? <p role="alert" className="account-auth-error">{error}<button onClick={() => setAttempt(value => value + 1)} disabled={busy}><RotateCcw size={15} aria-hidden="true" />{t("Tentar novamente")}</button></p> : null}
    {loading ? <p role="status" className="home-rooms-loading">{t("Buscando suas salas…")}</p> : <>
      <div className="home-room-grid">{rooms.map(room => <article key={room.session_id}><div className="home-room-top"><span><Bookmark size={16} aria-hidden="true" />{room.code}</span><span>{t("Salva em") + " "}{new Date(room.saved_at).toLocaleDateString(currentLocale())}</span></div><h3>{room.name}</h3><p>{t("O grupo pode continuar daqui.")}</p><div className="home-room-actions"><Link to={`/s/${room.code}`}>{t("Retomar")}<ArrowUpRight size={17} aria-hidden="true" /></Link><DeleteButton label={`Deixar de salvar ${room.name}`} confirming={confirm === room.session_id} disabled={busy} onConfirm={() => setConfirm(room.session_id)} onDelete={() => void remove(room.session_id)} onCancel={() => setConfirm(null)} /></div></article>)}</div>
      {!rooms.length && !error ? <div className="home-rooms-empty"><Bookmark size={24} aria-hidden="true" /><div><h3>{t("A próxima sessão começa com você.")}</h3><p>{t("Crie uma sala e use “Salvar sala” para encontrá-la aqui depois.")}</p></div></div> : null}
    </>}
  </section>
}
