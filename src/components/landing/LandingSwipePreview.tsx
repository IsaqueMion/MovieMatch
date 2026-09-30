import { Check, Heart } from 'lucide-react'

/** A local example, never a live participant count or an actual session. */
export default function LandingSwipePreview() {
  return (
    <figure className="cinema-match-example">
      <img src="/demo/interstellar.jpg" alt="Pôster de Interestelar" width={500} height={750} loading="lazy" />
      <figcaption>
        <span className="cinema-eyebrow">Exemplo de uma sessão</span>
        <div className="cinema-example-members" aria-label="Três participantes fictícios: Ana, Leo e você"><span>A</span><span>L</span><span>Você</span></div>
        <p className="cinema-example-title"><Heart size={18} aria-hidden="true" />Todo mundo disse sim.</p>
        <p>Interestelar <span>· 2014</span></p>
        <span className="cinema-example-consensus"><Check size={14} aria-hidden="true" />3 de 3 participantes curtiram</span>
      </figcaption>
    </figure>
  )
}
