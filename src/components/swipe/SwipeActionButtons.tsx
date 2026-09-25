import {
  Heart,
  Undo2,
  X as XIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'

type SwipeActionButtonsProps = {
  onDislike?: () => void
  onUndo?: () => void
  onLike?: () => void
  dislikeDisabled?: boolean
  undoDisabled?: boolean
  likeDisabled?: boolean
  interactive?: boolean
}

export default function SwipeActionButtons({
  onDislike,
  onUndo,
  onLike,
  dislikeDisabled = false,
  undoDisabled = false,
  likeDisabled = false,
  interactive = true,
}: SwipeActionButtonsProps) {
  const previewProps =
    interactive
      ? {}
      : {
          tabIndex: -1,
          'aria-hidden': true,
        }

  return (
    <div
      className={
        interactive
          ? 'mx-auto flex max-w-md items-center justify-center gap-5 sm:gap-6'
          : 'pointer-events-none mx-auto flex max-w-md items-center justify-center gap-5 sm:gap-6'
      }
    >
      <motion.button
        type="button"
        onClick={onDislike}
        disabled={
          interactive &&
          dislikeDisabled
        }
        className="grid h-14 w-14 touch-manipulation place-items-center rounded-full bg-red-500 text-white shadow-xl transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 sm:h-16 sm:w-16"
        aria-label="Dislike"
        whileHover={
          interactive
            ? { scale: 1.06 }
            : undefined
        }
        whileTap={
          interactive
            ? {
                scale: 0.92,
                rotate: -6,
              }
            : undefined
        }
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 18,
        }}
        {...previewProps}
      >
        <XIcon className="h-7 w-7 sm:h-8 sm:w-8" />
      </motion.button>

      <motion.button
        type="button"
        onClick={onUndo}
        disabled={
          interactive &&
          undoDisabled
        }
        className="grid h-11 w-11 touch-manipulation place-items-center rounded-full bg-white/10 text-white shadow-lg transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 sm:h-12 sm:w-12"
        aria-label="Desfazer"
        whileHover={
          interactive
            ? { scale: 1.06 }
            : undefined
        }
        whileTap={
          interactive
            ? { scale: 0.94 }
            : undefined
        }
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
        }}
        {...previewProps}
      >
        <Undo2 className="h-5 w-5 sm:h-6 sm:w-6" />
      </motion.button>

      <motion.button
        type="button"
        onClick={onLike}
        disabled={
          interactive &&
          likeDisabled
        }
        className="grid h-14 w-14 touch-manipulation place-items-center rounded-full bg-emerald-500 text-white shadow-xl transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 sm:h-16 sm:w-16"
        aria-label="Like"
        whileHover={
          interactive
            ? { scale: 1.08 }
            : undefined
        }
        whileTap={
          interactive
            ? {
                scale: 0.92,
                rotate: 6,
              }
            : undefined
        }
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 18,
        }}
        {...previewProps}
      >
        <Heart className="h-7 w-7 sm:h-8 sm:w-8" />
      </motion.button>
    </div>
  )
}
