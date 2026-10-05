const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const decodeBase64 = (value: string) => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function githubInstallationToken() {
  const appId = Deno.env.get('GITHUB_APP_ID')
  const installationId = Deno.env.get('GITHUB_APP_INSTALLATION_ID')
  const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')?.replaceAll('\\n', '\n')
  if (!appId || !installationId || !privateKey) throw new Error('github_not_configured')
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    decodeBase64(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput),
  ))
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${signingInput}.${base64Url(signature)}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) throw new Error('github_auth_failed')
  return ((await response.json()) as { token: string }).token
}

export async function dispatchPagesDeploy(token: string) {
  const repository = Deno.env.get('GITHUB_REPOSITORY')
  const branch = Deno.env.get('GITHUB_PAGES_BRANCH') ?? 'main'
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('github_not_configured')
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/deploy.yml/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: branch }),
  })
  if (!response.ok) throw new Error(`github_${response.status}`)
}
