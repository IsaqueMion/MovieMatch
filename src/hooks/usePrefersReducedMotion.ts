import { useSyncExternalStore } from 'react'
import { listenToMediaQuery } from '../lib/browserEvents'

let media: MediaQueryList | undefined
const getMedia = () => media ??= window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribe = (listener: () => void) => {
  const query = getMedia()
  return listenToMediaQuery(query, listener)
}

/** Reacts immediately when the operating-system preference changes mid-session. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, () => getMedia().matches, () => false)
}
