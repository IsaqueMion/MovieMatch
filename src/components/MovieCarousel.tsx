// src/components/MovieCarousel.tsx
import type { MovieDetails } from '../lib/functions'

type Props = {
  title: string
  year: number | null
  poster_url: string
  fullHeight?: boolean
  details?: MovieDetails
}

export default function MovieCarousel({ title, year, poster_url, fullHeight, details }: Props) {
  return (
    <div className={`relative ${fullHeight ? 'h-full' : ''}`}>
      {/* container do pôster */}
      <div
        className="aspect-[3/4] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 bg-neutral-900/70 grid place-items-center"
      >
        {poster_url ? (
          <img
            src={poster_url}
            alt={`${title}${year ? ` (${year})` : ''}`}
            className="max-h-full max-w-full object-contain"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="text-white/50">Sem imagem</div>
        )}

        {/* badge de nota (opcional) */}
        {details?.vote_average != null && (
          <div className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs ring-1 ring-white/10">
            ⭐ {details.vote_average.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  )
}
