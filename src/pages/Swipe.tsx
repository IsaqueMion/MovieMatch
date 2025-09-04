// src/pages/Swipe.tsx
import { useMemo, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

type Item = { id: string; title: string; year: number | null; poster_url: string }

// Pequena lista local só pra testar (sem API ainda)
const demo: Item[] = [
  { id: '1', title: 'Duna: Parte Dois', year: 2024, poster_url: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg' },
  { id: '2', title: 'Oppenheimer', year: 2023, poster_url: 'https://image.tmdb.org/t/p/w500/bAFmcr5wYY3L8Vhx7zQmKe1oQl.jpg' },
  { id: '3', title: 'Homem-Aranha: Sem Volta Para Casa', year: 2021, poster_url: 'https://image.tmdb.org/t/p/w500/fVzXp3NwovUlLe7fvoRynCmBPNc.jpg' },
  { id: '4', title: 'Mad Max: Estrada da Fúria', year: 2015, poster_url: 'https://image.tmdb.org/t/p/w500/1z7rGqZzFFBxYwU2LSrG3xEXL2L.jpg' },
  { id: '5', title: 'Interstellar', year: 2014, poster_url: 'https://image.tmdb.org/t/p/w500/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg' },
]

export default function Swipe() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const [swiping, setSwiping] = useState<'left' | 'right' | null>(null)
  const pausedRef = useRef(false)

  const items = useMemo(() => demo, [])
  const item = items[idx]
  const finished = idx >= items.length

  function goNext(dir: 'left' | 'right') {
    if (finished || swiping) return
    setSwiping(dir)
    setTimeout(() => {
      setSwiping(null)
      setIdx((i) => i + 1)
    }, 260) // animação curtinha
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      {/* topo */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="text-sm text-white/70">
          Sessão <span className="font-semibold">{String(code).toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/s/${code}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10">
            Ver membros
          </Link>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
          >
            Sair
          </button>
        </div>
      </div>

      {/* área do card */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 pb-10 pt-4 md:grid-cols-[1fr_360px]">
        {/* card grande */}
        <div className="grid place-items-center">
          <div className="relative w-[min(28rem,92vw)]">
            <div className="aspect-[3/4] w-full overflow-hidden rounded-3xl ring-1 ring-white/10 bg-neutral-900/60">
              <AnimatePresence mode="wait" initial={false}>
                {!finished ? (
                  <motion.img
                    key={item.id}
                    src={item.poster_url}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    initial={{ opacity: 0, scale: 1.02, x: 0 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, x: swiping === 'left' ? -60 : 60, scale: 1.02 }}
                    transition={{ duration: 0.25 }}
                    onMouseEnter={() => (pausedRef.current = true)}
                    onMouseLeave={() => (pausedRef.current = false)}
                  />
                ) : (
                  <motion.div
                    key="end"
                    className="grid h-full w-full place-items-center text-white/60"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  >
                    <p>Acabou! 🎬</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* título */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">
                  {!finished ? (
                    <>
                      {item.title} {item.year ? <span className="text-white/60">({item.year})</span> : null}
                    </>
                  ) : 'Sem mais itens'}
                </h3>
              </div>
            </div>

            {/* ações */}
            <div className="mt-4 flex items-center justify-center gap-4 pb-2">
              <button
                onClick={() => goNext('left')}
                disabled={finished}
                className="grid h-12 w-12 place-items-center rounded-full bg-red-500 text-white shadow-lg disabled:opacity-50"
                aria-label="Não curti"
              >
                ✕
              </button>
              <button
                onClick={() => goNext('right')}
                disabled={finished}
                className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-lg disabled:opacity-50"
                aria-label="Curti"
              >
                ❤
              </button>
            </div>
          </div>
        </div>

        {/* lateral com ajuda */}
        <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold">Como funciona</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-white/80">
            <li>Clique ❤ para like e ✕ para dislike.</li>
            <li>Vamos salvar no banco no próximo passo.</li>
            <li>Convide os amigos para usarem o mesmo código.</li>
          </ol>
        </aside>
      </div>
    </div>
  )
}
