import { useMemo, useSyncExternalStore } from 'react'
import { browserLanguage, LANGUAGE_KEY, LOCALES, type Language } from '../lib/locale'
import messages from '../data/translations.json'

const translations: Record<string, string[]> = messages
let language = browserLanguage()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function setLanguage(next: Language) {
  language = next
  try { localStorage.setItem(LANGUAGE_KEY, next) } catch { /* Keep the choice for this visit. */ }
  listeners.forEach(listener => listener())
}
export const currentLocale = () => LOCALES[language]
export function translate(text: string, values: readonly unknown[] = [], selected: Language = language): string {
  const translated = selected === 'pt' ? text : translations[text]?.[selected === 'en' ? 0 : 1] ?? text
  return translated.replace(/\{(\d+)\}/g, (placeholder, index: string) => index in values ? String(values[Number(index)]) : placeholder)
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => { if (event.key === LANGUAGE_KEY) { language = browserLanguage(); listeners.forEach(listener => listener()) } })
}
export function useLocale() {
  const selected = useSyncExternalStore(subscribe, () => language, () => 'pt' as Language)
  return useMemo(() => ({ language: selected, locale: LOCALES[selected], t: (text: string, values: readonly unknown[] = []) => translate(text, values, selected), setLanguage }), [selected])
}
