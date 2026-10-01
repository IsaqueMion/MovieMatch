import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, UserRound, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { mediaUrl, profileFields, uploadProfileImage, type Profile } from '../../lib/account'
import { trapDialogFocus } from '../../lib/dialogFocus'
import { GENRES } from '../swipe/filterOptions'
import CinemaButton from '../ui/cinema-button'

type Photo = { file: File; url: string }
export default function ProfileEditorDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const photos = useRef<{ avatar?: Photo; cover?: Photo }>({})
  const [draft, setDraft] = useState(profile)
  const [previews, setPreviews] = useState<{ avatar?: string; cover?: string }>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current, opener = document.activeElement as HTMLElement | null, selectedPhotos = photos.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; element?.showModal()
    return () => {
      element?.close(); document.body.style.overflow = overflow
      Object.values(selectedPhotos).forEach(photo => URL.revokeObjectURL(photo.url))
      if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true })
      else document.querySelector<HTMLElement>('.account-menu-trigger, .profile-edit-trigger')?.focus({ preventScroll: true })
    }
  }, [])
  function selectPhoto(kind: 'avatar' | 'cover', file?: File) {
    if (!file || busy) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) { setError('Use JPG, PNG ou WebP com até 6 MB.'); return }
    if (photos.current[kind]) URL.revokeObjectURL(photos.current[kind]!.url)
    const url = URL.createObjectURL(file)
    photos.current[kind] = { file, url }; setPreviews(current => ({ ...current, [kind]: url })); setError('')
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    let current = draft, photoSaved = false
    try {
      for (const kind of ['cover', 'avatar'] as const) {
        const photo = photos.current[kind]
        if (!photo) continue
        const updated = await uploadProfileImage(current, kind, photo.file)
        current = { ...current, avatar_path: updated.avatar_path, cover_path: updated.cover_path }
        setDraft(current); delete photos.current[kind]; URL.revokeObjectURL(photo.url)
        setPreviews(previous => ({ ...previous, [kind]: undefined })); photoSaved = true
        window.dispatchEvent(new CustomEvent('moviematch:profile-changed', { detail: updated }))
      }
      const { handle, display_name, bio, genres, is_public, show_favorites, show_reviews } = current
      const response = await supabase.from('profiles').update({ handle, display_name: display_name.trim(), bio: bio.trim(), genres, is_public, show_favorites, show_reviews }).eq('id', current.id).select(profileFields).single()
      if (response.error) throw response.error
      window.dispatchEvent(new CustomEvent('moviematch:profile-changed', { detail: response.data }))
      onClose()
    } catch (cause) {
      const code = (cause as { code?: string }).code
      setError((photoSaved ? 'A imagem foi atualizada. ' : '') + (code === '23505' ? 'Esse endereço já está em uso. Escolha outro.' : cause instanceof Error && cause.message.startsWith('Use ') ? cause.message : 'Não foi possível salvar todas as alterações. Seus textos continuam aqui.'))
    } finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="account-page profile-edit-dialog" aria-labelledby="profile-edit-title" onKeyDown={event => { trapDialogFocus(event); event.stopPropagation() }} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <header><div><h2 id="profile-edit-title">Editar perfil</h2><p>Seu cinema, com sua cara.</p></div><button type="button" disabled={busy} aria-label="Fechar edição de perfil" onClick={onClose}><X size={19} /></button></header>
    <form onSubmit={save}>
      <div className="profile-edit-scroll">
        <div className="profile-edit-cover">{previews.cover || draft.cover_path ? <img key={previews.cover || draft.cover_path} src={previews.cover || mediaUrl(draft.cover_path)} alt="Prévia da capa" onError={event => { event.currentTarget.hidden = true }} /> : null}<button type="button" disabled={busy} aria-label="Escolher foto de capa" onClick={() => coverInput.current?.click()}><Camera size={18} /><span>Alterar capa</span></button></div>
        <div className="profile-edit-avatar"><UserRound size={30} aria-hidden="true" />{previews.avatar || draft.avatar_path ? <img key={previews.avatar || draft.avatar_path} src={previews.avatar || mediaUrl(draft.avatar_path)} alt="Prévia da foto de perfil" onError={event => { event.currentTarget.hidden = true }} /> : null}<button type="button" disabled={busy} aria-label="Escolher foto de perfil" onClick={() => avatarInput.current?.click()}><Camera size={17} /></button></div>
        <input ref={coverInput} aria-label="Foto de capa" hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { selectPhoto('cover', event.target.files?.[0]); event.target.value = '' }} />
        <input ref={avatarInput} aria-label="Foto de perfil" hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { selectPhoto('avatar', event.target.files?.[0]); event.target.value = '' }} />
        <p className="profile-edit-image-hint">JPG, PNG ou WebP · até 6 MB. As fotos são públicas por link e só serão enviadas ao salvar.</p>
        {error ? <p className="account-auth-error" role="alert">{error}</p> : null}
        <div className="profile-edit-fields"><label>Nome público<input autoFocus value={draft.display_name} onChange={event => setDraft({ ...draft, display_name: event.target.value })} required minLength={2} maxLength={32} disabled={busy} autoComplete="nickname" /></label>
        <label>Endereço do perfil<input value={draft.handle} onChange={event => setDraft({ ...draft, handle: event.target.value.toLowerCase() })} required pattern="[a-z0-9][a-z0-9-]{2,29}" minLength={3} maxLength={30} disabled={busy} /><small>/p/{draft.handle}</small></label></div>
        <label>Bio<textarea aria-label="Bio" value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} maxLength={280} rows={3} disabled={busy} /></label><small className="profile-edit-counter">{draft.bio.length}/280</small>
        <details className="profile-edit-options"><summary>Gêneros e privacidade</summary><fieldset><legend>Gêneros preferidos · até cinco</legend><div className="profile-genre-picker">{GENRES.map(({ id, name }) => <button key={id} type="button" aria-pressed={draft.genres.includes(id)} disabled={busy || !draft.genres.includes(id) && draft.genres.length >= 5} onClick={() => setDraft({ ...draft, genres: draft.genres.includes(id) ? draft.genres.filter(value => value !== id) : [...draft.genres, id] })}>{name}</button>)}</div></fieldset>
        <fieldset className="profile-privacy"><legend>O que aparece no perfil</legend><label><input type="checkbox" checked={draft.is_public} onChange={event => setDraft({ ...draft, is_public: event.target.checked })} disabled={busy} />Perfil público</label><label><input type="checkbox" checked={draft.show_favorites} onChange={event => setDraft({ ...draft, show_favorites: event.target.checked })} disabled={busy} />Mostrar favoritos</label><label><input type="checkbox" checked={draft.show_reviews} onChange={event => setDraft({ ...draft, show_reviews: event.target.checked })} disabled={busy} />Mostrar minhas avaliações neste perfil</label><small>Avaliações publicadas continuam visíveis no filme. Assistidos e salas são privados.</small></fieldset></details>
      </div>
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><CinemaButton compact type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</CinemaButton></footer>
    </form>
  </dialog>
}
