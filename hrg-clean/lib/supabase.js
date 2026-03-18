import { createClient } from '@supabase/supabase-js'
var url = process.env.NEXT_PUBLIC_SUPABASE_URL
var key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export var supabase = createClient(url, key)
