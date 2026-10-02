import { translate as t, useLocale } from '../../hooks/useLocale'
import { useEffect, useId, useRef, useState } from 'react'
import { Copy, Send, Share2, X } from 'lucide-react'
import { toast } from 'sonner'

function WhatsAppIcon() {
  useLocale()
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.001 4.908A9.817 9.817 0 0 0 11.992 2C6.534 2 2.085 6.448 2.08 11.908c0 1.748.458 3.45 1.321 4.956L2 22l5.255-1.377a9.916 9.916 0 0 0 4.737 1.206h.005c5.46 0 9.908-4.448 9.913-9.913A9.872 9.872 0 0 0 19 4.908ZM11.992 20.15A8.216 8.216 0 0 1 7.797 19l-.3-.18-3.117.818.833-3.041-.196-.314a8.2 8.2 0 0 1-1.258-4.381c0-4.533 3.696-8.23 8.239-8.23a8.2 8.2 0 0 1 5.825 2.413 8.196 8.196 0 0 1 2.41 5.825c-.006 4.55-3.702 8.24-8.24 8.24Zm4.52-6.167c-.247-.124-1.463-.723-1.692-.808-.228-.08-.394-.123-.556.124-.166.246-.641.808-.784.969-.143.166-.29.185-.537.062-.247-.125-1.045-.385-1.99-1.23-.738-.657-1.232-1.47-1.38-1.716-.142-.247-.013-.38.11-.504.11-.11.247-.29.37-.432.126-.143.167-.248.248-.413.082-.167.043-.31-.018-.433-.063-.124-.557-1.345-.765-1.838-.2-.486-.404-.419-.557-.425-.142-.009-.309-.009-.475-.009a.911.911 0 0 0-.661.31c-.228.247-.864.845-.864 2.067 0 1.22.888 2.395 1.013 2.56.122.167 1.742 2.666 4.229 3.74.587.257 1.05.408 1.41.523.595.19 1.13.162 1.558.1.475-.072 1.464-.6 1.673-1.178.205-.58.205-1.075.142-1.18-.061-.104-.227-.165-.475-.29Z" /></svg>
}

export default function ShareSessionButton({ code }: { code: string }) {
  useLocale()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const sessionCode = code.toUpperCase()
  const invite = `${window.location.origin}/join?code=${encodeURIComponent(sessionCode)}`
  const text = `Vamos escolher um filme juntos? Entre na sessão ${sessionCode} do MovieMatch.`
  const hasNativeShare = typeof navigator.share === 'function'

  function close(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    wrapper.current?.querySelector<HTMLElement>('[role="dialog"] button')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open])

  async function copy() {
    setBusy(true)
    try {
      await navigator.clipboard.writeText(invite)
      toast(t("Link copiado!"), { description: `Convide o grupo para a sessão ${sessionCode}.` })
      close(true)
    } catch { toast.error(t("Não foi possível copiar o link. Tente outra opção de compartilhamento.")) }
    finally { setBusy(false) }
  }

  async function nativeShare() {
    setBusy(true)
    try {
      await navigator.share({ title: t("MovieMatch — junte-se à minha sessão"), text, url: invite })
      close(true)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(t("Não foi possível compartilhar. Você pode copiar o link."))
      // Some browsers move focus to the document while a share action is pending.
      wrapper.current?.querySelector<HTMLElement>('[role="dialog"] button')?.focus({ preventScroll: true })
    } finally { setBusy(false) }
  }

  return <div className="cinema-share" ref={wrapper} onKeyDown={event => {
    if (!open) return
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); close(true) }
  }} onBlur={event => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) close()
  }}>
    <button ref={trigger} type="button" className="cinema-share-trigger" aria-label={t("Compartilhar sessão")} title={t("Compartilhar sessão")} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(value => !value)}>
      <Share2 size={19} aria-hidden="true" />
    </button>
    {open ? <div id={panelId} className="cinema-share-panel" role="dialog" aria-label={t("Convidar para a sessão")}>
      <div className="cinema-share-heading"><span>{t("Junte o elenco.")}</span><button type="button" onClick={() => close(true)} aria-label={t("Fechar compartilhamento")}><X size={16} aria-hidden="true" /></button></div>
      <div className="cinema-share-orbit">
        <span className="cinema-share-center" aria-hidden="true"><Share2 size={23} /></span>
        <button type="button" className="cinema-share-action share-copy" disabled={busy} onClick={() => void copy()}><Copy size={21} aria-hidden="true" /><span>{t("Copiar link")}</span></button>
        <a className="cinema-share-action share-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${invite}`)}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /><span>WhatsApp</span></a>
        <a className="cinema-share-action share-telegram" href={`https://t.me/share/url?url=${encodeURIComponent(invite)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><Send size={21} aria-hidden="true" /><span>Telegram</span></a>
        {hasNativeShare ? <button type="button" className="cinema-share-action share-native" disabled={busy} onClick={() => void nativeShare()}><Share2 size={21} aria-hidden="true" /><span>{t("Mais opções")}</span></button> : null}
      </div>
      <p>{t("Sessão") + " "}<strong>{sessionCode}</strong></p>
    </div> : null}
  </div>
}
