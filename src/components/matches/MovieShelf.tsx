import { useCallback, useEffect, useRef } from 'react'
import { LandingPageFrame } from '../../shaders/landing-pages/LandingPageFrame'
import { usePageTypography } from '../../shaders/landing-pages/pageTypography'
import { COMPLETE_SHELF_TYPOGRAPHY } from '../../shaders/landing-pages/pageRecipes'
import { useLocale } from '../../hooks/useLocale'
import '../../shaders/threeui.css'

type Movie = { movie_id: number; title: string; year: number | null; poster_url: string | null; likes: number; member_count: number }

export default function MovieShelf({ movies, onExplore }: { movies: Movie[]; onExplore: (movieId: number) => void }) {
  const { language, t } = useLocale()
  const frame = useRef<HTMLIFrameElement | null>(null)
  const customization = usePageTypography(COMPLETE_SHELF_TYPOGRAPHY, { headingFont: 'iowan-old-style', bodyFont: 'inter', headingWeight: '400', bodyWeight: '400', primaryColor: '#c87046', headingSize: 60, bodySize: 12, headingLetterSpacing: -.055 })
  const labels = { heading: t('Os filmes que uniram o grupo.'), explore: t('Explorar o filme'), select: t('Selecionar filme'), previous: t('Filme anterior'), next: t('Próximo filme'), count: t('{0} filmes', ['{0}']), consensus: t('{0} de {1} participantes curtiram', ['{0}', '{1}']), navigation: t('Role, use as setas ou selecione um filme'), loading: t('Preparando seus matches…') }
  // Remount on filtering, sorting or language changes; the authored engine initializes once.
  const payload = JSON.stringify({ type: 'moviematch:shelf:data', movies, labels, language })
  const applyScene = useCallback((element: HTMLIFrameElement) => { frame.current = element; element.contentWindow?.postMessage(JSON.parse(payload), window.location.origin) }, [payload])
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'moviematch:shelf:open') return
      if (Number.isSafeInteger(event.data.movieId) && movies.some(movie => movie.movie_id === event.data.movieId)) onExplore(event.data.movieId)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [movies, onExplore])
  return <LandingPageFrame key={payload} sourceUrl="/landing-pages/movie-shelf.html" title={t('Estante dos matches')} applyScene={applyScene} customization={customization} />
}
