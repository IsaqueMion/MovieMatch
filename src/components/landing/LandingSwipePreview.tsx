import { translate as t, useLocale } from '../../hooks/useLocale'
import { Check, Heart } from 'lucide-react'
import { PosterImage } from '../ui/poster-image'
import type { LandingMovie } from '../../lib/landingSelection'
import { lazy, Suspense } from 'react'

const ProfileAvatars = lazy(() => import('../account/ProfileAvatars'))

/** Fictional approvals for a real film from the qualified public catalogue. */
export default function LandingSwipePreview({ movie }: { movie: LandingMovie }) {
  useLocale()
  return (
    <figure className="cinema-match-example">
      <PosterImage key={movie.id} src={movie.poster} preview={movie.preview} alt={t("Pôster de ") + movie.title} lazy />
      <figcaption>
        <span className="cinema-eyebrow">{t("Exemplo de uma sessão")}</span>
        <Suspense fallback={<small>{t("Uma sessão ilustrativa do MovieMatch")}</small>}><ProfileAvatars /></Suspense>
        <p className="cinema-example-title"><Heart size={18} aria-hidden="true" />{t("Todo mundo disse sim.")}</p>
        <p className="cinema-example-film">{movie.title} <span>· {movie.year}</span></p>
        <span className="cinema-example-consensus"><Check size={14} aria-hidden="true" />{t("3 de 3 participantes curtiram")}</span>
      </figcaption>
    </figure>
  )
}
