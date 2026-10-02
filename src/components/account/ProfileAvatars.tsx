import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { mediaUrl } from '../../lib/account'
import '../../styles/profile-avatars.css'

type Member = { member_key?: number; id: string | null; handle: string | null; display_name: string; bio: string | null; avatar_path: string | null; cover_path: string | null; online?: boolean }

export default function ProfileAvatars({ sessionId }: { sessionId?: string | null }) {
  useLocale()
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true, running = false
    let interval: number | undefined
    async function load() {
      if (running) return
      running = true
      try {
        const { data, error } = sessionId
          ? await supabase.rpc('session_participants', { p_session_id: sessionId })
          : await supabase.rpc('community_profiles')
        if (!active) return
        setError(!!error)
        if (!error && Array.isArray(data)) setMembers(sessionId ? data.filter(member => member.online === true) : data)
      } catch { if (active) setError(true) }
      finally { running = false }
    }
    function start() { void load(); if (sessionId) interval = window.setInterval(() => { if (!document.hidden) void load() }, 15_000) }
    // Homepage examples load near the viewport, without signing in the visitor.
    const observer = !sessionId && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); start() }
    }, { rootMargin: '240px' }) : null
    if (observer && root.current) observer.observe(root.current); else start()
    const changed = () => { if (sessionId) void load() }
    window.addEventListener('moviematch:profile-changed', changed)
    window.addEventListener('focus', changed)
    return () => { active = false; observer?.disconnect(); window.clearInterval(interval); window.removeEventListener('moviematch:profile-changed', changed); window.removeEventListener('focus', changed) }
  }, [sessionId])
  return <div className="profile-avatars" ref={root} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(event.key)) event.stopPropagation() }}>
    <div className="profile-avatar-list" role="group" aria-label={sessionId ? t("Participantes da sessão") : t("Perfis públicos da comunidade")}>
      {members.map(member => <MemberAvatar key={member.member_key ?? member.id!} member={member} />)}
    </div>
    {!sessionId ? <small>{members.length ? t("Perfis públicos da comunidade · sessão ilustrativa") : error ? t("Comunidade indisponível agora · sessão ilustrativa") : t("Uma sessão ilustrativa do MovieMatch")}</small> : error ? <small role="status">{t("Não foi possível atualizar participantes.")}</small> : null}
  </div>
}

function MemberAvatar({ member }: { member: Member }) {
  useLocale()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const timer = useRef<number | undefined>(undefined)
  const root = useRef<HTMLDivElement>(null)
  function reveal() {
    const rect = root.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(270, window.innerWidth - 48)
    const below = window.innerHeight - rect.bottom
    setPosition({ left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), ...(below >= 300 || below >= rect.top ? { top: rect.bottom, maxHeight: Math.max(80, below - 16) } : { bottom: window.innerHeight - rect.top, maxHeight: Math.max(80, rect.top - 16) }) })
    setOpen(true)
  }
  function show() { window.clearTimeout(timer.current); timer.current = window.setTimeout(reveal, 450) }
  function hide() { window.clearTimeout(timer.current); setOpen(false) }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) hide() }
    const scroll = (event: Event) => {
      // Scrolling the avatar strip can follow keyboard focus; keep its pending preview.
      if (event.target instanceof Element && event.target.matches('.profile-avatar-list')) { setOpen(false); return }
      if (!(event.target instanceof Node) || !root.current?.querySelector('.member-profile-preview')?.contains(event.target)) hide()
    }
    document.addEventListener('keydown', escape); document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', scroll, true); window.addEventListener('resize', hide)
    return () => { window.clearTimeout(timer.current); document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', hide) }
  }, [])
  const image = <><UserRound size={18} aria-hidden="true" />{member.avatar_path ? <img key={member.avatar_path} src={mediaUrl(member.avatar_path)} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} /> : null}</>
  const description = member.online === undefined ? t("Perfil público") : member.online ? 'Online' : t("Fora da página, participa do consenso")
  return <div className="member-avatar" ref={root} data-open={open} onPointerEnter={event => { if (event.pointerType === 'mouse') show() }} onPointerLeave={hide} onFocus={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) show() }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) hide() }}>
    <button type="button" className="member-avatar-trigger" aria-label={`${member.display_name} · ${description}`} aria-expanded={open} onClick={() => { window.clearTimeout(timer.current); if (open) hide(); else reveal() }}><span>{image}</span>{member.online ? <i aria-hidden="true" /> : null}</button>
    {open ? <section className="member-profile-preview" style={position} aria-label={`Perfil de ${member.display_name}`}>
      <div className="member-preview-cover">{member.cover_path ? <img key={member.cover_path} src={mediaUrl(member.cover_path)} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} /> : null}</div>
      <div className="member-preview-copy"><span className="member-preview-avatar">{image}</span><strong>{member.display_name}</strong>{member.handle ? <small>@{member.handle}</small> : null}<small>{description}</small>{member.bio ? <p>{member.bio}</p> : !member.handle ? <p>{member.display_name === t("Perfil privado") ? t("Esta pessoa mantém o perfil privado.") : t("Participa sem cadastro.")}</p> : null}{member.handle ? <Link to={`/p/${member.handle}`}>{t("Ver perfil")}<ArrowUpRight size={14} aria-hidden="true" /></Link> : null}</div>
    </section> : null}
  </div>
}
