import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Film,
  Heart,
  Play,
  Users,
  X as XIcon,
} from 'lucide-react'

import {
  discoverMovies,
  type DiscoverFilters,
} from '../../lib/functions'
import { ensureAnonymousUser } from '../../lib/auth'

const LANDING_FILTERS: DiscoverFilters = {
  genres: [],
  excludeGenres: [],
}

type CarouselItem = {
  title: string
  year: number | null
  poster_url: string
}

export default function LandingCarousel() {
  const [items, setItems] =
    useState<CarouselItem[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] =
    useState(true)

  const pausedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        await ensureAnonymousUser()

        const randomPage =
          1 +
          Math.floor(
            Math.random() * 5,
          )

        const data =
          await discoverMovies({
            page: randomPage,
            filters: LANDING_FILTERS,
          })

        if (cancelled) return

        const nextItems =
          (data?.results ?? [])
            .filter(
              (
                movie,
              ): movie is typeof movie & {
                poster_url: string
              } =>
                typeof movie.poster_url ===
                  'string' &&
                movie.poster_url.length > 0,
            )
            .slice(0, 8)
            .map(
              (
                movie,
              ): CarouselItem => ({
                title: movie.title,
                year:
                  movie.year ?? null,
                poster_url:
                  movie.poster_url,
              }),
            )

        setItems(nextItems)
        setIndex(0)
      } catch (error) {
        console.error(
          'landing carousel failed:',
          error,
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (items.length <= 1) return

    const timer =
      window.setInterval(() => {
        if (pausedRef.current) {
          return
        }

        setIndex(
          (current) =>
            (current + 1) %
            items.length,
        )
      }, 3600)

    return () => {
      window.clearInterval(timer)
    }
  }, [items])

  const current = items[index]

  const dots = useMemo(() => {
    const max =
      Math.min(
        5,
        items.length,
      )

    if (max <= 1) {
      return null
    }

    const start = Math.min(
      Math.max(
        0,
        index -
          Math.floor(max / 2),
      ),
      Math.max(
        0,
        items.length - max,
      ),
    )

    return {
      start,
      visible:
        items.slice(
          start,
          start + max,
        ),
    }
  }, [items, index])

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div
        className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900"
        onMouseEnter={() => {
          pausedRef.current = true
        }}
        onMouseLeave={() => {
          pausedRef.current = false
        }}
      >
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2 text-xs font-medium text-white/65">
            <Users className="h-4 w-4 text-emerald-400" />
            Sessão em andamento
          </div>

          <span className="text-xs text-white/35">
            2 online
          </span>
        </div>

        <div className="p-3">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-neutral-800">
            {loading ? (
              <div className="absolute inset-0 animate-pulse bg-neutral-800" />
            ) : current ? (
              <>
                <img
                  key={
                    current.poster_url
                  }
                  src={
                    current.poster_url
                  }
                  alt={
                    current.title
                  }
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent px-4 pb-4 pt-16">
                  <p className="truncate text-base font-semibold">
                    {current.title}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {current.year
                      ? `${current.year} · sugerido para a sessão`
                      : 'Sugerido para a sessão'}
                  </p>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-white/35">
                <Film className="h-12 w-12" />
              </div>
            )}
          </div>

          <div className="mt-3 flex min-h-5 items-center justify-between gap-3">
            <p className="text-xs text-white/45">
              Deslize para votar
            </p>

            {dots ? (
              <div className="flex items-center gap-1.5">
                {dots.visible.map(
                  (_, offset) => {
                    const realIndex =
                      dots.start +
                      offset

                    const active =
                      realIndex ===
                      index

                    return (
                      <button
                        type="button"
                        key={realIndex}
                        onClick={() => {
                          setIndex(
                            realIndex,
                          )
                        }}
                        className={
                          active
                            ? 'h-1.5 w-4 rounded-full bg-white'
                            : 'h-1.5 w-1.5 rounded-full bg-white/25 transition hover:bg-white/45'
                        }
                        aria-label={`Ir ao slide ${realIndex + 1}`}
                      />
                    )
                  },
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <PreviewAction
              icon={
                <XIcon className="h-4 w-4" />
              }
              label="Passar"
            />
            <PreviewAction
              icon={
                <Play className="h-4 w-4" />
              }
              label="Trailer"
            />
            <PreviewAction
              icon={
                <Heart className="h-4 w-4" />
              }
              label="Curtir"
              accent
            />
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-white/30">
        Exemplo da tela de votação
      </p>
    </div>
  )
}

function PreviewAction({
  icon,
  label,
  accent = false,
}: {
  icon: React.ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={
        accent
          ? 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-xs font-medium text-neutral-950'
          : 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/65'
      }
      aria-hidden
    >
      {icon}
      {label}
    </button>
  )
}
