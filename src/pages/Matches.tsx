import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type MovieJoin = {
  title: string | null
  year: number | null
  poster_url: string | null
}

// A linha do SELECT pode vir com movies como OBJETO ou ARRAY
type ReactionRow = {
  movie_id: number
  value: 1 | -1
  user_id: string | null
  created_at?: string | null
  movies: MovieJoin | MovieJoin[] | null
}

type MatchItem = {
  movie_id: number
  title: string
  year: number | null
  poster_url: string | null
  likes: number
}

export default function Matches() {
  const { code = '' } = useParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)

      const { data: sess } = await supabase
        .from('sessions')
        .select('id, code')
        .eq('code', code.toUpperCase())
        .maybeSingle()

      if (!sess) {
        setSessionId(null)
        setItems([])
        setLoading(false)
        return
      }

      setSessionId(sess.id)
      await loadMatches(sess.id)
      setLoading(false)
    })()
  }, [code])

  // Tempo real: qualquer mudança em reactions desta sessão => recarrega
  useEffect(() => {
    if (!sessionId) return
    const ch = supabase
      .channel(`matches-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `session_id=eq.${sessionId}` },
        () => loadMatches(sessionId)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId])

  async function loadMatches(sid: string) {
    const { data, error } = await supabase
      .from('reactions')
      .select('movie_id, value, user_id, movies:movie_id(title,year,poster_url)')
      .eq('session_id', sid)
      .eq('value', 1)

    if (error) {
      console.error(error)
      setItems([])
      return
    }

    const rows = (data ?? []) as ReactionRow[]

    // agrega por movie_id (conta usuários únicos) e extrai info do filme
    const map = new Map<number, { title: string; year: number | null; poster_url: string | null; users: Set<string> }>()

    for (const r of rows) {
      const mInfo = Array.isArray(r.movies) ? r.movies[0] : r.movies
      const current =
        map.get(r.movie_id) ??
        {
          title: mInfo?.title ?? '—',
          year: mInfo?.year ?? null,
          poster_url: mInfo?.poster_url ?? null,
          users: new Set<string>(),
        }

      if (r.user_id) current.users.add(String(r.user_id))
      map.set(r.movie_id, current)
    }

    const list: MatchItem[] = []
    for (const [movie_id, m] of map.entries()) {
      const likes = m.users.size
      if (likes >= 2) {
        list.push({
          movie_id,
          title: m.title,
          year: m.year,
          poster_url: m.poster_url,
          likes,
        })
      }
    }

    // ordena por mais likes (depois título)
    list.sort((a, b) => (b.likes - a.likes) || a.title.localeCompare(b.title))
    setItems(list)
  }

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-neutral-900 text-white">
        Carregando matches…
      </main>
    )
  }

  if (!sessionId) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-neutral-900 text-white">
        <div className="text-center space-y-2">
          <p>Sessão não encontrada.</p>
          <Link to="/" className="underline text-emerald-300">Voltar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-neutral-900 text-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Matches — {code.toUpperCase()}</h1>
          <Link to={`/s/${code}`} className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/15">
            Voltar ao swipe
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-white/80">Ainda não há filmes com 2 likes ou mais nesta sessão.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {items.map(m => (
              <li key={m.movie_id} className="rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10">
                <div className="aspect-[2/3] bg-black grid place-items-center">
                  {m.poster_url
                    ? <img src={m.poster_url} alt={m.title} className="h-full w-full object-contain" />
                    : <div className="text-white/50">Sem pôster</div>}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold leading-tight">
                    {m.title} {m.year ? <span className="text-white/60">({m.year})</span> : null}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">Likes: {m.likes}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
