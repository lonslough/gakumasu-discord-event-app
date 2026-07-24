import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export function normalizeAndValidateUserId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9_-]{3,32}$/.test(normalized) ? normalized : null
}

export async function requireAdmin(request: Request) {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !serviceKey || !authorization?.startsWith('Bearer ')) return null
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const token = authorization.slice(7)
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? admin : null
}

const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const lower = 'abcdefghijkmnopqrstuvwxyz'
const digits = '23456789'
const all = upper + lower + digits

function secureIndex(max: number): number {
  const ceiling = Math.floor(256 / max) * max
  const bytes = new Uint8Array(1)
  do crypto.getRandomValues(bytes); while (bytes[0] >= ceiling)
  return bytes[0] % max
}

export function generatePassword(): string {
  const chars = [
    upper[secureIndex(upper.length)],
    lower[secureIndex(lower.length)],
    digits[secureIndex(digits.length)],
    ...Array.from({ length: 9 }, () => all[secureIndex(all.length)]),
  ]
  for (let index = chars.length - 1; index > 0; index--) {
    const other = secureIndex(index + 1)
    ;[chars[index], chars[other]] = [chars[other], chars[index]]
  }
  return chars.join('')
}
