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
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return json({ status: 'already_exists', userId })
  const password = generatePassword()
  const { data, error } = await admin.auth.admin.createUser({
    email: `${userId}@app.invalid`,
    password,
    email_confirm: true,
  })
  if (error || !data.user) return json({ error: 'create_failed' }, 500)
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, user_id: userId, role: 'user' })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return json({ error: 'create_failed' }, 500)
  }
  return json({ status: 'created', userId, password })
})
