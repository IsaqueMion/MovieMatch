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

import type { SwipeCardHandle } from './SwipeCard'
import {
  DRAG_LIMIT,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
  TWEEN_SNAP,
  TWEEN_SWIPE,
  vibrate,
} from './swipeMotion'

type AdSwipeCardProps = {
  onDragState: (dragging: boolean) => void
  onDecision: (value: 1 | -1) => void
}

const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,video,iframe,[data-interactive="true"]'

const AdSwipeCard = forwardRef<
  SwipeCardHandle,
  AdSwipeCardProps
>(function AdSwipeCard(
  { onDragState, onDecision },
  ref,
) {
  const x = useMotionValue(0)
  const rotate = useTransform(
    x,
    [-DRAG_LIMIT, 0, DRAG_LIMIT],
    [-4, 0, 4],
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

        vibrate(6)

        const controls = animate(x, endX, TWEEN_SWIPE)
        controls.then(() => onDecision(value))
      },
    }),
    [onDecision, x],
  )

  return (
    <motion.div
      className="h-full will-change-transform relative"
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
          vibrate(6)

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
      <div className="h-full grid grid-rows-[1fr_auto] gap-2">
        <div className="relative min-h-0 h-full">
          <div className="w-full h-full grid place-items-center">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-700/20 to-cyan-600/20 ring-1 ring-white/10 p-5 text-white w-[min(92vw,22rem)]">
              <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">
                Publicidade
              </div>

              <div className="text-lg font-semibold">
                Dica de hoje 🍿
              </div>

              <p className="text-sm text-white/80 mt-1">
                Aproveite filmes sem anúncios futuramente
                com o plano simbólico.
              </p>

              <div className="mt-3 text-xs text-white/60">
                Deslize para continuar
              </div>
            </div>
          </div>
        </div>

        <div
          className="text-white shrink-0 text-center text-xs opacity-70"
          data-interactive="true"
        >
          Este card não conta como like/dislike
        </div>
      </div>
    </motion.div>
  )
})

export default AdSwipeCard
