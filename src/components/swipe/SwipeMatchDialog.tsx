import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useRef } from 'react'
import { Check, Heart, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import CinemaButton from '../ui/cinema-button'
import MatchPoster from '../matches/MatchPoster'
import { trapDialogFocus } from '../../lib/dialogFocus'

type Props = {
  movie: { title: string; year?: number | null; poster_url: string | null }
  code: string
  onClose: () => void
  onMatches: () => void
}

export default function SwipeMatchDialog({ movie, code, onClose, onMatches }: Props) {
  useLocale()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener?.isConnected && !opener.matches(':disabled')) opener.focus({ preventScroll: true })
      else document.querySelector<HTMLButtonElement>('.cinema-vote-button.is-like:not(:disabled)')?.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={ref} className="swipe-match-dialog" aria-labelledby="swipe-match-title" onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>
    <button type="button" className="swipe-dialog-close" onClick={onClose} aria-label={t("Fechar match")} autoFocus><X size={20} aria-hidden="true" /></button>
    <p className="cinema-eyebrow"><Check size={14} aria-hidden="true" />{t("A escolha de todos")}</p>
    <h2 id="swipe-match-title">{t("Deu") + " "}<span>{t("match.")}</span></h2>
    <div className="swipe-match-film"><MatchPoster title={movie.title} poster={movie.poster_url} priority /><div><Heart size={22} aria-hidden="true" /><h3>{movie.title}</h3><p>{movie.year}</p><small>{t("Todo mundo disse sim.")}</small></div></div>
    <div className="swipe-match-dialog-actions"><CinemaButton tone="secondary" direction="right" compact onClick={onClose}>{t("Continuar")}</CinemaButton><Link className="swipe-match-link" to={`/s/${code}/matches`} onClick={onMatches}>{t("Ver matches") + " "}<Heart size={16} aria-hidden="true" /></Link></div>
  </dialog>
}
