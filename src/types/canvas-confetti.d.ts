declare module 'canvas-confetti' {
  type ConfettiOptions = {
    particleCount?: number
    angle?: number
    spread?: number
    startVelocity?: number
    decay?: number
    gravity?: number
    drift?: number
    ticks?: number
    origin?: { x?: number; y?: number }
    shapes?: Array<'square' | 'circle'>
    scalar?: number
    zIndex?: number
    colors?: string[]
    disableForReducedMotion?: boolean
    [key: string]: any
  }

  interface ConfettiFn {
    (opts?: ConfettiOptions): void
    create(
      el: HTMLCanvasElement | HTMLElement,
      opts?: { resize?: boolean; useWorker?: boolean }
    ): ConfettiFn
  }

  const confetti: ConfettiFn
  export default confetti
}
