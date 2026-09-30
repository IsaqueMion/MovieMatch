import { Check, Heart } from 'lucide-react'
import { useState } from 'react'
import type { LandingMovie } from '../../lib/landingSelection'

/** Fictional approvals for a real film from the qualified public catalogue. */
export default function LandingSwipePreview({ movie }: { movie: LandingMovie }) {
  const [posterFailed, setPosterFailed] = useState(false)
  return (
    <figure className="cinema-match-example">
      {posterFailed
        ? <div className="cinema-poster-unavailable" role="img" aria-label={'Pôster indisponível de ' + movie.title}><span>{movie.title}</span><small>Pôster indisponível</small></div>
        : <img src={movie.poster} alt={'Pôster de ' + movie.title} width={500} height={750} loading="lazy" onError={() => setPosterFailed(true)} />}
      <figcaption>
        <span className="cinema-eyebrow">Exemplo de uma sessão</span>
        <div className="cinema-example-members" aria-label="Três participantes fictícios: Ana, Leo e você"><span>A</span><span>L</span><span>Você</span></div>
        <p className="cinema-example-title"><Heart size={18} aria-hidden="true" />Todo mundo disse sim.</p>
        <p className="cinema-example-film">{movie.title} <span>· {movie.year}</span></p>
        <span className="cinema-example-consensus"><Check size={14} aria-hidden="true" />3 de 3 participantes curtiram</span>
      </figcaption>
    </figure>
  )
}
