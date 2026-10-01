import { Link } from 'react-router-dom'
import { Bookmark, UserRound } from 'lucide-react'
import { useAccount } from '../../hooks/useAccount'
import { accountHref } from '../../lib/account'
import '../../styles/account.css'

export default function AccountMenu() {
  const account = useAccount()
  return <nav className="account-menu" aria-label="Sua conta">
    {account.registered ? <><Link to="/salas" title="Minhas salas"><Bookmark size={17} aria-hidden="true" /><span>Salas</span></Link><Link to="/perfil" title="Meu perfil"><UserRound size={17} aria-hidden="true" /><span>Perfil</span></Link></> : <Link to={typeof window === 'undefined' ? '/conta' : accountHref()}><UserRound size={17} aria-hidden="true" /><span>Entrar</span></Link>}
  </nav>
}
