import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowLeftRight, Heart, SlidersHorizontal, Share2, X } from 'lucide-react'
import Stepper, { Step } from '../ui/Stepper'
import SwipeActionButtons from './SwipeActionButtons'
import { trapDialogFocus } from '../../lib/dialogFocus'

export type SwipeTutorialHandle = { open: () => void }
type Props = { sessionId: string; code: string }
const keyFor = (sessionId: string) => `mm:swipe-tutorial:v1:${sessionId}`
function shouldShow(sessionId: string) {
  try { return sessionStorage.getItem('mm:created-session') === sessionId && localStorage.getItem(keyFor(sessionId)) !== '1' } catch { return false }
}

const SwipeTutorial = forwardRef<SwipeTutorialHandle, Props>(function SwipeTutorial({ sessionId, code }, ref) {
  const [open, setOpen] = useState(() => shouldShow(sessionId))
  useEffect(() => {
    try { if (sessionStorage.getItem('mm:created-session') === sessionId) sessionStorage.removeItem('mm:created-session') } catch { /* The help button remains available. */ }
  }, [sessionId])
  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), [])
  function close() {
    try { localStorage.setItem(keyFor(sessionId), '1') } catch { /* Dismissal still works for the current visit. */ }
    setOpen(false)
  }
  return open ? <TutorialDialog code={code} onClose={close} /> : null
})
export default SwipeTutorial

function TutorialDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener?.isConnected && opener.matches('button:not(:disabled), a[href]')) opener.focus({ preventScroll: true })
      else (document.querySelector<HTMLButtonElement>('.cinema-vote-button.is-like:not(:disabled)') ?? document.querySelector<HTMLButtonElement>('[aria-label="Abrir filtros"]'))?.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={dialogRef} className="swipe-tutorial-dialog" aria-label="Como votar no MovieMatch" onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><p className="cinema-eyebrow">Bem-vindo à sessão {code.toUpperCase()}</p><button type="button" className="swipe-dialog-close" aria-label="Pular tutorial" onClick={onClose} autoFocus><X size={19} aria-hidden="true" /></button></header>
    <Stepper backButtonText="Voltar" nextButtonText="Próximo" completeButtonText="Começar a votar" onFinalStepCompleted={onClose}>
      <Step><div className="swipe-tutorial-step"><ArrowLeftRight size={26} aria-hidden="true" /><h2>Seu gosto entra<br /><span>em cena.</span></h2><p>Curtiu o filme? Vá de coração. Não combina com você? Pode passar. Mudou de ideia? Desfaça o último voto.</p><div className="swipe-tutorial-votes" aria-hidden="true"><SwipeActionButtons interactive={false} /></div><div className="swipe-tutorial-keys"><span><kbd>←</kbd>Passo</span><span><kbd>→</kbd>Quero assistir</span><span><kbd>⌫</kbd>Desfazer</span></div><small>No celular, você também pode arrastar o pôster para votar.</small></div></Step>
      <Step><div className="swipe-tutorial-step"><SlidersHorizontal size={26} aria-hidden="true" /><h2>O catálogo.<br /><span>Do jeito de vocês.</span></h2><p>Use os filtros para escolher gêneros, duração, nota e plataformas. Os filtros valem para toda a sessão; cada pessoa continua votando do seu jeito.</p><div className="swipe-tutorial-invite"><Share2 size={22} aria-hidden="true" /><div><strong>Junte o grupo.</strong><p>Toque em compartilhar para enviar o convite ou passe o código <b>{code.toUpperCase()}</b>.</p></div></div></div></Step>
      <Step><div className="swipe-tutorial-step"><Heart size={26} aria-hidden="true" /><h2>Gostos diferentes.<br /><span>O mesmo sim.</span></h2><p>O match aparece quando todos os participantes atuais curtem o filme, com pelo menos duas pessoas na sessão.</p><div className="swipe-tutorial-consensus"><Heart size={30} fill="currentColor" aria-hidden="true" /><strong>A escolha é de vocês.</strong><span>Abra os matches para ver sinopse, trailer e onde assistir.</span></div><small>Quem fecha a aba continua fazendo parte da sessão.</small></div></Step>
    </Stepper>
    <button type="button" className="swipe-tutorial-skip" onClick={onClose}>Já sei como funciona</button>
  </dialog>
}
