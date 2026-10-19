import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { requireAuthStorage } from './authStorage'

let pendingAnonymousUser: Promise<User> | null = null

async function restoreOrCreateUser(): Promise<User> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (session?.user) return session.user

  // Never create a disposable identity when the next refresh would lose it.
  requireAuthStorage()
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data.user) throw new Error('Falha ao criar usuário anônimo.')
  return data.user
}

export function ensureAnonymousUser(): Promise<User> {
  if (!pendingAnonymousUser) {
    // Share initialization across callers and tabs before deciding to create a guest.
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    pendingAnonymousUser = (locks
      ? locks.request('mm:guest:' + new URL(import.meta.env.VITE_SUPABASE_URL).host, restoreOrCreateUser)
      : restoreOrCreateUser()
    ).finally(() => { pendingAnonymousUser = null })
  }
  return pendingAnonymousUser
}
