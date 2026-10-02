import { translate as t, useLocale } from '../../hooks/useLocale'
import { BookCheck, Clapperboard, Heart, CircleHelp, SlidersHorizontal, Ellipsis } from 'lucide-react'
import { useEffect, useRef } from 'react'
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
  useLocale()
  const demo = useDemoSession(sessionId)
  const more = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!more.current?.contains(event.target as Node) && more.current) more.current.open = false }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  return <header className="swipe-header">
    <Link className="cinema-brand" to="/" aria-label={t("MovieMatch, página inicial")}><span className="cinema-brand-mark"><Clapperboard size={22} aria-hidden="true" /></span>MovieMatch<span className="cinema-brand-dot">.</span></Link>
    <div className="swipe-session"><span>{t("Sessão") + " "}<strong>{code.toUpperCase()}</strong>{demo ? <small className="cinema-demo-badge" title={t("Sala de testes com votos iniciais de exemplo")}>{t("Testes")}</small> : null}</span><span className="swipe-online"><i aria-hidden="true" />{onlineCount}{" " + t("online")}</span>{sessionId ? <ProfileAvatars sessionId={sessionId} /> : null}</div>
    <nav className="swipe-navigation" aria-label={t("Sua sessão")}>
      <button type="button" onClick={onFilters} className="swipe-tool" aria-label={t("Abrir filtros")} title={t("Abrir filtros")}><SlidersHorizontal size={18} aria-hidden="true" /><span>{t("Filtros")}</span>{filtersCount > 0 ? <small aria-label={`${filtersCount} filtros ativos`}>{filtersCount}</small> : null}</button>
      <ShareSessionButton code={code} />
      <Link to={`/s/${code}/matches`} onClick={onMatches} className="swipe-tool swipe-matches" data-new-match={hasNewMatch ? '1' : undefined} aria-label={hasNewMatch ? t("Ver matches, há novos matches") : t("Ver matches")} title={t("Ver matches")}><Heart size={18} aria-hidden="true" /><span>Matches</span>{hasNewMatch ? <i className="swipe-new-match" aria-hidden="true" /> : null}</Link>
      <details className="swipe-more" ref={more} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && more.current) { more.current.open = false; more.current.querySelector('summary')?.focus() } }}>
        <summary aria-label={t('Mais opções da sessão')} title={t('Mais opções da sessão')}><Ellipsis size={19} aria-hidden="true" /></summary>
        <div className="swipe-more-panel">
          <SaveRoomButton sessionId={sessionId} code={code} />
          <Link to={`/s/${code}/assistidos`} onClick={() => { if (more.current) more.current.open = false }}><BookCheck size={17} aria-hidden="true" />{t('Meus assistidos')}</Link>
          <button type="button" onClick={() => { if (more.current) { more.current.open = false; more.current.querySelector('summary')?.focus() } onHelp() }} aria-label={t('Abrir tutorial de votação')}><CircleHelp size={17} aria-hidden="true" />{t('Como votar')}</button>
        </div>
      </details>
    </nav>
    <AccountMenu />
  </header>
}
