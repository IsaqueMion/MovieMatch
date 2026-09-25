import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clapperboard,
  Heart,
  Play,
  Sparkles,
  Users,
} from 'lucide-react'

const LandingCarousel = lazy(
  () => import('../components/landing/LandingCarousel'),
)

async function getAuthenticatedClient() {
  const [
    { ensureAnonymousUser },
    { supabase },
  ] = await Promise.all([
    import('../lib/auth'),
    import('../lib/supabase'),
  ])

  await ensureAnonymousUser()

  return supabase
}

export default function Landing() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [busyAction, setBusyAction] = useState<
    'create' | 'join' | null
  >(null)
  const [showCarousel, setShowCarousel] =
    useState(false)

  const inputRef =
    useRef<HTMLInputElement | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    // Dá prioridade ao primeiro paint da Landing.
    // O carrossel, Framer Motion e o runtime do
    // Supabase são carregados logo depois.
    const timer = window.setTimeout(
      () => setShowCarousel(true),
      350,
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  async function handleJoin() {
    if (busyAction) return

    const normalizedCode = code
      .trim()
      .toUpperCase()

    if (!normalizedCode) {
      inputRef.current?.focus()
      return
    }

    setBusyAction('join')
    setStatus('Conectando…')

    try {
      const supabase =
        await getAuthenticatedClient()

      setStatus('Procurando sessão…')

      const { data, error } =
        await supabase.rpc(
          'join_session',
          {
            p_code: normalizedCode,
          },
        )

      const session =
        Array.isArray(data)
          ? data[0]
          : null

      if (error || !session?.code) {
        console.error(
          'join_session failed:',
          error,
        )
        setStatus(
          'Sessão não encontrada ou expirada.',
        )
        return
      }

      navigate(
        `/s/${String(session.code)}`,
      )
    } catch (error) {
      console.error(
        'failed to join session:',
        error,
      )

      setStatus(
        'Não foi possível entrar agora. Tente novamente.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCreate() {
    if (busyAction) return

    setBusyAction('create')
    setStatus('Criando sessão…')

    try {
      const supabase =
        await getAuthenticatedClient()

      const { data, error } =
        await supabase.rpc(
          'create_session',
        )

      const session =
        Array.isArray(data)
          ? data[0]
          : null

      if (error || !session?.code) {
        console.error(
          'create_session failed:',
          error,
        )
        setStatus(
          'Não foi possível criar a sessão.',
        )
        return
      }

      navigate(
        `/s/${String(session.code)}`,
      )
    } catch (error) {
      console.error(
        'failed to create session:',
        error,
      )

      setStatus(
        'Não foi possível criar a sessão agora. Tente novamente.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-neutral-950 text-white">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-850" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-[90px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-pink-500/15 blur-[110px]"
        />

        <svg
          aria-hidden
          className="absolute inset-0 opacity-[0.05]"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#grid)"
          />
        </svg>
      </div>

      <header className="px-4 pt-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
          <a
            href="/"
            className="flex items-center gap-2"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
              <Clapperboard className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              MovieMatch
            </span>
          </a>

          <nav className="hidden gap-2 sm:flex">
            <a
              href="#como-funciona"
              className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Como funciona
            </a>
            <a
              href="#recursos"
              className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Recursos
            </a>
          </nav>

          <button
            type="button"
            onClick={() => {
              void handleCreate()
            }}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {busyAction === 'create'
              ? 'Criando…'
              : 'Criar sessão'}
          </button>
        </div>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-2 md:gap-12 md:pt-14">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Dê{' '}
            <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              match
            </span>{' '}
            no filme perfeito
          </h1>

          <p className="max-w-prose text-lg text-white/80">
            Convide amigos, deslize para o lado
            e encontre o filme em que todos dão{' '}
            <span className="text-emerald-300">
              like
            </span>
            . Simples, fácil e sem briga.
          </p>

          <div className="mt-6 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleCreate()
                }}
                disabled={busyAction !== null}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-base font-semibold text-white hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60"
              >
                <Sparkles className="h-5 w-5" />
                {busyAction === 'create'
                  ? 'Criando sessão…'
                  : 'Criar nova sessão'}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/60">
                  ou
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={inputRef}
                  value={code}
                  onChange={(event) => {
                    const next =
                      event.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          '',
                        )
                        .slice(0, 6)

                    setCode(next)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleJoin()
                    }
                  }}
                  placeholder="Código da sessão"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Código da sessão"
                  className="h-11 w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 font-mono uppercase tracking-[0.18em] text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-white/40 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
                />

                <button
                  type="button"
                  onClick={() => {
                    void handleJoin()
                  }}
                  disabled={
                    busyAction !== null ||
                    code.length === 0
                  }
                  className="h-11 shrink-0 rounded-lg bg-white/10 px-4 font-medium text-white ring-1 ring-white/10 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === 'join'
                    ? 'Entrando…'
                    : 'Entrar'}
                </button>
              </div>

              {status ? (
                <p
                  className="text-sm text-white/70"
                  role="status"
                  aria-live="polite"
                >
                  {status}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1 text-sm text-white/70">
                <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
                  Sem cadastro
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
                  Tempo real
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
                  Funciona no navegador
                </span>
              </div>
            </div>
          </div>
        </div>

        <Suspense
          fallback={
            <LandingCarouselSkeleton />
          }
        >
          {showCarousel ? (
            <LandingCarousel />
          ) : (
            <LandingCarouselSkeleton />
          )}
        </Suspense>
      </main>

      <section
        id="como-funciona"
        className="mx-auto w-full max-w-6xl px-4 pb-12"
      >
        <h2 className="mb-6 text-center text-xl font-semibold text-white/90 md:text-2xl">
          Como funciona
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={
              <Users className="h-5 w-5 text-emerald-300" />
            }
            title="Crie e convide"
            desc="Gere um código de sessão e compartilhe com quem vai assistir com você."
          />
          <Card
            icon={
              <Heart className="h-5 w-5 text-emerald-300" />
            }
            title="Dê like ou dislike"
            desc="Deslize pelo catálogo; quando todos os participantes curtirem o mesmo filme, é match."
          />
          <Card
            icon={
              <Play className="h-5 w-5 text-emerald-300" />
            }
            title="É hora do play"
            desc="Veja a lista de matches e escolha o que todo mundo topa assistir."
          />
        </div>
      </section>

      <section
        id="recursos"
        className="mx-auto w-full max-w-6xl px-4 pb-16"
      >
        <h2 className="mb-6 text-center text-xl font-semibold text-white/90 md:text-2xl">
          Recursos
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={
              <Users className="h-5 w-5 text-emerald-300" />
            }
            title="Sessão compartilhada"
            desc="Entre pelo código e acompanhe participantes, filtros e matches na mesma sessão."
          />
          <Card
            icon={
              <Sparkles className="h-5 w-5 text-emerald-300" />
            }
            title="Filtros avançados"
            desc="Refine por gênero, ano, avaliação, idioma, duração e serviços de streaming."
          />
          <Card
            icon={
              <Heart className="h-5 w-5 text-emerald-300" />
            }
            title="Match do grupo"
            desc="O filme entra na lista quando todos os participantes atuais aprovarem."
          />
        </div>
      </section>

      <footer className="px-4 pb-8">
        <div className="mx-auto w-full max-w-6xl rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10 backdrop-blur">
          <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
            <div className="flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-white/80" />
              <span>
                MovieMatch • encontre o filme
                em comum
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-end">
              <a
                href="#recursos"
                className="hover:text-white"
              >
                Recursos
              </a>
              <span className="text-white/40">
                •
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleCreate()
                }}
                className="underline underline-offset-4 hover:text-white"
              >
                Criar sessão
              </button>
              <span className="text-white/40">
                •
              </span>
              <button
                type="button"
                onClick={() => {
                  inputRef.current?.focus()
                }}
                className="underline underline-offset-4 hover:text-white"
              >
                Entrar
              </button>
              <span className="text-white/40">
                •
              </span>
              <a
                href="/privacy.html"
                className="hover:text-white"
              >
                Privacidade
              </a>
              <span className="text-white/40">
                •
              </span>
              <a
                href="/terms.html"
                className="hover:text-white"
              >
                Termos
              </a>
              <span className="text-white/40">
                •
              </span>
              <a
                href="/ads.html"
                className="hover:text-white"
              >
                Publicidade
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Card({
  icon,
  title,
  desc,
}: {
  icon: ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/10">
        {icon}
        <span className="text-sm font-medium text-white/90">
          {title}
        </span>
      </div>

      <p className="text-sm text-white/70">
        {desc}
      </p>
    </div>
  )
}

function LandingCarouselSkeleton() {
  return (
    <div
      className="relative"
      aria-hidden
    >
      <div className="relative mx-auto w-[min(28rem,92vw)] overflow-hidden rounded-3xl bg-neutral-900/60 ring-1 ring-white/10 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-6 w-28 animate-pulse rounded bg-white/10" />
        </div>

        <div className="px-4 pb-4">
          <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-neutral-800 ring-1 ring-white/10" />

          <div className="mt-3 h-5 w-2/3 animate-pulse rounded bg-white/10" />

          <div className="mt-5 flex items-center justify-center gap-5 pb-2">
            <div className="h-16 w-16 rounded-full bg-red-500/30" />
            <div className="h-12 w-12 rounded-full bg-white/10" />
            <div className="h-16 w-16 rounded-full bg-emerald-500/30" />
          </div>
        </div>
      </div>
    </div>
  )
}
