import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL || 'https://sdlpoamevaqbokqymvsz.supabase.co'
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RLNXU4S6rbh6KZgOVRit9w_E842rQzV'
export const configured=Boolean(url && key)
export const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
