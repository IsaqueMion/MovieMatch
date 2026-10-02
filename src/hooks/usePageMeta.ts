import { useEffect } from 'react'
import { useLocale } from './useLocale'

type PageMetaOptions = {
  title: string
  description: string
  robots?: string
}

function getOrCreateMeta(
  name: string,
  attribute: 'name' | 'property' = 'name',
) {
  const existing =
    document.head.querySelector<HTMLMetaElement>(
      `meta[${attribute}="${name}"]`,
    )

  if (existing) {
    return existing
  }

  const meta =
    document.createElement('meta')

  meta.setAttribute(attribute, name)
  document.head.appendChild(meta)

  return meta
}

export function usePageMeta({
  title,
  description,
  robots = 'index,follow',
}: PageMetaOptions) {
  const { t, locale } = useLocale()
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t(title)

    const descriptionMeta =
      getOrCreateMeta('description')
    const robotsMeta =
      getOrCreateMeta('robots')

    descriptionMeta.content =
      t(description)
    robotsMeta.content =
      robots
    getOrCreateMeta('og:title', 'property').content = t(title)
    getOrCreateMeta('og:description', 'property').content = t(description)
    getOrCreateMeta('og:locale', 'property').content = locale.replace('-', '_')
    getOrCreateMeta('twitter:title').content = t(title)
    getOrCreateMeta('twitter:description').content = t(description)

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (robots.includes('noindex')) {
      canonical?.remove()
      document.head.querySelector('meta[property="og:url"]')?.remove()
    } else {
      const link = canonical ?? document.createElement('link')
      link.rel = 'canonical'
      link.href = 'https://moviematch-three.vercel.app/'
      if (!canonical) document.head.appendChild(link)
      getOrCreateMeta('og:url', 'property').content = link.href
    }
  }, [
    title,
    description,
    robots,
    t,
    locale,
  ])
}
