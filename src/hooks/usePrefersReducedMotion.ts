import { useSyncExternalStore } from 'react'

let media: MediaQueryList | undefined
const getMedia = () => media ??= window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribe = (listener: () => void) => {
  const query = getMedia()
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** Reacts immediately when the operating-system preference changes mid-session. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, () => getMedia().matches, () => false)
}
