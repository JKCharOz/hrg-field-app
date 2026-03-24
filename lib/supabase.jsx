import { createBrowserClient } from '@supabase/ssr'

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export var supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
