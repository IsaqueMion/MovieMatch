export const DRAG_LIMIT = 160
export const SWIPE_DISTANCE = 120
export const SWIPE_VELOCITY = 800

export const TWEEN_SWIPE = {
  type: 'tween' as const,
  duration: 0.45,
  ease: 'easeOut' as const,
}

export const TWEEN_SNAP = {
  type: 'tween' as const,
  duration: 0.38,
  ease: 'easeOut' as const,
}

export function vibrate(duration: number): void {
  try {
    navigator.vibrate?.(duration)
  } catch {
    // Alguns navegadores ou dispositivos podem bloquear a vibração.
  }
}
