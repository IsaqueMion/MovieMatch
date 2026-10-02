import { translate as t, useLocale } from '../hooks/useLocale'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clapperboard, Heart, SlidersHorizontal, Users } from 'lucide-react'
import { usePageMeta } from '../hooks/usePageMeta'
import { ImageStreamHero, type StreamImage } from '../components/ui/image-stream-hero'
import LandingSwipePreview from '../components/landing/LandingSwipePreview'
import catalogue from '../data/landingMovies.json'
import { selectLandingMovies } from '../lib/landingSelection'
import CinemaButton from '../components/ui/cinema-button'
import { preferredRegion } from '../lib/locale'
const AccountMenu = lazy(() => import('../components/account/AccountMenu'))
const HomeNavigation = lazy(() => import('../components/landing/HomeNavigation'))
const HomeRooms = lazy(() => import('../components/landing/HomeRooms'))

const FEATURED_KEY = 'mm:landing-featured:v1'

function drawMovies() {
  let previous: number | undefined
  try { previous = Number(localStorage.getItem(FEATURED_KEY)) || undefined } catch { /* Storage is optional. */ }
  return selectLandingMovies(catalogue.movies, previous)
}
const STEPS = [
  { number: '01', title: 'Junte o elenco.', description: 'Crie uma sessão e compartilhe o link ou o código com quem vai assistir.' },
  { number: '02', title: 'Cada um dá seu voto.', description: 'Escolham os filtros do grupo. Depois, cada pessoa curte os filmes que quer ver.' },
  { number: '03', title: 'O sim é de todo mundo.', description: 'Com pelo menos duas pessoas, o filme vira match quando todos os participantes atuais curtirem.' },
]

async function getAuthenticatedClient() {
  const [{ ensureAnonymousUser }, { supabase }] = await Promise.all([
    import('../lib/auth'),
    import('../lib/supabase'),
  ])
  await ensureAnonymousUser()
  return supabase
}

