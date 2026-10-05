import { corsHeaders, json, requireAdmin } from '../_shared/admin.ts'
import { dispatchPagesDeploy, githubInstallationToken } from '../_shared/github.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const admin = await requireAdmin(request)
  if (!admin) return json({ error: 'forbidden' }, 403)
  let eventId: string
  try {
    const body = await request.json() as { eventId?: unknown }
    if (typeof body.eventId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.eventId)) throw new Error()
    eventId = body.eventId
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }

  const { data: target } = await admin.from('event_editions')
    .select('page_images_path').eq('id', eventId).single()
  if (!target?.page_images_path) return json({ error: 'page_images_required' }, 409)
  const { data: previous } = await admin.from('event_editions')
    .select('id').eq('is_active', true).maybeSingle()
  const { error: activateError } = await admin.rpc('set_active_event', { p_event_id: eventId })
  if (activateError) return json({ error: 'activate_failed' }, 500)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (/localhost|127\.0\.0\.1|host\.docker\.internal|\/\/kong(?::|\/)/.test(supabaseUrl))
    return json({ status: 'activated_locally' })
  try {
    const token = await githubInstallationToken()
    await dispatchPagesDeploy(token)
  } catch (error) {
    console.error(error)
    if (previous?.id) await admin.rpc('set_active_event', { p_event_id: previous.id })
    return json({ error: 'deploy_trigger_failed' }, 502)
  }
  return json({ status: 'deploying' })
})
