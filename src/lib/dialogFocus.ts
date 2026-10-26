import type { KeyboardEvent } from 'react'

const focusableSelector = 'button:not(:disabled):not([tabindex="-1"]), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe, summary, [tabindex="0"]'
const fallbackDialogs: HTMLDialogElement[] = []
const hiddenElements = new Map<Element, { count: number; original: string | null }>()
let openCount = 0
let previousOverflow = ''
let previousDialogOpen: string | null = null

function focusableElements(dialog: HTMLDialogElement) {
  return [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter(element => element.getClientRects().length > 0 && !element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[inert]'))
}

export function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog) return () => {}
  const lockScroll = () => {
    if (openCount++ === 0) {
      previousOverflow = document.body.style.overflow
      previousDialogOpen = document.body.getAttribute('data-dialog-open')
    }
    document.body.style.overflow = 'hidden'
    document.body.setAttribute('data-dialog-open', '')
  }
  const unlockScroll = () => {
    if (--openCount !== 0) return
    document.body.style.overflow = previousOverflow
    if (previousDialogOpen === null) document.body.removeAttribute('data-dialog-open')
    else document.body.setAttribute('data-dialog-open', previousDialogOpen)
  }
  if (typeof dialog.showModal === 'function' && typeof dialog.close === 'function') {
    if (!dialog.open) dialog.showModal()
    lockScroll()
    return () => { dialog.close(); unlockScroll() }
  }

  const opener = document.activeElement as HTMLElement | null
  const attributes = ['role', 'aria-modal', 'aria-hidden', 'tabindex'].map(name => [name, name === 'aria-hidden' && hiddenElements.has(dialog) ? hiddenElements.get(dialog)!.original : dialog.getAttribute(name)] as const)
  const hidden: Element[] = []
  const backdrop = document.createElement('div')
  backdrop.className = 'dialog-fallback-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')
  dialog.before(backdrop)
  fallbackDialogs.push(dialog)
  dialog.setAttribute('data-dialog-fallback', '')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.removeAttribute('aria-hidden')
  dialog.setAttribute('tabindex', '-1')
  dialog.setAttribute('open', '')
  lockScroll()

  // Hide siblings along the ancestor chain, never an ancestor of the dialog.
  for (let branch: Element = dialog; branch.parentElement; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch || sibling === backdrop) continue
      const entry = hiddenElements.get(sibling) ?? { count: 0, original: sibling.getAttribute('aria-hidden') }
      entry.count++
      hiddenElements.set(sibling, entry)
      hidden.push(sibling)
      sibling.setAttribute('aria-hidden', 'true')
    }
    if (branch.parentElement === document.body) break
  }

  const isTop = () => fallbackDialogs[fallbackDialogs.length - 1] === dialog
  const focus = () => (dialog.querySelector<HTMLElement>('[autofocus]') ?? focusableElements(dialog)[0] ?? dialog).focus({ preventScroll: true })
  const cancel = () => dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
  const keydown = (event: globalThis.KeyboardEvent) => {
    if (!isTop()) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
    } else if (event.key === 'Tab') {
      const elements = focusableElements(dialog)
      const first = elements[0], last = elements[elements.length - 1]
      if (!first || !dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        const target = event.shiftKey ? last ?? dialog : first ?? dialog
        target.focus()
      }
    }
  }
  const focusin = (event: FocusEvent) => { if (isTop() && !dialog.contains(event.target as Node)) focus() }
  const blockBackground = (event: Event) => {
    if (!isTop() || dialog.contains(event.target as Node)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.type === 'click' && event.target === backdrop) cancel()
  }
  document.addEventListener('keydown', keydown, true)
  document.addEventListener('focusin', focusin, true)
  const pointerEvents = ['click', 'pointerdown', 'mousedown', 'touchstart'] as const
  for (const name of pointerEvents) document.addEventListener(name, blockBackground, { capture: true, passive: false })
  focus()

  return () => {
    document.removeEventListener('keydown', keydown, true)
    document.removeEventListener('focusin', focusin, true)
    for (const name of pointerEvents) document.removeEventListener(name, blockBackground, true)
    fallbackDialogs.splice(fallbackDialogs.indexOf(dialog), 1)
    backdrop.remove()
    dialog.removeAttribute('open')
    dialog.removeAttribute('data-dialog-fallback')
    for (const [name, value] of attributes) { if (value === null) dialog.removeAttribute(name); else dialog.setAttribute(name, value) }
    for (const element of hidden) {
      const entry = hiddenElements.get(element)!
      if (--entry.count !== 0) continue
      if (entry.original === null) element.removeAttribute('aria-hidden')
      else element.setAttribute('aria-hidden', entry.original)
      hiddenElements.delete(element)
    }
    unlockScroll()
    if (opener?.isConnected && !opener.matches(':disabled')) opener.focus({ preventScroll: true })
  }
}

export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const elements = focusableElements(event.currentTarget)
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
