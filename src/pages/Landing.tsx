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

import { usePageMeta } from '../hooks/usePageMeta'

const LandingSwipePreview = lazy(
  () =>
    import(
      '../components/landing/LandingSwipePreview'
    ),
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
  usePageMeta({
    title:
      'MovieMatch — encontre o filme em comum',
    description:
      'Crie uma sessão, vote em filmes com seus amigos e descubra os títulos que todo mundo quer assistir.',
  })

  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [busyAction, setBusyAction] = useState<
    'create' | 'join' | null
  >(null)
  const [showPreview, setShowPreview] =
    useState(false)
  const [showMobileCta, setShowMobileCta] =
    useState(false)

  const inputRef =
    useRef<HTMLInputElement | null>(null)
  const primaryActionsRef =
    useRef<HTMLDivElement | null>(null)

  const navigate = useNavigate()

  const codeComplete =
    code.length === 6

  const codeHint =
    code.length > 0 &&
    !codeComplete
      ? `Faltam ${6 - code.length} ${6 - code.length === 1 ? 'caractere' : 'caracteres'}.`
      : ''

  useEffect(() => {
    const timer = window.setTimeout(
      () => setShowPreview(true),
      250,
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const target =
      primaryActionsRef.current

    if (
      !target ||
      typeof IntersectionObserver ===
        'undefined'
    ) {
      return
    }

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          setShowMobileCta(
            !entry.isIntersecting,
          )
        },
        {
          threshold: 0.2,
        },
      )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [])

  async function handleJoin() {
    if (busyAction) return

    const normalizedCode =
      code.trim().toUpperCase()

    if (
      normalizedCode.length !== 6
    ) {
      setStatus(
        'Digite os 6 caracteres do código da sessão.',
      )
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
            p_code:
              normalizedCode,
          },
        )

      const session =
        Array.isArray(data)
          ? data[0]
          : null

      if (
        error ||
        !session?.code
      ) {
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

      if (
        error ||
        !session?.code
      ) {
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

  function focusJoin() {
    inputRef.current?.focus()
    inputRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <div className="min-h-dvh bg-neutral-950 pb-20 text-white md:pb-0">
      <header className="border-b border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <a
            href="/"
            className="flex items-center gap-2.5"
          >
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500">
              <Clapperboard className="h-[18px] w-[18px] text-neutral-950" />
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
            disabled={
              busyAction !== null
            }
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
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-8 lg:h-[calc(100dvh-4rem)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-12 lg:py-5">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-medium text-emerald-400">
              MovieMatch
            </p>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.06] tracking-tight lg:text-[44px] xl:text-5xl">
              Escolher o filme não precisa virar discussão.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-6 text-white/60 lg:text-[17px]">
              Crie uma sessão, compartilhe o código
              e vote nos filmes. Quando todo mundo
              curtir o mesmo título, ele entra nos
              matches.
            </p>

            <div
              ref={primaryActionsRef}
              className="mt-5 max-w-xl rounded-2xl border border-white/10 bg-neutral-900 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleCreate()
                  }}
                  disabled={
                    busyAction !== null
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {busyAction ===
                  'create'
                    ? 'Criando sessão…'
                    : 'Criar nova sessão'}
                </button>

                <button
                  type="button"
                  onClick={focusJoin}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                >
                  <LogIn className="h-4 w-4" />
                  Já tenho um código
                </button>
              </div>

              <div className="my-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/30">
                  entrar em uma sessão
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
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
                      setStatus('')
                    }}
                    onKeyDown={(
                      event,
                    ) => {
                      if (
                        event.key ===
                        'Enter'
                      ) {
                        void handleJoin()
                      }
                    }}
                    placeholder="EX.: 7F9XQ2"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Código da sessão"
                    aria-invalid={
                      code.length >
                        0 &&
                      !codeComplete
                    }
                    aria-describedby="session-code-hint"
                    className="h-11 w-full rounded-lg border border-white/10 bg-neutral-950 px-3.5 font-mono text-sm uppercase tracking-[0.18em] text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-white/30 focus:border-emerald-400/60 aria-[invalid=true]:border-red-400/70"
                  />

                  <p
                    id="session-code-hint"
                    className={
                      codeHint
                        ? 'mt-1.5 min-h-4 text-xs text-red-300'
                        : 'mt-1.5 min-h-4 text-xs text-white/30'
                    }
                  >
                    {codeHint ||
                      (codeComplete
                        ? 'Código completo.'
                        : 'O código tem 6 caracteres.')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handleJoin()
                  }}
                  disabled={
                    busyAction !==
                      null ||
                    !codeComplete
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 sm:self-start"
                >
                  <LogIn className="h-4 w-4" />
                  {busyAction ===
                  'join'
                    ? 'Entrando…'
                    : 'Entrar'}
                </button>
              </div>

              {status ? (
                <p
                  className="mt-2 text-sm text-white/60"
                  role="status"
                  aria-live="polite"
                >
                  {status}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/40">
              <span>Sem cadastro</span>
              <span>Tempo real</span>
              <span>Celular e PC</span>
            </div>
          </div>

          <Suspense
            fallback={
              <LandingPreviewSkeleton />
            }
          >
            {showPreview ? (
              <LandingSwipePreview />
            ) : (
              <LandingPreviewSkeleton />
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
                Três passos para chegar no filme.
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
                description="Cada participante curte ou passa. Os filtros ficam sincronizados para o grupo."
              />
              <Step
                number="03"
                icon={
                  <Play className="h-5 w-5" />
                }
                title="Veja os matches"
                description="Quando todos aprovarem o mesmo filme, ele aparece na lista da sessão."
              />
            </div>
          </div>
        </section>

        <section
          id="recursos"
          className="mx-auto w-full max-w-6xl px-5 py-12"
        >
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
            <div>
              <p className="text-sm font-medium text-emerald-400">
                Recursos
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                O necessário para decidir em grupo.
              </h2>
            </div>

            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Feature
                icon={
                  <Users className="h-5 w-5" />
                }
                title="Sessão compartilhada"
                description="Participantes, filtros e matches ficam sincronizados."
              />
              <Feature
                icon={
                  <SlidersHorizontal className="h-5 w-5" />
                }
                title="Filtros úteis"
                description="Gênero, ano, nota, duração, idioma e serviços de streaming."
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
                title="Detalhes do filme"
                description="Sinopse, trailer, avaliação, classificação e disponibilidade."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4" />
            <span>MovieMatch</span>
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

      {showMobileCta ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-neutral-950/95 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void handleCreate()
              }}
              disabled={
                busyAction !== null
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-neutral-950 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Criar sessão
            </button>

            <button
              type="button"
              onClick={focusJoin}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </button>
          </div>
        </div>
      ) : null}
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

function LandingPreviewSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[390px]"
      aria-hidden
    >
      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3">
        <div className="mb-3 h-12 rounded-xl bg-white/5" />
        <div className="h-[clamp(360px,52dvh,430px)] animate-pulse rounded-xl bg-white/5" />
        <div className="mx-auto mt-3 flex max-w-md items-center justify-center gap-5">
          <div className="h-14 w-14 rounded-full bg-red-500/25" />
          <div className="h-11 w-11 rounded-full bg-white/10" />
          <div className="h-14 w-14 rounded-full bg-emerald-500/25" />
        </div>
      </div>
    </div>
  )
}
