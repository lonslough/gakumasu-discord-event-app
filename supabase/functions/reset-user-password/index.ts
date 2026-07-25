import {
  corsHeaders,
  generatePassword,
  json,
  normalizeAndValidateUserId,
  requireAdmin,
} from '../_shared/admin.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405)
  const admin = await requireAdmin(request)
  if (!admin) return json({ error: 'forbidden' }, 403)
  let body: { userId?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }
  const userId = normalizeAndValidateUserId(body.userId)
  if (!userId) return json({ error: 'invalid_user_id' }, 400)
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile) return json({ error: 'not_found' }, 404)
  const password = generatePassword()
  const { error } = await admin.auth.admin.updateUserById(profile.id, {
    password,
  })
  if (error) return json({ error: 'reset_failed' }, 500)
  return json({ status: 'reset', userId, password })
})
