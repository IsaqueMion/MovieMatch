import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useRef } from 'react'
import { useAccount } from '../../hooks/useAccount'
import '../../styles/account.css'

// Layout and animated mobile trigger adapted from the supplied Origin UI navbar3 reference.
export default function HomeNavigation() {
  useLocale()
  const account = useAccount()
  const mobile = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!mobile.current?.contains(event.target as Node)) mobile.current?.removeAttribute('open') }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && mobile.current?.open) { event.preventDefault(); mobile.current.open = false; mobile.current.querySelector('summary')?.focus() }
    }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const links = [{ href: '/', label: t("Início") }, ...(account.registered ? [{ href: '/#minhas-salas', label: t("Minhas salas") }, { href: '/assistidos', label: t("Assistidos") }] : [{ href: '/#recursos', label: t("A experiência") }]), { href: '/#como-funciona', label: t("Como funciona") }]
  return <div className="home-navigation">
    <nav className="home-nav-desktop" aria-label={t("Navegação principal")}>{links.map(link => <a key={link.href} href={link.href} aria-current={link.href === '/' ? 'page' : undefined}>{link.label}</a>)}</nav>
    <details className="home-nav-mobile" ref={mobile}>
      <summary aria-label={t("Menu de navegação")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></svg></summary>
      <nav aria-label={t("Navegação principal no celular")}>{links.map(link => <a key={link.href} href={link.href} aria-current={link.href === '/' ? 'page' : undefined} onClick={() => mobile.current?.removeAttribute('open')}>{link.label}</a>)}</nav>
    </details>
  </div>
}
