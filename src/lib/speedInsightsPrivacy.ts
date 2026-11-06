export function redactSpeedInsightsUrl(url: string, origin: string): string {
  return new URL(url, origin).pathname
    .replace(/^(\/s)\/[^/]+(?=\/|$)/, '$1/[code]')
    .replace(/^(\/p)\/[^/]+(?=\/|$)/, '$1/[handle]')
}
