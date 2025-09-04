export default function MovieCarousel({
  title, year, poster_url, fullHeight,
}: { title: string; year: number | null; poster_url: string; fullHeight?: boolean }) {
  return (
    <div className={`relative ${fullHeight ? 'h-full' : ''}`}>
      <div className="aspect-[3/4] w-full overflow-hidden rounded-3xl ring-1 ring-white/10 bg-neutral-900/60">
        {poster_url ? (
          <img src={poster_url} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/50">Sem imagem</div>
        )}
      </div>
    </div>
  )
}
