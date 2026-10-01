import { BookCheck, Clapperboard, Heart, CircleHelp, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import ShareSessionButton from './ShareSessionButton'
import { useDemoSession } from '../../hooks/useDemoSession'
import AccountMenu from '../account/AccountMenu'
import SaveRoomButton from '../account/SaveRoomButton'
import ProfileAvatars from '../account/ProfileAvatars'

type Props = {
  code: string
  sessionId?: string | null
  onlineCount: number
  filtersCount: number
  hasNewMatch: boolean
  onFilters: () => void
  onMatches: () => void
  onHelp: () => void
}

export default function SwipeSessionHeader({ code, sessionId = null, onlineCount, filtersCount, hasNewMatch, onFilters, onMatches, onHelp }: Props) {
  const demo = useDemoSession(sessionId)
  return <header className="swipe-header">
    <Link className="cinema-brand" to="/" aria-label="MovieMatch, página inicial"><span className="cinema-brand-mark"><Clapperboard size={22} aria-hidden="true" /></span>MovieMatch<span className="cinema-brand-dot">.</span></Link>
    <div className="swipe-session"><span>Sessão <strong>{code.toUpperCase()}</strong>{demo ? <small className="cinema-demo-badge" title="Sala de testes com votos iniciais de exemplo">Testes</small> : null}</span><span className="swipe-online"><i aria-hidden="true" />{onlineCount} online</span>{sessionId ? <ProfileAvatars sessionId={sessionId} /> : null}<Link className="swipe-help" to={`/s/${code}/assistidos`} aria-label="Meus assistidos" title="Meus assistidos"><BookCheck size={17} aria-hidden="true" /></Link><button type="button" className="swipe-help" aria-label="Abrir tutorial de votação" title="Como votar" onClick={onHelp}><CircleHelp size={17} aria-hidden="true" /></button></div>
    <nav className="swipe-navigation" aria-label="Sua sessão">
      <SaveRoomButton sessionId={sessionId} code={code} />
      <button type="button" onClick={onFilters} className="swipe-tool" aria-label="Abrir filtros" title="Abrir filtros"><SlidersHorizontal size={18} aria-hidden="true" /><span>Filtros</span>{filtersCount > 0 ? <small aria-label={`${filtersCount} filtros ativos`}>{filtersCount}</small> : null}</button>
      <ShareSessionButton code={code} />
      <Link to={`/s/${code}/matches`} onClick={onMatches} className="swipe-tool swipe-matches" data-new-match={hasNewMatch ? '1' : undefined} aria-label={hasNewMatch ? 'Ver matches, há novos matches' : 'Ver matches'} title="Ver matches"><Heart size={18} aria-hidden="true" /><span>Matches</span>{hasNewMatch ? <i className="swipe-new-match" aria-hidden="true" /> : null}</Link>
    </nav>
    <AccountMenu />
  </header>
}
