import { translate as t, useLocale } from '../../hooks/useLocale'
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, ChevronDown, Film, LogOut, Settings2, UserRound } from 'lucide-react'
import { useAccount } from '../../hooks/useAccount'
import { accountHref, mediaUrl, myProfile, type Profile } from '../../lib/account'
import { supabase } from '../../lib/supabase'
import '../../styles/account.css'

const ProfileEditorDialog = lazy(() => import('./ProfileEditorDialog'))

export default function AccountMenu() {
  useLocale()
  const account = useAccount()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [previewDismissed, setPreviewDismissed] = useState(false)
  const root = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true
    if (!account.registered) { setProfile(null); setOpen(false); setEditorOpen(false); return }
    const load = () => { void myProfile().then(value => { if (active) setProfile(value) }).catch(() => { /* Navigation remains usable with an avatar fallback. */ }) }
    load()
    window.addEventListener('moviematch:profile-changed', load)
    return () => { active = false; window.removeEventListener('moviematch:profile-changed', load) }
  }, [account.registered, account.user?.id])
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setPreviewDismissed(true) }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { setPreviewDismissed(true); if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() } return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(event.key)) return
    if (!open && event.target === trigger.current && event.key.startsWith('Arrow')) { event.preventDefault(); event.stopPropagation(); setOpen(true); return }
    if (!open || !menu.current?.contains(event.target as Node)) return
    event.preventDefault(); event.stopPropagation()
    const items = [...menu.current.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)')]
    if (event.key === ' ') { (event.target as HTMLElement).click(); return }
    const index = items.indexOf(document.activeElement as HTMLElement)
    items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus()
  }
  async function logout() {
    setBusy(true); setError('')
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) { setError(t("Não foi possível sair. Tente novamente.")); setBusy(false) }
    else window.location.replace('/')
  }
  const avatar = <span className="account-menu-avatar"><UserRound size={19} aria-hidden="true" />{profile?.avatar_path ? <img key={profile.avatar_path} src={mediaUrl(profile.avatar_path)} alt="" onError={event => { event.currentTarget.hidden = true }} /> : null}</span>
  return <nav className="account-menu" aria-label={t("Sua conta")}>
    <div className="account-menu-root" data-preview-dismissed={previewDismissed} ref={element => { root.current = element }} onPointerEnter={event => { if (event.pointerType === 'mouse') setPreviewDismissed(false) }} onFocus={event => { if ((event.target as HTMLElement) === trigger.current && !event.currentTarget.contains(event.relatedTarget as Node)) setPreviewDismissed(false) }} onKeyDown={keyboard} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false) }}>
      {account.registered ? <>
        <button ref={trigger} type="button" className="account-menu-trigger" aria-label={t("Abrir menu do perfil")} aria-haspopup="menu" aria-expanded={open} aria-controls="account-profile-menu" onClick={() => { setPreviewDismissed(true); setOpen(value => !value) }}>{avatar}<ChevronDown size={13} aria-hidden="true" /></button>
        {!open && !editorOpen && profile ? <section className="account-profile-preview" aria-label={t("Prévia do perfil")}><div className="account-preview-cover">{profile.cover_path ? <img key={profile.cover_path} src={mediaUrl(profile.cover_path)} alt="" onError={event => { event.currentTarget.hidden = true }} /> : null}</div><div className="account-preview-copy">{avatar}<strong>{profile.display_name}</strong><small>@{profile.handle}{!profile.is_public ? t(" · Perfil privado") : ''}</small>{profile.bio ? <p>{profile.bio}</p> : <p>{t("Seu olhar sobre o cinema.")}</p>}<Link to={`/p/${profile.handle}`}>{t("Ver perfil")}<ArrowUpRight size={14} aria-hidden="true" /></Link></div></section> : null}
        {open ? <div ref={menu} id="account-profile-menu" className="account-profile-menu" role="menu" aria-label={t("Menu do perfil")}>
          <div className="account-menu-identity">{avatar}<div><strong>{profile?.display_name || t("Minha conta")}</strong><span>{account.user?.email}</span>{profile ? <small>@{profile.handle}</small> : null}</div></div>
          <div className="account-menu-links">
            <Link role="menuitem" to={profile ? `/p/${profile.handle}` : '/perfil'} onClick={() => setOpen(false)}><UserRound size={17} aria-hidden="true" /><span>{t("Meu perfil")}</span><ArrowUpRight size={14} aria-hidden="true" /></Link>
            <Link role="menuitem" to="/perfil" aria-haspopup={profile ? 'dialog' : undefined} onClick={event => { if (profile) { event.preventDefault(); setEditorOpen(true) } setOpen(false) }}><Settings2 size={17} aria-hidden="true" /><span>{t("Editar perfil")}</span></Link>
            <Link role="menuitem" to="/assistidos" onClick={() => setOpen(false)}><Film size={17} aria-hidden="true" /><span>{t("Meus assistidos")}</span></Link>
            <a role="menuitem" href="/#minhas-salas" onClick={() => setOpen(false)}><Bookmark size={17} aria-hidden="true" /><span>{t("Minhas salas")}</span></a>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <button role="menuitem" className="account-menu-logout" disabled={busy} onClick={() => void logout()}><LogOut size={17} aria-hidden="true" />{busy ? t("Saindo…") : t("Sair da conta")}</button>
        </div> : null}
      </> : <Link className="account-login-link" to={typeof window === 'undefined' ? '/conta' : accountHref()}><UserRound size={17} aria-hidden="true" /><span>{t("Entrar")}</span></Link>}
    </div>
    {editorOpen && profile && account.registered ? <Suspense fallback={<span role="status">{t("Abrindo edição…")}</span>}><ProfileEditorDialog profile={profile} onClose={() => setEditorOpen(false)} /></Suspense> : null}
  </nav>
}
