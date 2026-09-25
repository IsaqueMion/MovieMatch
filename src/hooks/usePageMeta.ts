import { useEffect } from 'react'

type PageMetaOptions = {
  title: string
  description: string
  robots?: string
}

function getOrCreateMeta(
  name: string,
) {
  const existing =
    document.head.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`,
    )

  if (existing) {
    return existing
  }

  const meta =
    document.createElement('meta')

  meta.name = name
  document.head.appendChild(meta)

  return meta
}

export function usePageMeta({
  title,
  description,
  robots = 'index,follow',
}: PageMetaOptions) {
  useEffect(() => {
    document.title = title

    const descriptionMeta =
      getOrCreateMeta('description')
    const robotsMeta =
      getOrCreateMeta('robots')

    descriptionMeta.content =
      description
    robotsMeta.content =
      robots
  }, [
    title,
    description,
    robots,
  ])
}