export default function Landing() {
  useLocale()
  usePageMeta({
    title: t("MovieMatch — o próximo filme, a escolha de todos"),
    description: t("Crie uma sessão, convide seu grupo e encontre um filme que todos querem assistir. Sem cadastro, no celular ou no computador."),
  })
  const navigate = useNavigate()
  const [selection] = useState(drawMovies)
  const posterImages: StreamImage[] = useMemo(() => selection.posters.map(movie => ({ src: movie.poster, preview: movie.preview })), [selection.posters])
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const [busyAction, setBusyAction] = useState<'create' | 'join' | null>(null)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const inputRef = useRef<HTMLInputElement>(null)
  const actionPending = useRef(false)
  const complete = code.length === 6
  const hint = code.length > 0 && !complete
    ? t("Faltam ") + (6 - code.length) + (code.length === 5 ? t(" caractere.") : t(" caracteres."))
    : t("O código tem 6 letras ou números.")

  useEffect(() => {
    try { localStorage.setItem(FEATURED_KEY, String(selection.featured.id)) } catch { /* Random selection still works. */ }
  }, [selection.featured.id])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (actionPending.current) return
    const normalizedCode = code.trim().toUpperCase()
    if (normalizedCode.length !== 6) {
      setStatus(t("Digite os 6 caracteres do código da sessão."))
      setFailed(true)
      inputRef.current?.focus()
      return
    }
    actionPending.current = true
    setBusyAction('join')
    setFailed(false)
    setStatus(t("Procurando sua sessão…"))
    try {
      const client = await getAuthenticatedClient()
      const { data, error } = await client.rpc('join_session', { p_code: normalizedCode })
      const session = Array.isArray(data) ? data[0] : null
      if (error || !session?.code) {
        setFailed(true)
        setStatus(!error || error.code === 'P0002' || error.code === '22023'
          ? t("Sessão não encontrada ou expirada. Confira o código ou crie uma nova.")
          : t("Não foi possível conectar à sessão. Tente novamente."))
        return
      }
      navigate('/s/' + String(session.code))
    } catch {
      setFailed(true)
      setStatus(t("Não foi possível conectar agora. Tente novamente."))
    } finally {
      actionPending.current = false
      setBusyAction(null)
    }
  }

  async function handleCreate() {
    if (actionPending.current) return
    actionPending.current = true
    setBusyAction('create')
    setFailed(false)
    setStatus(t("Preparando sua sessão…"))
    try {
      const client = await getAuthenticatedClient()
      const { data, error } = await client.rpc('create_session')
      const session = Array.isArray(data) ? data[0] : null
      if (error || !session?.code) {
        setFailed(true)
        setStatus(t("Não foi possível criar a sessão. Tente novamente."))
        return
      }
      const region = preferredRegion()
      if (region !== 'BR') {
        const { data: { session: authSession } } = await client.auth.getSession()
        const { error: regionError } = await client.from('session_filters').upsert({ session_id: session.id, watch_region: region, updated_by: authSession?.user.id }, { onConflict: 'session_id' })
        if (regionError) console.warn('Could not initialize the catalogue region:', regionError.code)
      }
      try { sessionStorage.setItem('mm:created-session', String(session.id)) } catch { /* Tutorial remains available through Help. */ }
      navigate('/s/' + String(session.code))
    } catch {
      setFailed(true)
      setStatus(t("Não foi possível conectar agora. Tente novamente."))
    } finally {
      actionPending.current = false
      setBusyAction(null)
    }
  }

  function focusJoin() {
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' })
  }

  return (
    <div className="cinema-page">
      <a className="cinema-skip-link" href="#conteudo">{t("Pular para o conteúdo")}</a>
      <header className="cinema-header cinema-container home-header">
        <a href="/" className="cinema-brand" aria-label={t("MovieMatch, página inicial")}>
          <span className="cinema-brand-mark"><Clapperboard size={22} aria-hidden="true" /></span>
          MovieMatch<span className="cinema-brand-dot">.</span>
        </a>
        <Suspense fallback={<nav aria-label={t("Navegação principal")}>
          <a href="#como-funciona">{t("Como funciona")}</a>
          <a href="#recursos">{t("A experiência")}</a>
        </nav>}><HomeNavigation /></Suspense>
        <Suspense fallback={<a href="/conta">{t("Entrar")}</a>}><AccountMenu /></Suspense>
        <CinemaButton compact tone="secondary" onClick={() => void handleCreate()} disabled={busyAction !== null}>
          {busyAction === 'create' ? t("Criando…") : t("Criar sessão")}
        </CinemaButton>
      </header>

      <main id="conteudo">
        <ImageStreamHero images={posterImages} paused={paused || reducedMotion} className="cinema-stream">
          <div className="cinema-stream-shade" aria-hidden="true" />
          <div className="cinema-stream-content">
            <div className="cinema-hero-copy">
              <p className="cinema-eyebrow"><span className="cinema-status-dot" />{" " + t("PARA A SUA PRÓXIMA SESSÃO")}</p>
              <h1>{t("O próximo filme.")}<br /><span>{t("A escolha de todos.")}</span></h1>
              <p className="cinema-hero-description">{t("Menos tempo escolhendo.")}<br className="cinema-mobile-break" />{" " + t("Mais tempo assistindo juntos.")}</p>
            </div>
            <div className="cinema-hero-bottom">
              <p className="cinema-stream-caption">{t("Uma prévia do catálogo. A sessão de verdade começa com você.")}</p>
              <div className="cinema-hero-actions">
                <CinemaButton onClick={() => void handleCreate()} disabled={busyAction !== null}>
                  {busyAction === 'create' ? t("Criando sessão…") : t("Criar uma sessão")}
                </CinemaButton>
                <CinemaButton tone="secondary" direction="down" onClick={focusJoin} disabled={busyAction !== null}>{t("Tenho um código")}</CinemaButton>
              </div>
              <p className="cinema-hero-note">{t("Sem cadastro. Sem baixar nada. Só escolher.")}</p>
            </div>
          </div>
          <button className="cinema-motion-toggle" onClick={() => setPaused(value => !value)} disabled={reducedMotion} aria-pressed={paused || reducedMotion} aria-label={reducedMotion ? t("Animação pausada pela preferência de movimento reduzido") : paused ? t("Retomar animação dos pôsteres") : t("Pausar animação dos pôsteres")}>
            <span key={paused || reducedMotion ? 'play' : 'pause'} className="cinema-motion-icon" aria-hidden="true">
              {paused || reducedMotion ? <svg viewBox="0 0 384 512"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" /></svg> : <svg viewBox="0 0 320 512"><path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z" /></svg>}
            </span>
          </button>
        </ImageStreamHero>

        <Suspense fallback={null}><HomeRooms /></Suspense>

        <section className="cinema-join cinema-container" aria-labelledby="join-title">
          <div><p className="cinema-eyebrow">{t("JÁ FOI CONVIDADO?")}</p><h2 id="join-title">{t("Seu grupo está esperando.")}</h2></div>
          <form className="cinema-join-form" onSubmit={event => void handleJoin(event)} noValidate aria-busy={busyAction === 'join'}>
            <label htmlFor="session-code">{t("Código da sessão")}</label>
            <div className="cinema-join-controls">
              <input id="session-code" ref={inputRef} value={code} onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setStatus(''); setFailed(false) }} placeholder="EX.: 7F9XQ2" maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busyAction !== null} aria-invalid={code.length > 0 && !complete} aria-describedby="session-code-hint session-status" />
              <CinemaButton type="submit" tone="light" direction="right" disabled={!complete || busyAction !== null}>{busyAction === 'join' ? t("Entrando…") : t("Entrar")}</CinemaButton>
            </div>
            <p className="cinema-input-hint" id="session-code-hint">{hint}</p>
          </form>
          <p id="session-status" className={'cinema-session-status' + (failed ? ' is-error' : '')} role="status" aria-live="polite">{status}</p>
        </section>

        <section id="como-funciona" className="cinema-how cinema-container">
          <div className="cinema-section-heading"><p className="cinema-eyebrow">{t("COMO FUNCIONA")}</p><h2>{t("O roteiro é simples.")}</h2><p>{t("A parte difícil era escolher. Era.")}</p></div>
          <div className="cinema-steps">{STEPS.map(step => <article className="cinema-step" key={step.number}><span className="cinema-step-number">{step.number}<ArrowUpRight size={20} aria-hidden="true" /></span><h3>{t(step.title)}</h3><p>{t(step.description)}</p></article>)}</div>
        </section>

        <section id="recursos" className="cinema-experience">
          <div className="cinema-container cinema-experience-grid">
            <div className="cinema-experience-copy"><p className="cinema-eyebrow">{t("DO “O QUE VAMOS VER?” AO PLAY")}</p><h2>{t("Gostos diferentes.")}<br /><span>{t("Um filme em comum.")}</span></h2><p>{t("Da comédia de sexta ao suspense de domingo: descubram o que combina com todo mundo.")}</p>
              <ul className="cinema-features">
                <li><SlidersHorizontal size={20} aria-hidden="true" /><div><h3>{t("O catálogo do seu jeito")}</h3><p>{t("Filtrem por gênero, duração, nota e serviços de streaming.")}</p></div></li>
                <li><Users size={20} aria-hidden="true" /><div><h3>{t("Cada pessoa tem seu voto")}</h3><p>{t("Os filtros são compartilhados. O gosto continua sendo seu.")}</p></div></li>
                <li><Heart size={20} aria-hidden="true" /><div><h3>{t("O match é do grupo")}</h3><p>{t("Todos os participantes atuais precisam curtir. Quem fecha a aba ainda faz parte da sessão.")}</p></div></li>
              </ul>
            </div>
            <LandingSwipePreview movie={selection.featured} />
          </div>
        </section>

        <section className="cinema-final-cta cinema-container"><span className="cinema-eyebrow">{t("LUZES BAIXAS. ESCOLHA FEITA.")}</span><h2>{t("Hoje tem filme.")}</h2><CinemaButton onClick={() => void handleCreate()} disabled={busyAction !== null}>{busyAction === 'create' ? t("Criando sessão…") : t("Começar uma sessão")}</CinemaButton></section>
      </main>

      <footer className="cinema-footer cinema-container">
        <div className="cinema-footer-top"><a href="/" className="cinema-brand"><Clapperboard size={20} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></a><nav aria-label={t("Informações do site")}><a href="/assistidos">{t("Meus assistidos")}</a><a href="/privacy.html">{t("Privacidade")}</a><a href="/terms.html">{t("Termos")}</a><a href="/ads.html">{t("Publicidade")}</a></nav></div>
        <div className="cinema-footer-bottom"><span>{t("Feito para decidir juntos.")}</span><p>{t("Este produto usa a API do") + " "}<a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>{t(", mas não é endossado ou certificado pelo TMDB.")}</p></div>
      </footer>
    </div>
  )
}
