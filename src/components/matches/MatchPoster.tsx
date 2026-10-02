import { translate as t, useLocale } from '../../hooks/useLocale'
import { Film } from 'lucide-react'
import { PosterImage } from '../ui/poster-image'
import catalogue from '../../data/landingMovies.json'

type Props = { title: string; poster: string | null; priority?: boolean }

export default function MatchPoster({ title, poster, priority = false }: Props) {
  useLocale()
  const preview = catalogue.movies.find(movie => movie.poster === poster)?.preview
  return (
    <div className="matches-poster">
      {poster ? <PosterImage key={poster} src={poster} preview={preview} alt={t("Pôster de ") + title} priority={priority} lazy={!priority} />
        : <div className="matches-no-poster"><Film size={28} aria-hidden="true" /><span>{title}</span><small>{t("Sem pôster disponível")}</small></div>}
    </div>
  )
}
