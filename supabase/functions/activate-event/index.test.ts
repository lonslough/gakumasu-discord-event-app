// @vitest-environment node
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '../_shared/admin.ts'

// Exercise the real SDK's outgoing headers without making network requests.
vi.mock('https://esm.sh/@supabase/supabase-js@2.110.8', async () =>
  await import('@supabase/supabase-js'))
const github = vi.hoisted(() => ({ token: vi.fn(), dispatch: vi.fn() }))
vi.mock('../_shared/github.ts', () => ({
  githubInstallationToken: github.token,
  dispatchPagesDeploy: github.dispatch,
}))

const targetId = '00000000-0000-0000-0000-000000000002'
const previousId = '00000000-0000-0000-0000-000000000001'
const callerId = '00000000-0000-0000-0000-000000000003'
const userAuthorization = 'Bearer verified-admin-jwt'
const serviceAuthorization = 'Bearer test-service-role-key'
let handleRequest: (request: Request) => Promise<Response>
let env: Record<string, string>
let profileRole: string
let invalidToken: boolean
let hasImages: boolean
let rpcError: boolean
let restoreError: boolean
let calls: { path: string; authorization: string | null; body: unknown }[]
let errors: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => env[name] },
    serve: (handler: typeof handleRequest) => { handleRequest = handler },
  })
  await import('./index.ts')
})

beforeEach(() => {
  env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key' }
  profileRole = 'admin'
  invalidToken = false
  hasImages = true
  rpcError = false
  restoreError = false
  calls = []
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  github.token.mockReset().mockResolvedValue('installation-token')
  github.dispatch.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const authorization = request.headers.get('Authorization')
    const body = request.method === 'POST' ? await request.json() : null
    calls.push({ path: url.pathname, authorization, body })
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json' },
    })
    if (url.pathname === '/auth/v1/user') {
      if (invalidToken) return respond({ message: 'invalid JWT' }, 401)
      return respond({ id: callerId, aud: 'authenticated', role: 'authenticated',
        app_metadata: {}, user_metadata: {}, created_at: '2026-10-12T00:00:00Z' })
    }
    if (url.pathname === '/rest/v1/profiles') {
      expect(url.searchParams.get('id')).toBe('eq.' + callerId)
      return respond({ role: profileRole })
    }
    if (url.pathname === '/rest/v1/event_editions') {
      if (url.searchParams.get('id')) return respond({ page_images_path: hasImages ? 'images.zip' : null })
      return respond({ id: previousId })
    }
    if (url.pathname === '/rest/v1/rpc/set_active_event') {
      // Model the DB's auth.uid() check: service_role alone has no caller identity.
      if (authorization !== userAuthorization || rpcError ||
        (restoreError && (body as { p_event_id: string }).p_event_id === previousId)) {
        return respond({ code: 'P0001', message: 'administrator required', details: null, hint: null }, 400)
      }
      return new Response(null, { status: 204 })
    }
    throw new Error('Unexpected request: ' + url.pathname)
  }))
})

afterEach(() => {
  errors.mockRestore()
})

function activate(authorization: string | null = userAuthorization) {
  return handleRequest(new Request('https://example.supabase.co/functions/v1/activate-event', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization, 'Content-Type': 'application/json' } : {},
    body: JSON.stringify({ eventId: targetId }),
  }))
}

const rpcCalls = () => calls.filter(call => call.path === '/rest/v1/rpc/set_active_event')

describe('activate-event authentication', () => {
  it('forwards the verified admin JWT to DB reads and activation, then requests deployment', async () => {
    const response = await activate()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'deploying' })
    expect(calls.find(call => call.path === '/auth/v1/user')?.authorization).toBe(userAuthorization)
    expect(calls.find(call => call.path === '/rest/v1/profiles')?.authorization).toBe(serviceAuthorization)
    expect(calls.filter(call => call.path === '/rest/v1/event_editions').every(call => call.authorization === userAuthorization)).toBe(true)
    expect(rpcCalls()).toEqual([{ path: '/rest/v1/rpc/set_active_event', authorization: userAuthorization, body: { p_event_id: targetId } }])
    expect(github.dispatch).toHaveBeenCalledWith('installation-token')
  })

  it('uses the same admin JWT when restoring the previous event after deployment fails', async () => {
    github.dispatch.mockRejectedValue(new Error('deployment unavailable'))
    const response = await activate()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'deploy_trigger_failed' })
    expect(rpcCalls().map(call => [call.authorization, call.body])).toEqual([
      [userAuthorization, { p_event_id: targetId }],
      [userAuthorization, { p_event_id: previousId }],
    ])
  })

  it('logs restoration errors', async () => {
    github.dispatch.mockRejectedValue(new Error('deployment unavailable'))
    restoreError = true
    expect((await activate()).status).toBe(502)
    expect(errors).toHaveBeenCalledWith('Failed to restore active event', expect.objectContaining({ message: 'administrator required' }))
  })

  it('logs RPC errors, returns the fixed error code and skips deployment', async () => {
    rpcError = true
    const response = await activate()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'activate_failed' })
    expect(errors).toHaveBeenCalledWith('Failed to activate event', expect.objectContaining({ code: 'P0001', message: 'administrator required' }))
    expect(github.dispatch).not.toHaveBeenCalled()
  })

  it('rejects non-admin users before calling activation', async () => {
    profileRole = 'user'
    expect((await activate()).status).toBe(403)
    expect(rpcCalls()).toHaveLength(0)
    expect(github.dispatch).not.toHaveBeenCalled()
  })

  it('rejects an invalid JWT before querying profiles or calling activation', async () => {
    invalidToken = true
    expect((await activate()).status).toBe(403)
    expect(calls).toHaveLength(1)
    expect(rpcCalls()).toHaveLength(0)
  })

  it('rejects missing authentication without making any upstream requests', async () => {
    expect((await activate(null)).status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('requires stored page images before activation', async () => {
    hasImages = false
    expect((await activate()).status).toBe(409)
    expect(rpcCalls()).toHaveLength(0)
  })

  it('activates locally using the admin JWT without requesting deployment', async () => {
    env.SUPABASE_URL = 'http://127.0.0.1:54321'
    const response = await activate()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'activated_locally' })
    expect(rpcCalls()[0].authorization).toBe(userAuthorization)
    expect(github.dispatch).not.toHaveBeenCalled()
  })

  it('keeps service_role authorization for the default user-management client', async () => {
    const client = await requireAdmin(new Request('https://example.test', {
      headers: { Authorization: userAuthorization },
    }))
    expect(client).not.toBeNull()
    await client!.from('profiles').select('role').eq('id', callerId).single()
    expect(calls.filter(call => call.path === '/rest/v1/profiles').map(call => call.authorization))
      .toEqual([serviceAuthorization, serviceAuthorization])
  })
})
