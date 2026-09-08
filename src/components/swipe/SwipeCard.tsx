import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
} from 'framer-motion'
import { Star } from 'lucide-react'

import type { MovieDetails } from '../../lib/functions'
import MovieCarousel from '../MovieCarousel'
import {
  DRAG_LIMIT,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
  TWEEN_SNAP,
  TWEEN_SWIPE,
  vibrate,
} from './swipeMotion'

export type SwipeMovie = {
  movie_id: number
  tmdb_id: number
  title: string
  year: number | null
  poster_url: string | null
  genres: number[]
}

export type SwipeCardHandle = {
  swipe: (value: 1 | -1) => void
}

type SwipeCardProps = {
  movie: SwipeMovie
  details?: MovieDetails
  onDragState: (dragging: boolean) => void
  onDecision: (value: 1 | -1) => void
}

const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,video,iframe,[data-interactive="true"]'

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard(
    { movie, details, onDragState, onDecision },
    ref,
  ) {
    const x = useMotionValue(0)
    const rotate = useTransform(
      x,
      [-DRAG_LIMIT, 0, DRAG_LIMIT],
      [-6, 0, 6],
    )
    const likeOpacity = useTransform(
      x,
      [32, DRAG_LIMIT],
      [0, 1],
      { clamp: true },
    )
    const dislikeOpacity = useTransform(
      x,
      [-DRAG_LIMIT, -32],
      [1, 0],
      { clamp: true },
    )

    useEffect(() => {
      x.set(0)
    }, [x])

    const dragControls = useDragControls()

    function handlePointerDown(event: ReactPointerEvent) {
      const target = event.target as HTMLElement

      if (target.closest(INTERACTIVE_SELECTOR)) {
        return
      }

      event.preventDefault()
      dragControls.start(event)
    }

    useImperativeHandle(
      ref,
      () => ({
        swipe: (value: 1 | -1) => {
          const direction = value === 1 ? 1 : -1
          const endX = direction * (window.innerWidth + 180)

          vibrate(10)

          const controls = animate(x, endX, TWEEN_SWIPE)
          controls.then(() => onDecision(value))
        },
      }),
      [onDecision, x],
    )

    return (
      <motion.div
        className="relative h-full w-full will-change-transform"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        style={{ x, rotate, touchAction: 'pan-y' }}
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragElastic={0.18}
        dragMomentum={false}
        dragConstraints={{
          left: -DRAG_LIMIT,
          right: DRAG_LIMIT,
        }}
        onPointerDownCapture={handlePointerDown}
        onDragStart={() => onDragState(true)}
        onDragEnd={(_, info) => {
          onDragState(false)

          const passDistance =
            Math.abs(info.offset.x) > SWIPE_DISTANCE
          const passVelocity =
            Math.abs(info.velocity.x) > SWIPE_VELOCITY
          const shouldSwipe =
            passDistance || passVelocity

          if (shouldSwipe) {
            vibrate(10)

            const direction =
              info.offset.x > 0 ? 1 : -1
            const endX =
              direction * (window.innerWidth + 180)

            const controls =
              animate(x, endX, TWEEN_SWIPE)

            controls.then(() =>
              onDecision(direction === 1 ? 1 : -1),
            )
          } else {
            animate(x, 0, TWEEN_SNAP)
          }
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-4">
          <motion.div
            style={{ opacity: dislikeOpacity }}
            className="rounded-lg border-2 border-red-500/70 text-red-500/90 px-3 py-1.5 font-semibold rotate-[-6deg] bg-black/20"
          >
            NOPE
          </motion.div>

          <motion.div
            style={{ opacity: likeOpacity }}
            className="rounded-lg border-2 border-emerald-500/70 text-emerald-400 px-3 py-1.5 font-semibold rotate-[6deg] bg-black/20"
          >
            LIKE
          </motion.div>
        </div>

        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden">
          <div className="relative min-h-0 overflow-hidden">
            <MovieCarousel
              key={movie.tmdb_id}
              title={movie.title}
              year={movie.year}
              poster_url={movie.poster_url || ''}
              details={details}
              fullHeight
            />
          </div>

          <div
            className="relative z-10 shrink-0 select-text text-white"
            data-interactive="true"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold leading-tight line-clamp-1">
                {movie.title}{' '}
                {movie.year ? (
                  <span className="text-white/60">
                    ({movie.year})
                  </span>
                ) : null}
              </h3>

              <div className="ml-3 inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[13px]">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="tabular-nums">
                  {details?.vote_average != null
                    ? details.vote_average.toFixed(1)
                    : '—'}
                </span>
              </div>
            </div>

            <div className="mt-1 flex min-h-[22px] flex-wrap items-start gap-1">
              {details?.genres?.length
                ? details.genres.slice(0, 3).map((genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/90"
                    >
                      {genre.name}
                    </span>
                  ))
                : null}
            </div>

            <div className="mt-1">
              <span className="text-[11px] text-white/70 mr-1.5">
                Classificação:
              </span>
              <span className="text-[11px] inline-flex items-center rounded-md bg-white/10 px-2 py-0.5">
                {details?.age_rating?.trim() || '—'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  },
)

export default SwipeCard
