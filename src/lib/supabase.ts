import { createClient } from '@supabase/supabase-js'
import { authStorage } from './authStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage, persistSession: true },
})
