import type { MonetizationType } from '../../lib/functions'

export const GENRES = [
  { id: 28, name: 'Ação' },
  { id: 12, name: 'Aventura' },
  { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Família' },
  { id: 14, name: 'Fantasia' },
  { id: 36, name: 'História' },
  { id: 27, name: 'Terror' },
  { id: 10402, name: 'Música' },
  { id: 9648, name: 'Mistério' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Ficção científica' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'Guerra' },
  { id: 37, name: 'Faroeste' },
] as const

export const PROVIDERS_BR = [
  { id: 8, name: 'Netflix' },
  { id: 119, name: 'Prime Video' },
  { id: 337, name: 'Disney+' },
  { id: 384, name: 'Max' },
  { id: 307, name: 'Globoplay' },
  { id: 350, name: 'Apple TV+' },
  { id: 531, name: 'Paramount+' },
  { id: 619, name: 'Star+' },
] as const

export const LANGUAGES = [
  { value: '', label: 'Qualquer' },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Francês' },
  { value: 'de', label: 'Alemão' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: 'Japonês' },
  { value: 'ko', label: 'Coreano' },
  { value: 'zh', label: 'Chinês' },
  { value: 'ru', label: 'Russo' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Árabe' },
  { value: 'tr', label: 'Turco' },
  { value: 'nl', label: 'Holandês' },
  { value: 'sv', label: 'Sueco' },
  { value: 'no', label: 'Norueguês' },
  { value: 'fi', label: 'Finlandês' },
  { value: 'da', label: 'Dinamarquês' },
  { value: 'pl', label: 'Polonês' },
  { value: 'cs', label: 'Tcheco' },
  { value: 'uk', label: 'Ucraniano' },
  { value: 'ro', label: 'Romeno' },
  { value: 'el', label: 'Grego' },
  { value: 'he', label: 'Hebraico' },
  { value: 'th', label: 'Tailandês' },
  { value: 'id', label: 'Indonésio' },
  { value: 'vi', label: 'Vietnamita' },
  { value: 'ms', label: 'Malaio' },
  { value: 'ta', label: 'Tâmil' },
  { value: 'fa', label: 'Persa' },
] as const

export const REGIONS = [
  { value: 'BR', label: 'Brasil (BR)' },
  { value: 'US', label: 'Estados Unidos (US)' },
  { value: 'GB', label: 'Reino Unido (GB)' },
  { value: 'PT', label: 'Portugal (PT)' },
  { value: 'ES', label: 'Espanha (ES)' },
  { value: 'FR', label: 'França (FR)' },
  { value: 'DE', label: 'Alemanha (DE)' },
  { value: 'IT', label: 'Itália (IT)' },
  { value: 'JP', label: 'Japão (JP)' },
  { value: 'KR', label: 'Coreia do Sul (KR)' },
  { value: 'AR', label: 'Argentina (AR)' },
  { value: 'MX', label: 'México (MX)' },
] as const

export const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Popularidade (↓)' },
  { value: 'popularity.asc', label: 'Popularidade (↑)' },
  { value: 'vote_average.desc', label: 'Nota (↓)' },
  { value: 'vote_average.asc', label: 'Nota (↑)' },
  { value: 'vote_count.desc', label: 'Votos (↓)' },
  { value: 'vote_count.asc', label: 'Votos (↑)' },
  {
    value: 'primary_release_date.desc',
    label: 'Lançamento (recente)',
  },
  {
    value: 'primary_release_date.asc',
    label: 'Lançamento (antigo)',
  },
  { value: 'revenue.desc', label: 'Bilheteria (↓)' },
  { value: 'revenue.asc', label: 'Bilheteria (↑)' },
  { value: 'original_title.asc', label: 'Título A→Z' },
  { value: 'original_title.desc', label: 'Título Z→A' },
] as const

export const MONETIZATION_OPTIONS: ReadonlyArray<{
  k: MonetizationType
  label: string
}> = [
  { k: 'flatrate', label: 'Assinatura' },
  { k: 'free', label: 'Gratuito' },
  { k: 'ads', label: 'Com anúncios' },
  { k: 'rent', label: 'Aluguel' },
  { k: 'buy', label: 'Compra' },
]