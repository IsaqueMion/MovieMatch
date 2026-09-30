import type { User } from '@supabase/supabase-js'

import { supabase } from './supabase'

let pendingAnonymousUser: Promise<User> | null = null

export async function ensureAnonymousUser(): Promise<User> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  if (session?.user) {
    return session.user
  }

  if (!pendingAnonymousUser) {
    pendingAnonymousUser = (async () => {
      const { data, error } = await supabase.auth.signInAnonymously()

      if (error) {
        throw error
      }

      if (!data.user) {
        throw new Error('Falha ao criar usuário anônimo.')
      }

      return data.user
    })().finally(() => {
      pendingAnonymousUser = null
    })
  }

  return pendingAnonymousUser
}