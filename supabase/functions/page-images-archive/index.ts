import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8'
import { json } from '../_shared/admin.ts'

Deno.serve(async (request) => {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
  const expectedSecret = Deno.env.get('PAGE_DEPLOY_SECRET')
  if (!expectedSecret || request.headers.get('X-Deploy-Secret') !== expectedSecret)
    return json({ error: 'forbidden' }, 403)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 503)
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: active } = await admin.from('event_editions')
    .select('page_images_path').eq('is_active', true).single()
  if (!active?.page_images_path) return json({ error: 'archive_not_configured' }, 404)
  const { data, error } = await admin.storage.from('page-images')
    .createSignedUrl(active.page_images_path, 900)
  if (error || !data) return json({ error: 'archive_unavailable' }, 500)
  return json({ signedUrl: data.signedUrl })
})
