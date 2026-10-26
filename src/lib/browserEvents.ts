export function installMediaQueryEventsFallback() {
  const query = window.matchMedia('all')
  if (typeof query.addEventListener === 'function') return
  const prototype = Object.getPrototypeOf(query)
  // shortcut: legacy consumers use change callbacks without listener options; extend before adding options.
  for (const [method, legacy] of [['addEventListener', 'addListener'], ['removeEventListener', 'removeListener']] as const) {
    Object.defineProperty(prototype, method, {
      configurable: true,
      writable: true,
      value(this: MediaQueryList, type: string, listener: Parameters<MediaQueryList['addListener']>[0]) {
        if (type === 'change') this[legacy](listener)
      },
    })
  }
}

export function listenToMediaQuery(query: MediaQueryList, listener: () => void) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }
  query.addListener(listener)
  return () => query.removeListener(listener)
}

export function observeElementResize(element: Element, listener: () => void) {
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(listener)
    observer.observe(element)
    return () => observer.disconnect()
  }
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}
