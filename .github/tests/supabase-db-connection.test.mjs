import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareDatabaseConnection, sessionPoolerUrl } from '../../scripts/supabase-db-connection.mjs'

const projectRef = 'wjrktopqxrqpnuvdclvk'
const host = 'aws-0-ap-northeast-1.pooler.supabase.com'
const password = 'password:@/#?% 日本語'
const primary = (overrides = {}) => ({
  database_type: 'PRIMARY', pool_mode: 'transaction',
  connection_string: 'postgresql://postgres.' + projectRef + ':[YOUR-PASSWORD]@' + host + ':6543/postgres',
  ...overrides,
})

async function withEnvironment(run) {
  const directory = await mkdtemp(join(tmpdir(), 'supabase-connection-test-'))
  try {
    await run({ SUPABASE_PROJECT_ID: projectRef, SUPABASE_ACCESS_TOKEN: 'test-token',
      SUPABASE_DB_PASSWORD: password, GITHUB_ENV: join(directory, 'github-env') })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('uses session mode with TLS and correctly encodes the database password', () => {
  const url = new URL(sessionPoolerUrl([primary()], projectRef, password))
  assert.equal(url.hostname, host)
  assert.equal(url.port, '5432')
  assert.equal(decodeURIComponent(url.username), 'postgres.' + projectRef)
  assert.equal(decodeURIComponent(url.password), password)
  assert.equal(url.searchParams.get('sslmode'), 'require')
})

test('prefers the primary session configuration and excludes read replicas', () => {
  const configs = [primary({ database_type: 'READ_REPLICA', pool_mode: 'session' }), primary(),
    primary({ pool_mode: 'session', connection_string: 'postgresql://postgres.' + projectRef + '@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres' })]
  assert.equal(new URL(sessionPoolerUrl(configs, projectRef, password)).hostname, 'aws-1-ap-northeast-1.pooler.supabase.com')
})

test('accepts the API connectionString spelling', () => {
  const config = primary()
  config.connectionString = config.connection_string
  delete config.connection_string
  assert.equal(new URL(sessionPoolerUrl([config], projectRef, password)).port, '5432')
})

for (const [name, configs] of [
  ['missing primary pooler', []],
  ['read replica only', [primary({ database_type: 'READ_REPLICA' })]],
  ['wrong project', [primary({ connection_string: 'postgres://postgres.other@' + host + ':5432/postgres' })]],
  ['direct IPv6 database endpoint', [primary({ connection_string: 'postgres://postgres@db.' + projectRef + '.supabase.co:5432/postgres' })]],
  ['unexpected port', [primary({ connection_string: 'postgres://postgres.' + projectRef + '@' + host + ':1234/postgres' })]],
  ['malformed URL containing secrets', [primary({ connection_string: 'INVALID_URL_WITH_SECRET' })]],
]) {
  test('rejects ' + name + ' without exposing the connection string', () => {
    assert.throws(() => sessionPoolerUrl(configs, projectRef, password), error => {
      assert.equal(error.message.includes(password), false)
      assert.equal(error.message.includes('INVALID_URL_WITH_SECRET'), false)
      return true
    })
  })
}

test('fetches the project-specific API, masks the URL and exports it for db push', async () => {
  await withEnvironment(async env => {
    const logs = []
    await prepareDatabaseConnection({ env, log: value => logs.push(value), fetchConfig: async (url, options) => {
      assert.equal(url, 'https://api.supabase.com/v1/projects/' + projectRef + '/config/database/pooler')
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      return new Response(JSON.stringify([primary()]), { status: 200 })
    } })
    const exported = await readFile(env.GITHUB_ENV, 'utf8')
    const expectedUrl = sessionPoolerUrl([primary()], projectRef, password)
    assert.equal(exported, 'SUPABASE_DB_URL=' + expectedUrl + '\n')
    assert.equal(logs[0], '::add-mask::' + expectedUrl.replaceAll('%', '%25'))
    assert.equal(logs.slice(1).join('').includes(encodeURIComponent(password)), false)
    assert.equal(logs.join('').includes(env.SUPABASE_ACCESS_TOKEN), false)
  })
})

test('reports API permission errors without exporting a connection or leaking the response', async () => {
  await withEnvironment(async env => {
    await assert.rejects(prepareDatabaseConnection({ env, log: () => assert.fail('must not log secrets'),
      fetchConfig: async () => new Response('PRIVATE_RESPONSE', { status: 403 }) }), error => {
      assert.match(error.message, /HTTP 403/)
      assert.match(error.message, /database_pooling_config_read/)
      assert.equal(error.message.includes('PRIVATE_RESPONSE'), false)
      return true
    })
    await assert.rejects(readFile(env.GITHUB_ENV), { code: 'ENOENT' })
  })
})

test('reports network failures without leaking request credentials', async () => {
  await withEnvironment(async env => {
    await assert.rejects(prepareDatabaseConnection({ env,
      fetchConfig: async () => { throw new Error('network failure ' + env.SUPABASE_ACCESS_TOKEN) } }),
    { message: 'Failed to retrieve Supabase pooler configuration over HTTPS.' })
    await assert.rejects(readFile(env.GITHUB_ENV), { code: 'ENOENT' })
  })
})

test('rejects invalid JSON before exporting a connection', async () => {
  await withEnvironment(async env => {
    await assert.rejects(prepareDatabaseConnection({ env,
      fetchConfig: async () => new Response('invalid json', { status: 200 }) }),
    { message: 'Supabase pooler configuration response was not valid JSON.' })
    await assert.rejects(readFile(env.GITHUB_ENV), { code: 'ENOENT' })
  })
})

test('checks required settings before requesting the API', async () => {
  await assert.rejects(prepareDatabaseConnection({ env: {}, fetchConfig: () => assert.fail('must not fetch') }),
    { message: 'Missing deployment setting: SUPABASE_PROJECT_ID' })
})
