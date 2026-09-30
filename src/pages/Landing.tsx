import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Clapperboard, Heart, Pause, Play, SlidersHorizontal, Users } from 'lucide-react'
import { usePageMeta } from '../hooks/usePageMeta'
import { ImageStreamHero, type StreamImage } from '../components/ui/image-stream-hero'
import LandingSwipePreview from '../components/landing/LandingSwipePreview'

const POSTERS: StreamImage[] = [
  { src: '/demo/interstellar.jpg' },
  { src: '/demo/amelie.jpg' },
  { src: '/demo/grand-budapest.jpg' },
  { src: '/demo/spirited-away.jpg' },
  { src: '/demo/la-la-land.jpg' },
  { src: '/demo/arrival.jpg' },
]
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
  usePageMeta({
    title: 'MovieMatch — o próximo filme, a escolha de todos',
    description: 'Crie uma sessão, convide seu grupo e encontre um filme que todos querem assistir. Sem cadastro, no celular ou no computador.',
  })
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const [busyAction, setBusyAction] = useState<'create' | 'join' | null>(null)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const inputRef = useRef<HTMLInputElement>(null)
  const actionPending = useRef(false)
  const complete = code.length === 6
  const hint = code.length > 0 && !complete
    ? 'Faltam ' + (6 - code.length) + (code.length === 5 ? ' caractere.' : ' caracteres.')
    : 'O código tem 6 letras ou números.'

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
      setStatus('Digite os 6 caracteres do código da sessão.')
      setFailed(true)
      inputRef.current?.focus()
      return
    }
    actionPending.current = true
    setBusyAction('join')
    setFailed(false)
    setStatus('Procurando sua sessão…')
    try {
      const client = await getAuthenticatedClient()
      const { data, error } = await client.rpc('join_session', { p_code: normalizedCode })
      const session = Array.isArray(data) ? data[0] : null
      if (error || !session?.code) {
        setFailed(true)
        setStatus(!error || error.code === 'P0002' || error.code === '22023'
          ? 'Sessão não encontrada ou expirada. Confira o código ou crie uma nova.'
          : 'Não foi possível conectar à sessão. Tente novamente.')
        return
      }
      navigate('/s/' + String(session.code))
    } catch {
      setFailed(true)
      setStatus('Não foi possível conectar agora. Tente novamente.')
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
    setStatus('Preparando sua sessão…')
    try {
      const client = await getAuthenticatedClient()
      const { data, error } = await client.rpc('create_session')
      const session = Array.isArray(data) ? data[0] : null
      if (error || !session?.code) {
        setFailed(true)
        setStatus('Não foi possível criar a sessão. Tente novamente.')
        return
      }
      navigate('/s/' + String(session.code))
    } catch {
      setFailed(true)
      setStatus('Não foi possível conectar agora. Tente novamente.')
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
      <a className="cinema-skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="cinema-header cinema-container">
        <a href="/" className="cinema-brand" aria-label="MovieMatch, página inicial">
          <span className="cinema-brand-mark"><Clapperboard size={22} aria-hidden="true" /></span>
          MovieMatch<span className="cinema-brand-dot">.</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">A experiência</a>
        </nav>
        <button className="cinema-header-action" onClick={() => void handleCreate()} disabled={busyAction !== null}>
          {busyAction === 'create' ? 'Criando…' : 'Criar sessão'}<ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </header>

      <main id="conteudo">
        <ImageStreamHero images={POSTERS} paused={paused || reducedMotion} className="cinema-stream">
          <div className="cinema-stream-shade" aria-hidden="true" />
          <div className="cinema-stream-content">
            <div className="cinema-hero-copy">
              <p className="cinema-eyebrow"><span className="cinema-status-dot" /> PARA A SUA PRÓXIMA SESSÃO</p>
              <h1>O próximo filme.<br /><span>A escolha de todos.</span></h1>
              <p className="cinema-hero-description">Menos tempo escolhendo.<br className="cinema-mobile-break" /> Mais tempo assistindo juntos.</p>
            </div>
            <div className="cinema-hero-bottom">
              <p className="cinema-stream-caption">Uma prévia do catálogo. A sessão de verdade começa com você.</p>
              <div className="cinema-hero-actions">
                <button className="cinema-button cinema-button-primary" onClick={() => void handleCreate()} disabled={busyAction !== null}>
                  {busyAction === 'create' ? 'Criando sessão…' : 'Criar uma sessão'}<ArrowUpRight size={20} aria-hidden="true" />
                </button>
                <button className="cinema-button cinema-button-secondary" onClick={focusJoin} disabled={busyAction !== null}>Tenho um código<ArrowDown size={18} aria-hidden="true" /></button>
              </div>
              <p className="cinema-hero-note">Sem cadastro. Sem baixar nada. Só escolher.</p>
            </div>
          </div>
          <button className="cinema-motion-toggle" onClick={() => setPaused(value => !value)} disabled={reducedMotion} aria-pressed={paused || reducedMotion} aria-label={reducedMotion ? 'Animação pausada pela preferência de movimento reduzido' : paused ? 'Retomar animação dos pôsteres' : 'Pausar animação dos pôsteres'}>
            {paused || reducedMotion ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            <span>{reducedMotion ? 'Movimento reduzido' : paused ? 'Retomar' : 'Pausar'}</span>
          </button>
        </ImageStreamHero>

        <section className="cinema-join cinema-container" aria-labelledby="join-title">
          <div><p className="cinema-eyebrow">JÁ FOI CONVIDADO?</p><h2 id="join-title">Seu grupo está esperando.</h2></div>
          <form className="cinema-join-form" onSubmit={event => void handleJoin(event)} noValidate aria-busy={busyAction === 'join'}>
            <label htmlFor="session-code">Código da sessão</label>
            <div className="cinema-join-controls">
              <input id="session-code" ref={inputRef} value={code} onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setStatus(''); setFailed(false) }} placeholder="EX.: 7F9XQ2" maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busyAction !== null} aria-invalid={code.length > 0 && !complete} aria-describedby="session-code-hint session-status" />
              <button type="submit" className="cinema-button cinema-button-light" disabled={!complete || busyAction !== null}>{busyAction === 'join' ? 'Entrando…' : 'Entrar'}<ArrowRight size={18} aria-hidden="true" /></button>
            </div>
            <p className="cinema-input-hint" id="session-code-hint">{hint}</p>
          </form>
          <p id="session-status" className={'cinema-session-status' + (failed ? ' is-error' : '')} role="status" aria-live="polite">{status}</p>
        </section>

        <section id="como-funciona" className="cinema-how cinema-container">
          <div className="cinema-section-heading"><p className="cinema-eyebrow">COMO FUNCIONA</p><h2>O roteiro é simples.</h2><p>A parte difícil era escolher. Era.</p></div>
          <div className="cinema-steps">{STEPS.map(step => <article className="cinema-step" key={step.number}><span className="cinema-step-number">{step.number}<ArrowUpRight size={20} aria-hidden="true" /></span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
        </section>

        <section id="recursos" className="cinema-experience">
          <div className="cinema-container cinema-experience-grid">
            <div className="cinema-experience-copy"><p className="cinema-eyebrow">DO “O QUE VAMOS VER?” AO PLAY</p><h2>Gostos diferentes.<br /><span>Um filme em comum.</span></h2><p>Da comédia de sexta ao suspense de domingo: descubram o que combina com todo mundo.</p>
              <ul className="cinema-features">
                <li><SlidersHorizontal size={20} aria-hidden="true" /><div><h3>O catálogo do seu jeito</h3><p>Filtrem por gênero, duração, nota e serviços de streaming.</p></div></li>
                <li><Users size={20} aria-hidden="true" /><div><h3>Cada pessoa tem seu voto</h3><p>Os filtros são compartilhados. O gosto continua sendo seu.</p></div></li>
                <li><Heart size={20} aria-hidden="true" /><div><h3>O match é do grupo</h3><p>Todos os participantes atuais precisam curtir. Quem fecha a aba ainda faz parte da sessão.</p></div></li>
              </ul>
            </div>
            <LandingSwipePreview />
          </div>
        </section>

        <section className="cinema-final-cta cinema-container"><span className="cinema-eyebrow">LUZES BAIXAS. ESCOLHA FEITA.</span><h2>Hoje tem filme.</h2><button className="cinema-button cinema-button-primary" onClick={() => void handleCreate()} disabled={busyAction !== null}>{busyAction === 'create' ? 'Criando sessão…' : 'Começar uma sessão'}<ArrowUpRight size={20} aria-hidden="true" /></button></section>
      </main>

      <footer className="cinema-footer cinema-container">
        <div className="cinema-footer-top"><a href="/" className="cinema-brand"><Clapperboard size={20} aria-hidden="true" />MovieMatch<span className="cinema-brand-dot">.</span></a><nav aria-label="Informações do site"><a href="/privacy.html">Privacidade</a><a href="/terms.html">Termos</a><a href="/ads.html">Publicidade</a></nav></div>
        <div className="cinema-footer-bottom"><span>Feito para decidir juntos.</span><p>Este produto usa a API do <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>, mas não é endossado ou certificado pelo TMDB.</p></div>
      </footer>
    </div>
  )
}
