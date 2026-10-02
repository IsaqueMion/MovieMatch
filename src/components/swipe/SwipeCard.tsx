import { usePrefersReducedMotion as useReducedMotion } from '../../hooks/usePrefersReducedMotion'
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
  reset: () => void
}

type SwipeCardProps = {
  movie: SwipeMovie
  details?: MovieDetails
  onDragState: (dragging: boolean) => void
  onDecision: (value: 1 | -1) => void
  fitPoster?: boolean
  edgeToEdgePoster?: boolean
  onReviews?: () => void
}

const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,video,iframe,[data-interactive="true"]'

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard(
    {
      movie,
      details,
      onDragState,
      onDecision,
      fitPoster = false,
      edgeToEdgePoster = false,
      onReviews,
    },
    ref,
  ) {
    const reducedMotion = useReducedMotion()
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
          const endX =
            direction * (window.innerWidth + 180)

          vibrate(10)

          const controls = animate(
            x,
            endX,
            reducedMotion ? { ...TWEEN_SWIPE, duration: 0 } : TWEEN_SWIPE,
          )

          controls.then(() => onDecision(value))
        },

        reset: () => {
          animate(x, 0, reducedMotion ? { ...TWEEN_SNAP, duration: 0 } : TWEEN_SNAP)
        },
      }),
      [onDecision, reducedMotion, x],
    )

    return (
      <motion.div
        className="swipe-film relative h-full w-full will-change-transform"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.12 }}
        style={{ x, rotate: reducedMotion ? 0 : rotate, touchAction: 'pan-y' }}
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
              animate(x, endX, reducedMotion ? { ...TWEEN_SWIPE, duration: 0 } : TWEEN_SWIPE)

            controls.then(() =>
              onDecision(direction === 1 ? 1 : -1),
            )
          } else {
            animate(x, 0, reducedMotion ? { ...TWEEN_SNAP, duration: 0 } : TWEEN_SNAP)
          }
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-4">
          <motion.div
            style={{ opacity: dislikeOpacity }}
            className="rounded-lg border-2 border-red-500/70 text-red-500/90 px-3 py-1.5 font-semibold rotate-[-6deg] bg-black/20"
          >
            PASSO
          </motion.div>

          <motion.div
            style={{ opacity: likeOpacity }}
            className="rounded-lg border-2 border-emerald-500/70 text-emerald-400 px-3 py-1.5 font-semibold rotate-[6deg] bg-black/20"
          >
            QUERO VER
          </motion.div>
        </div>

        <div
          className={`swipe-film-layout${fitPoster ? ' is-fit-poster' : ''}`}
        >
          <div className="swipe-poster-column"><div className="swipe-poster-frame">
            <MovieCarousel
              key={movie.tmdb_id}
              title={movie.title}
              year={movie.year}
              poster_url={movie.poster_url || ''}
              details={details}
              fullHeight
              edgeToEdge={edgeToEdgePoster}
              onReviews={onReviews}
            />
          </div></div>

          <h3 className="swipe-film-title line-clamp-1 sr-only">{movie.title}</h3>
        </div>
      </motion.div>
    )
  },
)

export default SwipeCard
