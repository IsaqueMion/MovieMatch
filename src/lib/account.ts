import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { LibraryMovie } from './movieLibrary'

export const hasAccount = (user: User | null | undefined) => Boolean(user && !user.is_anonymous && user.email_confirmed_at)
export const safeReturnTo = (path: string | null) => path && /^\/(?:s\/[A-Z0-9]{6}(?:\/(?:matches|assistidos))?|assistidos|perfil)?$/.test(path) ? path : '/'
export const accountHref = () => `/conta?voltar=${encodeURIComponent(safeReturnTo(window.location.pathname))}`
export async function requireAccount() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!hasAccount(session?.user)) throw new Error('Entre na sua conta para publicar avaliações.')
  return session!.user
}
const TICKET = 'mm:guest-transfer'
export async function prepareGuestTransfer() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user.is_anonymous) return
  const { data, error } = await supabase.rpc('prepare_guest_transfer')
  if (error) throw error
  // Store the ticket before changing identity; storage failure must not silently lose the visitor's history.
  if (data) sessionStorage.setItem(TICKET, data)
}
export async function claimGuestTransfer() {
  const ticket = sessionStorage.getItem(TICKET)
  if (!ticket) return
  const { error } = await supabase.rpc('claim_guest_transfer', { p_token: ticket })
  if (error) throw new Error('Sua conta entrou, mas o histórico deste navegador não foi transferido. Tente novamente antes de sair desta aba.')
  sessionStorage.removeItem(TICKET)
  window.dispatchEvent(new Event('moviematch:watched-changed'))
}
export const discardGuestTransfer = () => sessionStorage.removeItem(TICKET)
export type Profile = { id: string; handle: string; display_name: string; bio: string; avatar_path: string | null; cover_path: string | null; genres: number[]; is_public: boolean; show_favorites: boolean; show_reviews: boolean }
export type Favorite = LibraryMovie & { profile_id: string; slot: number }
export type SavedRoom = { session_id: string; code: string; name: string; saved_at: string }
export const profileFields = 'id,handle,display_name,bio,avatar_path,cover_path,genres,is_public,show_favorites,show_reviews'
export const mediaUrl = (path: string | null) => path ? supabase.storage.from('profile-media').getPublicUrl(path).data.publicUrl : undefined
export async function myProfile(): Promise<Profile> {
  await requireAccount()
  const { data, error } = await supabase.rpc('my_profile')
  if (error) throw error
  return data
}
export async function savedRooms(): Promise<SavedRoom[]> {
  const { data, error } = await supabase.rpc('my_saved_sessions')
  if (error) throw error
  return data ?? []
}

export async function uploadProfileImage(profile: Profile, kind: 'avatar' | 'cover', file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) throw new Error('Use JPG, PNG ou WebP com até 6 MB.')
  const image = await createImageBitmap(file)
  try {
    if (image.width * image.height > 40_000_000) throw new Error('Use uma imagem de até 40 megapixels.')
    const max = kind === 'avatar' ? 512 : 1600
    const ratio = Math.min(1, max / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a imagem.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível converter a imagem.')), 'image/webp', 0.85))
    const path = `${profile.id}/${kind}-${crypto.randomUUID()}.webp`
    const uploaded = await supabase.storage.from('profile-media').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
    if (uploaded.error) throw uploaded.error
    const field = kind === 'avatar' ? 'avatar_path' : 'cover_path'
    const updated = await supabase.from('profiles').update({ [field]: path }).eq('id', profile.id).select(profileFields).single()
    if (updated.error) { await supabase.storage.from('profile-media').remove([path]); throw updated.error }
    if (profile[field]) await supabase.storage.from('profile-media').remove([profile[field]!])
    return updated.data as Profile
  } finally { image.close() }
}
