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
      <div className="aspect-[3/4] w-full overflow-hidden rounded-3xl ring-1 ring-white/10 bg-neutral-900/60 relative">
        {poster_url ? (
          <img
            src={poster_url}
            alt={`${title}${year ? ` (${year})` : ''}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/50">Sem imagem</div>
        )}

        {details?.vote_average != null && (
          <div className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs ring-1 ring-white/10">
            ⭐ {details.vote_average.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  )
}
