import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Clapperboard, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { savedRooms, type SavedRoom } from '../lib/account'
import { useAccount } from '../hooks/useAccount'
import { usePageMeta } from '../hooks/usePageMeta'
import AccountMenu from '../components/account/AccountMenu'
import SessionLoader from '../components/ui/session-loader'
import '../styles/account.css'

export default function SavedRooms() {
  const account = useAccount()
  const [rooms, setRooms] = useState<SavedRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  usePageMeta({ title: 'Minhas salas — MovieMatch', description: 'Retome as sessões que você salvou.', robots: 'noindex,nofollow,noarchive' })
  useEffect(() => {
    let active = true
    if (!account.loading) {
      if (account.registered) void savedRooms().then(rows => { if (active) setRooms(rows) }).catch(() => { if (active) setError('Não foi possível carregar suas salas. Recarregue para tentar novamente.') }).finally(() => { if (active) setLoading(false) })
      else setLoading(false)
    }
    return () => { active = false }
  }, [account.loading, account.registered])
  async function remove(id: string) {
    setBusy(true); setError('')
    const { error } = await supabase.from('saved_sessions').delete().eq('session_id', id).select('session_id').single()
    if (error) setError('Não foi possível remover. Tente novamente.')
    else { setRooms(rows => rows.filter(room => room.session_id !== id)); setConfirm(null) }
    setBusy(false)
  }
  return <div className="cinema-page account-page"><header className="cinema-container account-header"><Link className="cinema-brand" to="/"><Clapperboard aria-hidden="true" size={22} />MovieMatch<span className="cinema-brand-dot">.</span></Link><AccountMenu /></header><main id="conteudo" className="cinema-container account-content"><p className="cinema-eyebrow"><Bookmark size={14} aria-hidden="true" />Para o próximo play</p><h1>O grupo pode<br /><span>continuar daqui.</span></h1><p>Suas salas salvas não expiram. Filtros, votos e matches continuam esperando por vocês.</p>
    {error ? <p role="alert" className="library-error">{error}</p> : null}
    {account.loading || loading ? <SessionLoader /> : !account.registered ? <p><Link className="account-link" to="/conta?voltar=%2Fsalas">Entre na sua conta</Link> para salvar e retomar salas. Você pode <Link to="/">criar uma sessão sem cadastro</Link>.</p> : <>
      <div className="account-room-list">{rooms.map(room => <article key={room.session_id}><div><small>Sessão {room.code}</small><h2>{room.name}</h2><small>Salva em {new Date(room.saved_at).toLocaleDateString('pt-BR')}</small></div><Link className="account-link" to={`/s/${room.code}`}>Retomar <ArrowUpRight size={17} aria-hidden="true" /></Link>{confirm === room.session_id ? <div className="account-confirm"><p>Se ninguém mais salvou esta sala, ela voltará a expirar em 24 horas.</p><button disabled={busy} onClick={() => void remove(room.session_id)}>Remover da minha lista</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button></div> : <button onClick={() => setConfirm(room.session_id)}>Deixar de salvar</button>}</article>)}</div>
      {!rooms.length ? <div className="account-empty"><h2>A próxima sessão começa com você.</h2><p>Abra uma sala e use “Salvar sala” para encontrá-la aqui depois.</p></div> : null}<Link className="account-link" to="/">Criar uma nova sessão <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </>}
  </main></div>
}
