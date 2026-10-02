import { translate as t, useLocale } from '../../hooks/useLocale'
import { useState, type CSSProperties } from 'react'

type PosterImageProps = {
  src: string
  preview?: string
  alt: string
  corridor?: boolean
  priority?: boolean
  lazy?: boolean
}

/** The embedded thumbnail paints immediately; the decoded full image fades over it. */
export function PosterImage({ src, preview, alt, corridor = false, priority = false, lazy = false }: PosterImageProps) {
  useLocale()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const tmdb = src.startsWith('https://image.tmdb.org/t/p/w500/')
  const style: CSSProperties = preview ? { backgroundImage: `url("${preview}")` } : {}

  return (
    <div className={`cinema-poster ${ready ? 'is-ready' : ''}`} style={style} role={import.meta.env.SSR && alt ? 'img' : undefined} aria-label={import.meta.env.SSR && alt ? alt : undefined}>
      {/* The static home paints embedded previews; only the visitor's chosen set downloads full posters. */}
      {!import.meta.env.SSR ? <picture>
        {corridor && tmdb ? <>
          <source media="(min-width: 1024px) and (min-resolution: 1.5dppx)" srcSet={src.replace('/w500/', '/original/')} />
          <source media="(max-width: 639px) and (max-resolution: 2dppx)" srcSet={src} />
        </> : null}
        <img src={corridor && tmdb ? src.replace('/w500/', '/w780/') : src} alt={alt} width={500} height={750}
          loading={lazy ? 'lazy' : 'eager'} fetchPriority={priority ? 'high' : corridor ? 'low' : 'auto'} decoding="async" draggable={false}
          onLoad={async event => {
            const image = event.currentTarget
            const source = image.currentSrc
            try { await image.decode() } catch { return }
            if (image.isConnected && image.currentSrc === source) setReady(true)
          }}
          onError={() => { setFailed(true); setReady(false) }} />
      </picture> : null}
      {failed && alt ? <div className="cinema-poster-unavailable" role="img" aria-label={alt.replace(t("Pôster de "), t("Pôster indisponível de "))}><span>{alt.replace(t("Pôster de "), '')}</span><small>{t("Pôster indisponível")}</small></div> : null}
    </div>
  )
}
