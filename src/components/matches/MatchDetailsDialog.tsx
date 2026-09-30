import { useEffect, useRef } from 'react'
import { ArrowUpRight, Check, Play, Star, X } from 'lucide-react'
import type { MovieDetails } from '../../lib/functions'
import { extractProviders, resolveProviderLink } from '../../lib/matchProviders'
import MatchPoster from './MatchPoster'
import CinemaButton from '../ui/cinema-button'

type Props = {
  item: { title: string; year: number | null; poster_url: string | null; tmdb_id: number | null; likes: number; member_count: number }
  details: MovieDetails | null
  loading: boolean
  region: string
  onClose: () => void
}

export default function MatchDetailsDialog({ item, details, loading, region, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  const { providers, regionLink } = extractProviders(details, region)
  const trailer = details?.trailer?.key
  const search = 'https://www.google.com/search?q=' + encodeURIComponent(`${item.title} ${item.year ?? ''} onde assistir`)

  return (
    <dialog ref={dialogRef} className="matches-dialog" aria-labelledby="match-detail-title"
      onCancel={event => { event.preventDefault(); onClose() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], iframe, [tabindex="0"]')].filter(element => element.getClientRects().length > 0)
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}>
      <div className="matches-dialog-header"><span className="cinema-eyebrow"><Check size={14} aria-hidden="true" />Escolha do grupo</span><button className="matches-icon-button" onClick={onClose} aria-label="Fechar detalhes" autoFocus><X size={20} aria-hidden="true" /></button></div>
      <div className="matches-dialog-content">
        <MatchPoster title={item.title} poster={item.poster_url} priority />
        <div className="matches-dialog-copy">
          <p className="matches-film-year">{item.year ?? 'Ano não informado'} <span>· {item.likes} de {item.member_count} curtiram</span></p>
          <h2 id="match-detail-title">{item.title}</h2>
          <div className="matches-movie-facts" aria-busy={loading}>
            {loading ? <p role="status">Carregando detalhes…</p> : <>
              {typeof details?.vote_average === 'number' ? <span><Star size={15} aria-hidden="true" />{details.vote_average.toFixed(1)} <small>TMDB</small></span> : null}
              {details?.runtime ? <span>{details.runtime} min</span> : null}
              {details?.age_rating ? <span>Classificação {details.age_rating}</span> : null}
            </>}
          </div>
          {details?.genres?.length ? <p className="matches-genres">{details.genres.map(genre => genre.name).join(' · ')}</p> : null}
          <p className="matches-synopsis">{loading ? 'Preparando os detalhes do seu próximo filme.' : details?.overview || 'A sinopse não está disponível agora. Você pode consultar mais informações no TMDB.'}</p>
          <section className="matches-watch" aria-label="Onde assistir">
            <h3>Onde assistir <span>{region}</span></h3>
            {providers.length ? <div className="matches-providers">{providers.map(provider => {
              const { href, label } = resolveProviderLink(provider, item.title, region, regionLink, item.tmdb_id)
              return <a key={provider.id} href={href} title={`${label}: ${item.title} · ${provider.name}`} target="_blank" rel="noopener noreferrer"><img src={provider.logoUrl || '/providers/generic.svg'} alt="" width={28} height={28} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/providers/generic.svg' }} /><span>{provider.name}<small>{label}</small></span><ArrowUpRight size={14} aria-hidden="true" /></a>
            })}</div> : <p>{loading ? 'Consultando as plataformas…' : 'Nenhuma plataforma informada para esta região.'}</p>}
            {!loading ? <div className="matches-watch-links">{regionLink ? <a href={regionLink} target="_blank" rel="noopener noreferrer">Consultar disponibilidade <ArrowUpRight size={14} aria-hidden="true" /></a> : null}<a href={search} target="_blank" rel="noopener noreferrer">Buscar onde assistir <ArrowUpRight size={14} aria-hidden="true" /></a></div> : null}
            {providers.length ? <p className="matches-provider-source">Disponibilidade: <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a> via TMDB.</p> : null}
          </section>
          {item.tmdb_id != null ? <a className="matches-tmdb-link" href={`https://www.themoviedb.org/movie/${item.tmdb_id}`} target="_blank" rel="noopener noreferrer">Mais sobre o filme no TMDB <ArrowUpRight size={14} aria-hidden="true" /></a> : null}
        </div>
      </div>
      {trailer ? <section className="matches-trailer"><h3><Play size={17} aria-hidden="true" />Uma prévia antes do play</h3><div><iframe src={`https://www.youtube.com/embed/${encodeURIComponent(trailer)}?playsinline=1&rel=0`} title={`Trailer de ${item.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" /></div></section> : null}
      <div className="matches-dialog-footer"><CinemaButton direction="right" tone="secondary" compact onClick={onClose}>Voltar à seleção</CinemaButton></div>
    </dialog>
  )
}
