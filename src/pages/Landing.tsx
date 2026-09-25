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
  Link2,
  LogIn,
  Play,
  Plus,
  SlidersHorizontal,
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
    const timer = window.setTimeout(
      () => setShowCarousel(true),
      250,
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
    <div className="min-h-dvh bg-neutral-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <a
            href="/"
            className="flex items-center gap-2.5"
          >
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500">
              <Clapperboard className="h-4.5 w-4.5 text-neutral-950" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              MovieMatch
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">
            <a
              href="#como-funciona"
              className="transition hover:text-white"
            >
              Como funciona
            </a>
            <a
              href="#recursos"
              className="transition hover:text-white"
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
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-neutral-950 transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              Nova sessão
            </span>
            <span className="sm:hidden">
              Criar
            </span>
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 lg:py-16">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium text-emerald-400">
              Escolha em grupo, sem enrolação.
            </p>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Todo mundo escolhe.
              <span className="block text-white/55">
                O filme certo aparece.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
              Crie uma sessão, convide quem vai
              assistir com você e vote nos filmes.
              Quando todo mundo curtir o mesmo
              título, ele entra nos matches.
            </p>

            <div className="mt-8 max-w-xl rounded-2xl border border-white/10 bg-neutral-900 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    Comece agora
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    Sem cadastro e direto no navegador.
                  </p>
                </div>

                <div className="hidden items-center gap-2 text-xs text-white/40 sm:flex">
                  <Users className="h-4 w-4" />
                  Sessões privadas por código
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <button
                  type="button"
                  onClick={() => {
                    void handleCreate()
                  }}
                  disabled={busyAction !== null}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {busyAction === 'create'
                    ? 'Criando sessão…'
                    : 'Criar nova sessão'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    inputRef.current?.focus()
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                >
                  <LogIn className="h-4 w-4" />
                  Já tenho um código
                </button>
              </div>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  entrar em uma sessão
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
                    if (status) {
                      setStatus('')
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleJoin()
                    }
                  }}
                  placeholder="EX.: 7F9XQ2"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Código da sessão"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950 px-3.5 font-mono text-sm uppercase tracking-[0.18em] text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-white/30 focus:border-emerald-400/60"
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
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LogIn className="h-4 w-4" />
                  {busyAction === 'join'
                    ? 'Entrando…'
                    : 'Entrar'}
                </button>
              </div>

              {status ? (
                <p
                  className="mt-3 text-sm text-white/60"
                  role="status"
                  aria-live="polite"
                >
                  {status}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/40">
              <span>Sem cadastro</span>
              <span>Sincronização entre participantes</span>
              <span>Funciona no celular e no PC</span>
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
        </section>

        <section
          id="como-funciona"
          className="border-y border-white/10 bg-neutral-900/35"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-12">
            <div className="mb-8 max-w-lg">
              <p className="text-sm font-medium text-emerald-400">
                Como funciona
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Três passos e acabou a discussão.
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-3 md:gap-10">
              <Step
                number="01"
                icon={
                  <Link2 className="h-5 w-5" />
                }
                title="Crie e compartilhe"
                description="Abra uma sessão e envie o código para quem vai assistir com você."
              />
              <Step
                number="02"
                icon={
                  <Heart className="h-5 w-5" />
                }
                title="Vote nos filmes"
                description="Cada pessoa dá like ou passa. Os filtros da sessão valem para todo mundo."
              />
              <Step
                number="03"
                icon={
                  <Play className="h-5 w-5" />
                }
                title="Veja os matches"
                description="Quando todos aprovarem o mesmo filme, ele aparece na lista do grupo."
              />
            </div>
          </div>
        </section>

        <section
          id="recursos"
          className="mx-auto w-full max-w-6xl px-5 py-12"
        >
          <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
            <div>
              <p className="text-sm font-medium text-emerald-400">
                Recursos
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Só o que ajuda a decidir.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/50">
                Sem feed infinito, cadastro obrigatório
                ou configuração complicada.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Feature
                icon={
                  <Users className="h-5 w-5" />
                }
                title="Sessão compartilhada"
                description="Participantes, filtros e matches ficam sincronizados na mesma sessão."
              />
              <Feature
                icon={
                  <SlidersHorizontal className="h-5 w-5" />
                }
                title="Filtros úteis"
                description="Refine por gênero, ano, nota, duração, idioma e serviços de streaming."
              />
              <Feature
                icon={
                  <Heart className="h-5 w-5" />
                }
                title="Match do grupo"
                description="O filme entra na lista quando todos os participantes atuais aprovarem."
              />
              <Feature
                icon={
                  <Play className="h-5 w-5" />
                }
                title="Detalhes sem sair da sessão"
                description="Veja sinopse, trailer, avaliação e disponibilidade antes de decidir."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4" />
            <span>
              MovieMatch
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href="#como-funciona"
              className="transition hover:text-white"
            >
              Como funciona
            </a>
            <a
              href="#recursos"
              className="transition hover:text-white"
            >
              Recursos
            </a>
            <a
              href="/privacy.html"
              className="transition hover:text-white"
            >
              Privacidade
            </a>
            <a
              href="/terms.html"
              className="transition hover:text-white"
            >
              Termos
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <article className="border-t border-white/10 pt-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/30">
          {number}
        </span>
        <span className="text-emerald-400">
          {icon}
        </span>
      </div>

      <h3 className="mt-5 text-base font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-white/50">
        {description}
      </p>
    </article>
  )
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <article className="flex gap-3">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-emerald-400">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-semibold">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-white/50">
          {description}
        </p>
      </div>
    </article>
  )
}

function LandingCarouselSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[360px]"
      aria-hidden
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
          <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
        </div>

        <div className="p-3">
          <div className="aspect-[4/5] animate-pulse rounded-xl bg-neutral-800" />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-2.5 w-12 animate-pulse rounded bg-white/10" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-10 rounded-lg bg-white/5" />
            <div className="h-10 rounded-lg bg-white/5" />
            <div className="h-10 rounded-lg bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  )
}
