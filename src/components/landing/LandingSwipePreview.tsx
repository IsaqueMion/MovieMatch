import {
  useEffect,
  useState,
} from 'react'
import {
  Share2,
  SlidersHorizontal,
  Star,
} from 'lucide-react'

import {
  discoverMovies,
  getMovieDetails,
  type DiscoverFilters,
  type MovieDetails,
} from '../../lib/functions'
import { ensureAnonymousUser } from '../../lib/auth'
import SwipeActionButtons from '../swipe/SwipeActionButtons'
import SwipeCard, {
  type SwipeMovie,
} from '../swipe/SwipeCard'

const LANDING_FILTERS: DiscoverFilters = {
  genres: [],
  excludeGenres: [],
}

export default function LandingSwipePreview() {
  const [movie, setMovie] =
    useState<SwipeMovie | null>(null)
  const [details, setDetails] =
    useState<MovieDetails | undefined>()

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        await ensureAnonymousUser()

        const data =
          await discoverMovies({
            page:
              1 +
              Math.floor(
                Math.random() * 4,
              ),
            filters:
              LANDING_FILTERS,
          })

        const result =
          (data?.results ?? [])
            .find(
              (item) =>
                Boolean(
                  item.poster_url,
                ),
            ) ??
          data?.results?.[0]

        if (
          cancelled ||
          !result
        ) {
          return
        }

        const nextMovie: SwipeMovie = {
          movie_id:
            result.movie_id,
          tmdb_id:
            result.tmdb_id,
          title:
            result.title,
          year:
            result.year ?? null,
          poster_url:
            result.poster_url,
          genres:
            result.genres ?? [],
        }

        setMovie(nextMovie)

        try {
          const nextDetails =
            await getMovieDetails(
              result.tmdb_id,
              {
                region: 'BR',
              },
            )

          if (!cancelled) {
            setDetails(
              nextDetails,
            )
          }
        } catch (error) {
          console.warn(
            'landing preview details failed:',
            error,
          )
        }
      } catch (error) {
        console.warn(
          'landing preview failed:',
          error,
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-[390px]">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 p-2.5 shadow-2xl shadow-black/30">
        <div className="mb-2 flex h-10 items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 ring-1 ring-white/10">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-white/80">
            <span className="rounded-md bg-white/10 px-2 py-1 font-semibold tracking-wide text-white">
              DEMO
            </span>

            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              2 online
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <PreviewIcon
              label="Filtros"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" />
            </PreviewIcon>
            <PreviewIcon
              label="Compartilhar"
            >
              <Share2 className="h-[18px] w-[18px]" />
            </PreviewIcon>
            <div
              className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-white"
              aria-hidden
            >
              <Star className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>

        <div className="h-[clamp(360px,52dvh,430px)] min-h-0 overflow-hidden">
          {movie ? (
            <div className="pointer-events-none h-full">
              <SwipeCard
                movie={movie}
                details={details}
                onDragState={() => {}}
                onDecision={() => {}}
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center overflow-hidden rounded-xl bg-neutral-900/70">
              <div className="w-[78%]">
                <div className="aspect-[2/3] animate-pulse rounded-xl bg-white/10" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-white/10" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-2">
          <SwipeActionButtons
            interactive={false}
          />
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-white/35">
        Prévia da experiência de votação
      </p>
    </div>
  )
}

function PreviewIcon({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white"
      aria-label={label}
      role="img"
    >
      {children}
    </div>
  )
}
