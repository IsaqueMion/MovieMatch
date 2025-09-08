import { useEffect, useMemo, useState } from 'react'
import type { MovieDetails } from '../lib/functions'
import { tmdbPosterSrcs } from '../lib/images'


type Props = {
  title: string
  year: number | null
  poster_url: string
  details?: MovieDetails
  fullHeight?: boolean
}

// slides possíveis
type SlideKind = 'poster' | 'trailer' | 'synopsis'

// helpers para ler campos opcionais que não estão no tipo
function getTrailerKey(details?: MovieDetails): string | null {
  const key = (details as any)?.trailer?.key
  return typeof key === 'string' && key.length > 0 ? key : null
}
function getRuntime(details?: MovieDetails): number | undefined {
  const rt = (details as any)?.runtime
  return typeof rt === 'number' ? rt : undefined
}
function getOverview(details?: MovieDetails): string | undefined {
  const ov = (details as any)?.overview
  return typeof ov === 'string' && ov.length > 0 ? ov : undefined
}

export default function MovieCarousel({
  title,
  year,
  poster_url,
  details,
  fullHeight = true,
}: Props) {
  const trailerKey = getTrailerKey(details)
  const hasTrailer = !!details?.trailer?.key

  const slides = useMemo<SlideKind[]>(() => {
    const arr: SlideKind[] = ['poster']
    if (hasTrailer) arr.push('trailer')
    arr.push('synopsis')
    return arr
  }, [hasTrailer])

  const [slide, setSlide] = useState(0)

  // mantém índice válido ao mudar # de slides
  useEffect(() => {
    if (slide > slides.length - 1) setSlide(0)
  }, [slides.length, slide])

  // ao trocar de filme, volta ao primeiro slide
  useEffect(() => {
    setSlide(0)
  }, [poster_url, title])

  const next = () => setSlide((s) => (s + 1) % slides.length)
  const prev = () => setSlide((s) => (s - 1 + slides.length) % slides.length)

  const youtubeEmbed: string | null = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?playsinline=1&rel=0`
    : null

  const slideKey: SlideKind = slides[slide] ?? 'poster'
  const runtime = getRuntime(details)
  const overview = getOverview(details)

  return (
    <div className="w-full h-full select-none">
      <div className="relative h-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
        {/* área do slide */}
        <div className={`relative h-full ${fullHeight ? '' : 'min-h-[520px]'} bg-neutral-950 text-white`}>
          {/* Poster */}
          <FadeSlide visible={slideKey === 'poster'}>
            <PosterResponsive
              title={title}
              year={year}
              poster_url={poster_url}
              fullHeight={fullHeight}
            />
          </FadeSlide>

          {/* Trailer */}
          <FadeSlide visible={slideKey === 'trailer'}>
            {youtubeEmbed ? (
              <div
                className="w-full h-full flex items-center justify-center bg-black pb-24"
                data-interactive="true"   // 👈 impede drag aqui
              >
                <div className="relative h-full aspect-[9/16] max-h-full z-10">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={youtubeEmbed}
                    title={`${title} trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <Skeleton>Carregando trailer…</Skeleton>
            )}
          </FadeSlide>

          {/* Sinopse */}
          <FadeSlide visible={slideKey === 'synopsis'}>
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full max-w-sm mx-auto bg-white text-gray-900 p-4 rounded-xl shadow-lg">
                <h3 className="font-semibold text-lg">
                  {title}{year ? ` (${year})` : ''}
                </h3>
                <div className="mt-0.5 text-sm text-gray-600">
                  {typeof runtime === 'number' ? `${runtime} min` : '—'}
                  {details?.genres?.length ? ` • ${details.genres.map(g => g.name).join(' • ')}` : ''}
                </div>
                <div className="mt-3 text-sm leading-relaxed max-h-64 overflow-y-auto pr-1">
                  {overview || <Skeleton>Carregando sinopse…</Skeleton>}
                </div>
              </div>
            </div>
          </FadeSlide>

          {/* setas laterais */}
          {slides.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-full backdrop-blur"
                aria-label="Anterior"
              >
                ‹
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-full backdrop-blur"
                aria-label="Próximo"
              >
                ›
              </button>
            </>
          )}

          {/* Dots (esconde no trailer) */}
          {slides.length > 1 && slideKey !== 'trailer' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/20 rounded-full px-2 py-1 backdrop-blur">
              {slides.map((kind, idx) => (
                <button
                  key={kind}
                  onClick={() => setSlide(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition ${idx === slide ? 'bg-white' : 'bg-white/50'}`}
                  aria-label={`Ir para ${kind}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FadeSlide({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ zIndex: visible ? 1 : 0 }}
    >
      {children}
    </div>
  )
}

function Skeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full max-w-sm p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          {children ? <div className="text-xs text-gray-500">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}

function PosterResponsive({
  title, year, poster_url, fullHeight,
}: { title: string; year: number | null; poster_url: string; fullHeight?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { src, srcSet, sizes } = tmdbPosterSrcs(poster_url)
  const alt = `${title}${year ? ` (${year})` : ''}`

  return (
    <div className="w-full h-full relative bg-black">
      {/* skeleton suave enquanto carrega */}
      {!loaded && !error && (
        <div className="absolute inset-0 rounded-2xl bg-white/5 animate-pulse" />
      )}

      {!error ? (
        <img
          src={src || poster_url}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          className={`w-full h-full ${fullHeight ? 'object-cover' : 'object-contain'} rounded-2xl transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          // visível: carregue rápido; próximas telas usarão lazy naturalmente
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        // fallback elegante quando falhar
        <div className="w-full h-full rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] ring-1 ring-white/10 grid place-items-center text-center p-4">
          <div>
            <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-white/10 grid place-items-center text-white/80">🎬</div>
            <p className="text-white/80 text-sm">Sem pôster disponível</p>
            <p className="text-white/60 text-xs line-clamp-2 mt-1">{alt}</p>
          </div>
        </div>
      )}
    </div>
  )
}
