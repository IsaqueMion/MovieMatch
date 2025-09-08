// src/lib/images.ts
export function tmdbPosterSrcs(posterUrl?: string) {
  if (!posterUrl) return { src: '', srcSet: '', sizes: '' }

  // tenta reaproveitar o path do TMDB (depois do /wNNN/)
  const m = posterUrl.match(/\/t\/p\/w\d+\/(.+)$/)
  const rel = m?.[1] || posterUrl.split('/').pop() || ''
  const base = 'https://image.tmdb.org/t/p'

  const src = `${base}/w500/${rel}`
  const srcSet = [
    `${base}/w185/${rel} 185w`,
    `${base}/w342/${rel} 342w`,
    `${base}/w500/${rel} 500w`,
    `${base}/w780/${rel} 780w`,
  ].join(', ')

  // largura típica do card ~ até 448px
  const sizes = '(max-width: 480px) 88vw, (max-width: 768px) 60vw, 448px'

  return { src, srcSet, sizes }
}
