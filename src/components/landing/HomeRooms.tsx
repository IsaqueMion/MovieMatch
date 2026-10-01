import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, Check, Film, RotateCcw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { savedRooms, type SavedRoom } from '../../lib/account'
import { useAccount } from '../../hooks/useAccount'
import '../../styles/account.css'

export default function HomeRooms() {
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
      if (account.registered) { setLoading(true); setError(''); void savedRooms().then(rows => { if (active) setRooms(rows) }).catch(() => { if (active) setError('Não foi possível carregar suas salas.') }).finally(() => { if (active) setLoading(false) }) }
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
    if (error) setError('Não foi possível remover. Tente novamente.')
    else { setRooms(rows => rows.filter(room => room.session_id !== id)); setConfirm(null) }
    setBusy(false)
  }
  if (!account.registered) return null
  return <section className="home-rooms cinema-container" id="minhas-salas" aria-labelledby="home-rooms-title">
    <div className="home-rooms-heading"><div><p className="cinema-eyebrow"><Bookmark size={14} aria-hidden="true" />O próximo play está aqui</p><h2 id="home-rooms-title">Continue de onde parou.</h2><p>Suas salas salvas, com os votos e matches do grupo.</p></div><Link to="/assistidos"><Film size={17} aria-hidden="true" />Meus assistidos<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    {error ? <p role="alert" className="account-auth-error">{error}<button onClick={() => setAttempt(value => value + 1)} disabled={busy}><RotateCcw size={15} aria-hidden="true" />Tentar novamente</button></p> : null}
    {loading ? <p role="status" className="home-rooms-loading">Buscando suas salas…</p> : <>
      <div className="home-room-grid">{rooms.map(room => <article key={room.session_id}><div className="home-room-top"><span><Bookmark size={16} aria-hidden="true" />{room.code}</span><span>Salva em {new Date(room.saved_at).toLocaleDateString('pt-BR')}</span></div><h3>{room.name}</h3><p>O grupo pode continuar daqui.</p><div className="home-room-actions"><Link to={`/s/${room.code}`}>Retomar<ArrowUpRight size={17} aria-hidden="true" /></Link><button aria-label={`Deixar de salvar ${room.name}`} title="Deixar de salvar" disabled={busy} onClick={() => setConfirm(room.session_id)}><X size={17} aria-hidden="true" /></button></div>{confirm === room.session_id ? <div className="home-room-confirm"><p>Se ninguém mais salvou esta sala, ela voltará a expirar em 24 horas.</p><button disabled={busy} onClick={() => void remove(room.session_id)}><Check size={15} aria-hidden="true" />Remover da minha lista</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button></div> : null}</article>)}</div>
      {!rooms.length && !error ? <div className="home-rooms-empty"><Bookmark size={24} aria-hidden="true" /><div><h3>A próxima sessão começa com você.</h3><p>Crie uma sala e use “Salvar sala” para encontrá-la aqui depois.</p></div></div> : null}
    </>}
  </section>
}
