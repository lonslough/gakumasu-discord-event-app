import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function sessionPoolerUrl(configs, projectRef, password) {
  const primary = Array.isArray(configs)
    ? configs.filter(config => config?.database_type === 'PRIMARY') : []
  const config = primary.find(config => config.pool_mode === 'session')
    ?? primary.find(config => config.pool_mode === 'transaction')
  const connectionString = config?.connection_string ?? config?.connectionString
  if (typeof connectionString !== 'string') {
    throw new Error('No primary Session pooler connection found in the Supabase API response.')
  }
  let url
  try {
    url = new URL(connectionString.replaceAll(':[YOUR-PASSWORD]', ''))
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !url.hostname.endsWith('.pooler.supabase.com')
      || !['5432', '6543'].includes(url.port)
      || decodeURIComponent(url.username) !== 'postgres.' + projectRef
      || url.pathname !== '/postgres') throw new Error()
  } catch {
    // Never include the source URL: it may contain credentials.
    throw new Error('Invalid Session pooler connection for the configured Supabase project.')
  }
  // The shared pooler exposes session mode on 5432 even when the API returns 6543.
  url.port = '5432'
  url.password = encodeURIComponent(password)
  url.searchParams.set('sslmode', 'require')
  return url.href
}

export async function prepareDatabaseConnection({ env = process.env, fetchConfig = fetch, log = console.log } = {}) {
  for (const name of ['SUPABASE_PROJECT_ID', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'GITHUB_ENV']) {
    if (!env[name]) throw new Error('Missing deployment setting: ' + name)
  }
  const projectRef = env.SUPABASE_PROJECT_ID
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error('Invalid SUPABASE_PROJECT_ID.')
  let response
  try {
    response = await fetchConfig('https://api.supabase.com/v1/projects/' + projectRef + '/config/database/pooler', {
      headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN },
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new Error('Failed to retrieve Supabase pooler configuration over HTTPS.')
  }
  if (!response.ok) {
    throw new Error('Supabase pooler configuration request failed (HTTP ' + response.status
      + '). Check the access token and its database_pooling_config_read permission.')
  }
  let configs
  try { configs = await response.json() } catch {
    throw new Error('Supabase pooler configuration response was not valid JSON.')
  }
  const dbUrl = sessionPoolerUrl(configs, projectRef, env.SUPABASE_DB_PASSWORD)
  // Mask the full URL before exporting it to subsequent Actions steps.
  log('::add-mask::' + dbUrl.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'))
  await appendFile(env.GITHUB_ENV, 'SUPABASE_DB_URL=' + dbUrl + '\n', { encoding: 'utf8', mode: 0o600 })
  log('Configured primary database access through the IPv4 Session pooler (port 5432).')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareDatabaseConnection().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
