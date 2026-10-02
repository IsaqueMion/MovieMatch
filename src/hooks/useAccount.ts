import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { hasAccount } from '../lib/account'

export function useAccount() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setLoading(false) }
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setUser(data.session?.user ?? null); setError(error ? 'Não foi possível consultar sua conta.' : ''); setLoading(false) }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return { user, registered: hasAccount(user), loading, error }
}
