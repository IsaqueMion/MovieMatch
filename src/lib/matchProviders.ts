type ProviderCard = {
  id: number
  name: string
  logoUrl: string | null
  url: string | null
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractProviders(
  details: unknown,
  region: string,
): {
  providers: ProviderCard[]
  hasRegion: boolean
  regionLink: string | null
} {
  const out: {
    providers: ProviderCard[]
    hasRegion: boolean
    regionLink: string | null
  } = {
    providers: [],
    hasRegion: false,
    regionLink: null,
  }

  if (!isRecord(details)) return out

  const baseImg = 'https://image.tmdb.org/t/p/w45'
  const R = String(region || 'BR').toUpperCase()

  // Preferências por domínio (IDs TMDB)
  const PROVIDER_HOSTS: Record<number, string[]> = {
    2: ['tv.apple.com', 'apple.com'],
    3: ['play.google.com'],
    8: ['netflix.com'],
    10: ['primevideo.com', 'amazon.com', 'amazon.com.br'],
    119: ['primevideo.com', 'amazon.com', 'amazon.com.br'],
    337: ['disneyplus.com'],
    384: ['max.com', 'hbomax.com'],
    307: ['globoplay.com', 'globoplay.globo.com'],
    350: ['tv.apple.com', 'apple.com'],
    531: ['paramountplus.com'],
    619: ['starplus.com'],
  }

  // Domínios que não queremos abrir como link de streaming.
  const BAD_HOSTS = [
    'imdb.com',
    'youtube.com',
    'youtu.be',
    'themoviedb.org',
  ]

  const belongsTo = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

  const safeHost = (url: string) => {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.replace(/^www\./, '')
      return /^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password && host !== 'google.com' && !BAD_HOSTS.some((bad) => belongsTo(host, bad))
    } catch {
      return false
    }
  }

  const hostMatch = (url: string, providerId: number) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      const allowedHosts = PROVIDER_HOSTS[providerId]

      if (!allowedHosts || allowedHosts.length === 0) {
        return safeHost(url)
      }

      return allowedHosts.some((domain) => belongsTo(host, domain))
    } catch {
      return false
    }
  }

  // Formatos aceitos de payload de provedores.
  const wp =
    details.watch_providers ??
    details.watchProviders ??
    details.watchProvidersV2 ??
    details.providers ??
    details.providersByRegion ??
    details.watchProvidersByRegion ??
    null

  let area: unknown = null

  if (Array.isArray(wp)) {
    area = wp
  } else if (isRecord(wp)) {
    if (isRecord(wp.results)) {
      area = wp.results[R] ?? null
    } else {
      area = wp[R] ?? null
    }
  }

  if (area) {
    out.hasRegion = true
  }

  if (
    isRecord(area) &&
    typeof area.link === 'string' &&
    isHttpUrl(area.link)
  ) {
    out.regionLink = area.link
  }

  // Reúne todas as ofertas encontradas no payload.
  let offers: unknown[] = []

  const pushAll = (value: unknown) => {
    if (Array.isArray(value)) {
      offers.push(...value)
    }
  }

  if (Array.isArray(area)) {
    offers = [...area]
  } else if (isRecord(area)) {
    pushAll(area.flatrate)
    pushAll(area.ads)
    pushAll(area.free)
    pushAll(area.rent)
    pushAll(area.buy)
    pushAll(area.offers)
    pushAll(area.streaming)
  }

  // Fallbacks para formatos legados ou enriquecidos pelo backend.
  pushAll(details.offers)
  pushAll(details.providers)
  pushAll(details.providers_list)
  pushAll(details.providers_flat)

  if (isRecord(details.justwatch)) {
    pushAll(details.justwatch.offers)
  }

  const bestUrlForProvider = (
    providerId: number,
    list: unknown[],
  ): string | null => {
    const urls: string[] = []

    for (const item of list) {
      if (!isRecord(item)) continue

      const id = Number(
        item.provider_id ??
        item.id ??
        item.providerId,
      )

      if (id !== providerId) continue

      const urlData = isRecord(item.urls) ? item.urls : null

      const candidates: unknown[] = [
        urlData?.standard_web,
        urlData?.deeplink_web,
        item.url,
        item.deep_link,
      ]

      for (const candidate of candidates) {
        if (candidate == null) continue

        const url = String(candidate)

        if (safeHost(url)) {
          urls.push(url)
        }
      }
    }

    if (urls.length === 0) return null

    const preferred = urls.find((url) =>
      hostMatch(url, providerId),
    )

    return preferred ?? null
  }

  // Deduplica por provider_id.
  const byId = new Map<number, ProviderCard>()

  for (const item of offers) {
    if (!isRecord(item)) continue

    const id = Number(
      item.provider_id ??
      item.id ??
      item.providerId,
    )

    if (!Number.isFinite(id)) continue

    const name = String(
      item.provider_name ??
      item.name ??
      'Provider',
    )

    const rawLogo =
      item.logo_url ??
      item.logo_path ??
      item.logo ??
      item.icon ??
      item.icon_path ??
      null

    const logoUrl =
      rawLogo == null
        ? null
        : String(rawLogo).startsWith('http')
          ? String(rawLogo)
          : `${baseImg}${String(rawLogo)}`

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name,
        logoUrl,
        url: null,
      })
    }
  }

  // Escolhe a melhor URL encontrada para cada serviço.
  for (const [id, entry] of byId.entries()) {
    byId.set(id, {
      ...entry,
      url: bestUrlForProvider(id, offers),
    })
  }

  out.providers = Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  return out
}

export function providerSearchUrl(providerId: number, title: string, region?: string): string | undefined {
  // Normaliza consulta
  const q = encodeURIComponent(title)
  const cc = String(region || 'BR').toLowerCase(); // país em minúsculas (ex.: 'br')

  // Mapeamento dos principais provedores (IDs do TMDB)
  switch (providerId) {
    case 8:   // Netflix
      return `https://www.netflix.com/search?q=${q}`
    case 10: // Amazon Video
    case 119: // Prime Video
      return `https://www.primevideo.com/search?phrase=${q}`
    case 337: // Disney+
      return `https://www.disneyplus.com/search/${q}`
    case 384: // Max (HBO Max)
      return `https://www.max.com/search?q=${q}`
    case 307: // Globoplay
      return `https://globoplay.globo.com/busca/?q=${q}`
    case 2:   // Apple TV Store
    case 350: // Apple TV+
      return `https://tv.apple.com/${cc}/search?term=${q}`
    case 531: // Paramount+
      return `https://www.paramountplus.com/search/?searchTerm=${q}`
    case 619: // Star+
      return `https://www.starplus.com/search/${q}`
    default:
      // Não mapeado: sem fallback para TMDB/JustWatch
      return undefined;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
  } catch { return false }
}

export function resolveProviderLink(provider: ProviderCard, title: string, region: string, regionLink: string | null, tmdbId: number | null) {
  if (provider.url) return { href: provider.url, label: 'Abrir filme' }
  const search = providerSearchUrl(provider.id, title, region)
  if (search) return { href: search, label: 'Buscar filme' }
  const watch = regionLink || (tmdbId != null ? `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=${encodeURIComponent(region)}` : null)
  if (watch) return { href: watch, label: 'Ver disponibilidade' }
  return { href: `https://www.google.com/search?q=${encodeURIComponent(`${title} ${provider.name} onde assistir`)}`, label: 'Buscar disponibilidade' }
}
