import type { DiscoverFilters } from './functions'

function normalizeNumbers(values: number[] | undefined): string {
  return [...(values ?? [])]
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .join(',')
}

function normalizeStrings(values: string[] | undefined): string {
  return [...(values ?? [])]
    .map(String)
    .sort()
    .join(',')
}

export function filtersSig(filters: DiscoverFilters): string {
  return [
    `genres=${normalizeNumbers(filters.genres)}`,
    `exclude=${normalizeNumbers(filters.excludeGenres)}`,
    `year=${filters.yearMin ?? ''}-${filters.yearMax ?? ''}`,
    `rating=${filters.ratingMin ?? ''}`,
    `votes=${filters.voteCountMin ?? ''}`,
    `runtime=${filters.runtimeMin ?? ''}-${filters.runtimeMax ?? ''}`,
    `language=${filters.language ?? ''}`,
    `sort=${filters.sortBy ?? ''}`,
    `adult=${filters.includeAdult ? '1' : '0'}`,
    `providers=${normalizeNumbers(filters.providers)}`,
    `region=${filters.watchRegion ?? ''}`,
    `monetization=${normalizeStrings(filters.monetization)}`,
  ].join('|')
}

function progressKey(
  sessionId: string | null,
  userId: string | null,
  filters: DiscoverFilters,
): string {
  if (!sessionId || !userId) return ''

  return `mm_prog:v3:${sessionId}:${userId}:${filtersSig(filters)}`
}

export function saveProgress(
  sessionId: string | null,
  userId: string | null,
  filters: DiscoverFilters,
  index: number,
): void {
  try {
    const key = progressKey(sessionId, userId, filters)
    if (!key) return

    localStorage.setItem(
      key,
      JSON.stringify({
        i: Math.max(0, Math.floor(index)),
      }),
    )
  } catch (error) {
    console.error('failed to save swipe progress:', error)
  }
}

export function loadProgress(
  sessionId: string | null,
  userId: string | null,
  filters: DiscoverFilters,
): number {
  try {
    const key = progressKey(sessionId, userId, filters)
    if (!key) return 0

    const raw = localStorage.getItem(key)
    if (!raw) return 0

    const parsed: unknown = JSON.parse(raw)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('i' in parsed)
    ) {
      return 0
    }

    const index = Number(
      (parsed as Record<string, unknown>).i,
    )

    return Number.isFinite(index)
      ? Math.max(0, Math.floor(index))
      : 0
  } catch (error) {
    console.error('failed to load swipe progress:', error)
    return 0
  }
}

export function clearProgress(
  sessionId: string | null,
  userId: string | null,
  filters: DiscoverFilters,
): void {
  try {
    const key = progressKey(sessionId, userId, filters)
    if (!key) return

    localStorage.removeItem(key)
  } catch (error) {
    console.error('failed to clear swipe progress:', error)
  }
}