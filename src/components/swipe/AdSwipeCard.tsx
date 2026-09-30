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
  const reducedMotion = useReducedMotion()
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
        const endX =
          direction * (window.innerWidth + 180)

        vibrate(6)

        const controls = animate(
          x,
          endX,
          reducedMotion ? { ...TWEEN_SWIPE, duration: 0 } : TWEEN_SWIPE,
        )

        controls.then(() =>
          onDecision(value),
        )
      },

      reset: () => {
        animate(x, 0, reducedMotion ? { ...TWEEN_SNAP, duration: 0 } : TWEEN_SNAP)
      },
    }),
    [onDecision, reducedMotion, x],
  )

  return (
    <motion.div
      className="relative h-full w-full will-change-transform"
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
          vibrate(6)

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
      <div className="grid h-full min-h-0 place-items-center px-1 py-2">
        <div className="swipe-ad-interlude">
          <div className="cinema-eyebrow">
            Publicidade
          </div>

          <h2>Uma pausa.<br /><span>Mais histórias.</span></h2>

          <p className="mt-1 text-sm leading-relaxed text-white/80">
            A publicidade ajuda a manter o MovieMatch gratuito.
            Seu próximo filme está logo ali.
          </p>

          <div className="mt-3 text-xs text-white/60">
            Deslize para continuar
          </div>

          <div
            className="mt-4 border-t border-white/10 pt-3 text-center text-[11px] text-white/45"
            data-interactive="true"
          >
            Este card não conta como like/dislike
          </div>
        </div>
      </div>
    </motion.div>
  )
})

export default AdSwipeCard
