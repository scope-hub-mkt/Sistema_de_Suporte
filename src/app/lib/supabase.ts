import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Quando as variáveis não estão setadas, o app roda em modo "demo" com dados
// mockados em memória — útil para rodar localmente antes de plugar o backend.
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null

export const isSupabaseConfigured = !!supabase
