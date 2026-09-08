const SHUFFLE_WINDOW = 10
const SHUFFLE_WEIGHT = 0.85

export function hash32(value: string): number {
  let hash = 2166136261 >>> 0

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function shuffleWithinWindows<
  T extends { tmdb_id: number },
>(
  items: T[],
  baseSeed: string,
  windowSize = SHUFFLE_WINDOW,
): T[] {
  const output: T[] = []

  for (
    let i = 0;
    i < items.length;
    i += windowSize
  ) {
    const start = i

    const slice = items
      .slice(i, i + windowSize)
      .map((movie, index) => {
        const noise =
          (hash32(
            `${baseSeed}:${movie.tmdb_id}`,
          ) >>>
            0) /
          0xffffffff

        const score =
          start +
          index +
          (noise - 0.5) *
            (windowSize - 1) *
            SHUFFLE_WEIGHT

        return {
          movie,
          score,
        }
      })
      .sort((a, b) => a.score - b.score)
      .map(({ movie }) => movie)

    output.push(...slice)
  }

  return output
}