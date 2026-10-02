export type Language = 'pt' | 'en' | 'es'
export const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const
export const LANGUAGE_KEY = 'mm:language:v1'

export function chooseLanguage(preferences: readonly string[], saved?: string | null): Language {
  if (saved === 'pt' || saved === 'en' || saved === 'es') return saved
  for (const preference of preferences) {
    const language = preference.toLowerCase().split('-')[0]
    if (language === 'pt' || language === 'en' || language === 'es') return language
  }
  return 'en'
}

export function browserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'pt'
  let saved: string | null = null
  try { saved = localStorage.getItem(LANGUAGE_KEY) } catch { /* Preferences still work without storage. */ }
  return chooseLanguage(navigator.languages || [navigator.language], saved)
}

export function preferredRegion(): string {
  if (typeof navigator === 'undefined') return 'BR'
  for (const preference of navigator.languages || [navigator.language]) {
    try { const region = new Intl.Locale(preference).region; if (region && /^[A-Z]{2}$/.test(region)) return region } catch { /* Ignore malformed browser preferences. */ }
  }
  return { pt: 'BR', en: 'US', es: 'ES' }[browserLanguage()]
}
