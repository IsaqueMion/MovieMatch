export const DRAG_LIMIT = 160
export const SWIPE_DISTANCE = 120
export const SWIPE_VELOCITY = 800

export const TWEEN_SWIPE = {
  type: 'tween' as const,
  duration: 0.18,
  ease: 'easeOut' as const,
}

export const TWEEN_BUTTON_SWIPE = {
  ...TWEEN_SWIPE,
  duration: 0.3,
  ease: [0.77, 0, 0.175, 1] as const,
}

export const TWEEN_SNAP = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
}

export function swipeDirection(offset: number, velocity: number): 1 | -1 | null {
  if (Math.abs(velocity) > SWIPE_VELOCITY) return velocity > 0 ? 1 : -1
  if (Math.abs(offset) > SWIPE_DISTANCE) return offset > 0 ? 1 : -1
  return null
}

export function vibrate(duration: number): void {
  try {
    navigator.vibrate?.(duration)
  } catch {
    // Alguns navegadores ou dispositivos podem bloquear a vibração.
  }
}
