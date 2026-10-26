export function todayISO(now = new Date()): string { return now.toISOString().slice(0, 10) }

export function ageFromBirthdate(value: string, today = todayISO()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > today) return null
  const date = new Date(value + 'T00:00:00Z')
  if (!Number.isFinite(date.getTime()) || todayISO(date) !== value) return null
  return Number(today.slice(0, 4)) - Number(value.slice(0, 4)) - (today.slice(5) < value.slice(5) ? 1 : 0)
}
