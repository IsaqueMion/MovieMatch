import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AnimatePresence,
  motion,
} from 'framer-motion'
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
      }, 3200)

    return () => {
      window.clearInterval(timer)
    }
  }, [items])

  const current = items[index]
  const hasCarousel =
    Boolean(current)

  const dots = useMemo(() => {
    const max =
      Math.min(
        6,
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
    <motion.div
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.35,
        ease: 'easeOut',
      }}
      className="relative"
    >
      <div
        className="relative mx-auto w-[min(28rem,92vw)] overflow-hidden rounded-3xl bg-neutral-900/60 ring-1 ring-white/10 shadow-xl"
        onMouseEnter={() => {
          pausedRef.current = true
        }}
        onMouseLeave={() => {
          pausedRef.current = false
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Users className="h-4 w-4 text-emerald-300" />
            2 online
          </div>

          <div className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-xs ring-1 ring-white/10">
            <Heart className="h-3.5 w-3.5 text-emerald-300" />
            Match instantâneo
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-neutral-800 ring-1 ring-white/10">
            <AnimatePresence
              mode="wait"
              initial={false}
            >
              {loading ? (
                <motion.div
                  key="skeleton"
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SkeletonPoster />
                </motion.div>
              ) : hasCarousel &&
                current ? (
                <motion.img
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
                  initial={{
                    opacity: 0,
                    scale: 1.02,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 1.02,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: 'easeOut',
                  }}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <motion.div
                  key="fallback"
                  className="absolute inset-0 grid place-items-center text-white/50"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                >
                  <Film className="h-16 w-16" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-900/80 to-transparent" />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AnimatePresence
                mode="wait"
                initial={false}
              >
                <motion.h3
                  key={
                    current
                      ? `${current.title}-${current.year ?? ''}`
                      : 'placeholder-title'
                  }
                  className="truncate text-base font-semibold"
                  initial={{
                    opacity: 0,
                    y: 6,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -6,
                  }}
                  transition={{
                    duration: 0.25,
                  }}
                >
                  {current ? (
                    <>
                      {current.title}{' '}
                      {current.year ? (
                        <span className="text-white/60">
                          (
                          {current.year}
                          )
                        </span>
                      ) : null}
                    </>
                  ) : (
                    'Um Filme Qualquer (2024)'
                  )}
                </motion.h3>
              </AnimatePresence>

              <p className="mt-1 flex flex-wrap gap-1 text-xs text-white/70">
                <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
                  Sugerido
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
                  Aleatório
                </span>
              </p>
            </div>

            {dots ? (
              <div className="flex shrink-0 items-center gap-1.5">
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
                            ? 'h-2 w-4 rounded-full bg-white transition-all'
                            : 'h-2 w-2 rounded-full bg-white/40 transition-all hover:bg-white/60'
                        }
                        aria-label={`Ir ao slide ${realIndex + 1}`}
                      />
                    )
                  },
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-center gap-5 pb-2">
            <button
              type="button"
              className="grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white shadow-xl"
              aria-label="Dislike"
            >
              <XIcon className="h-6 w-6" />
            </button>

            <button
              type="button"
              className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white shadow-lg ring-1 ring-white/10"
              aria-label="Ver trailer"
            >
              <Play className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-xl"
              aria-label="Like"
            >
              <Heart className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SkeletonPoster() {
  return (
    <div className="h-full w-full">
      <div className="absolute inset-0 animate-pulse bg-neutral-800" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_60%)]" />
    </div>
  )
}
