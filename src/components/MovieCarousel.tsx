import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { AlignLeft, Film, MessageSquare, Play } from 'lucide-react'
import type { MovieDetails } from '../lib/functions'
import { tmdbPosterSrcs } from '../lib/images'
import catalogue from '../data/landingMovies.json'

type Props = {
  title: string
  year: number | null
  poster_url: string
  details?: MovieDetails
  fullHeight?: boolean
  edgeToEdge?: boolean
  onReviews?: () => void
}
type SlideKind = 'poster' | 'trailer' | 'synopsis'
const slideLabels = { poster: 'Pôster', trailer: 'Trailer', synopsis: 'Sinopse' }
const slideIcons = { poster: Film, trailer: Play, synopsis: AlignLeft }

export default function MovieCarousel({ title, year, poster_url, details, fullHeight = true, edgeToEdge = false, onReviews }: Props) {
  const id = useId()
  const trailerKey = details?.trailer?.key
  const slides = useMemo<SlideKind[]>(() => trailerKey ? ['poster', 'trailer', 'synopsis'] : ['poster', 'synopsis'], [trailerKey])
  const [slide, setSlide] = useState<SlideKind>('poster')
  useEffect(() => { setSlide('poster') }, [poster_url, title])
  const active = slides.includes(slide) ? slide : 'poster'

  return <div className={`swipe-carousel${fullHeight ? '' : ' is-natural-height'}${edgeToEdge ? ' is-edge-to-edge' : ''}`}>
    <div className="swipe-carousel-slides">
      <FadeSlide id={`${id}-poster`} tabId={`${id}-tab-poster`} visible={active === 'poster'}>
        <PosterResponsive title={title} year={year} poster_url={poster_url} edgeToEdge={edgeToEdge} />
      </FadeSlide>
      {trailerKey ? <FadeSlide id={`${id}-trailer`} tabId={`${id}-tab-trailer`} visible={active === 'trailer'}>
        <div className="swipe-trailer-slide" data-interactive="true">
          <span className="cinema-eyebrow">Uma prévia antes do play</span>
          {active === 'trailer' ? <div><iframe src={`https://www.youtube.com/embed/${encodeURIComponent(trailerKey)}?playsinline=1&rel=0`} title={`Trailer de ${title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : null}
        </div>
      </FadeSlide> : null}
      <FadeSlide id={`${id}-synopsis`} tabId={`${id}-tab-synopsis`} visible={active === 'synopsis'}>
        <div className="swipe-synopsis-slide" data-interactive="true">
          <p className="cinema-eyebrow">A história</p><h4>{title}</h4>
          <p className="swipe-synopsis-year">{year}{details?.runtime ? ` · ${details.runtime} min` : ''}</p>
          <div tabIndex={active === 'synopsis' ? 0 : -1} aria-label="Sinopse do filme">{details ? details.overview || 'Sinopse indisponível no momento.' : 'Preparando a sinopse…'}</div>
        </div>
      </FadeSlide>
    </div>
    <div className="swipe-carousel-tabs" role="group" aria-label="Conheça o filme" data-interactive="true">
      {slides.map(kind => {
        const Icon = slideIcons[kind]
        return <button key={kind} id={`${id}-tab-${kind}`} type="button" aria-label={slideLabels[kind]} title={slideLabels[kind]} aria-pressed={kind === active} aria-controls={`${id}-${kind}`} onClick={() => setSlide(kind)}><Icon size={14} aria-hidden="true" /><span>{slideLabels[kind]}</span></button>
      })}
      {onReviews ? <button type="button" onClick={onReviews} aria-label="Avaliações dos usuários" title="Avaliações dos usuários"><MessageSquare size={14} aria-hidden="true" /><span>Avaliações</span></button> : null}
    </div>
  </div>
}

function FadeSlide({ id, tabId, visible, children }: { id: string; tabId: string; visible: boolean; children: ReactNode }) {
  return <div id={id} role="region" aria-labelledby={tabId} aria-hidden={!visible} inert={!visible} className={`swipe-carousel-slide${visible ? ' is-visible' : ''}`}>{children}</div>
}

function PosterResponsive({ title, year, poster_url, edgeToEdge }: { title: string; year: number | null; poster_url: string; edgeToEdge: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { src, srcSet } = tmdbPosterSrcs(poster_url)
  const file = poster_url.split('/').pop()
  const preview = file ? catalogue.movies.find(movie => movie.poster.split('/').pop() === file)?.preview : undefined
  const alt = `${title}${year ? ` (${year})` : ''}`
  return <div className={`swipe-poster-image${loaded ? ' is-ready' : ''}`} style={preview ? { backgroundImage: `url("${preview}")` } : undefined}>
    {(!loaded && !preview) || error ? <div className="swipe-poster-placeholder" aria-hidden="true"><Film size={28} /><span>{title}</span><small>{error ? 'Pôster indisponível' : 'Preparando o pôster'}</small></div> : null}
    {!error && poster_url ? <img src={src || poster_url} srcSet={srcSet || undefined} sizes="(min-width: 900px) 390px, (max-height: 700px) 230px, 340px" width={500} height={750} alt={alt} draggable={false} loading="eager" fetchPriority="high" decoding="async" className={edgeToEdge ? 'is-edge-to-edge' : ''} onLoad={async event => {
      const image = event.currentTarget
      const source = image.currentSrc
      try { await image.decode() } catch { /* The loaded image can still be displayed. */ }
      if (image.isConnected && image.currentSrc === source) setLoaded(true)
    }} onError={() => setError(true)} /> : <span className="sr-only">Pôster indisponível de {title}</span>}
  </div>
}
