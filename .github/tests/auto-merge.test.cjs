const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const workflow = readFileSync(join(__dirname, '../workflows/auto-merge.yml'), 'utf8').replace(/\r\n/g, '\n');
const script = workflow.split('          script: |\n')[1]
  .split('\n').map(line => line.replace(/^            /, '')).join('\n');
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'github', 'context', 'core', script
);

async function check(options = {}) {
  const pr = {
    number: 1, state: 'open', draft: false,
    head: { sha: 'tested', repo: { full_name: 'owner/repo' } },
    base: { ref: 'develop', sha: 'base' }, ...options.pr
  };
  const success = {
    id: 1, status: 'completed', conclusion: 'success',
    head_repository: { full_name: 'owner/repo' },
    pull_requests: [{ number: 1, base: { sha: 'base' } }]
  };
  const merges = [];
  const github = {
    rest: {
      pulls: { list: 'pulls', get: async () => ({ data: pr }),
        merge: async args => { merges.push(args); } },
      actions: { listWorkflowRuns: 'runs' }
    },
    paginate: async (endpoint, args) => {
      if (endpoint === 'pulls') return [pr];
      assert.equal(args.head_sha, pr.head.sha);
      assert.equal(args.event, 'pull_request');
      return options.runs?.[args.workflow_id] ?? [success];
    }
  };
  const payload = options.ready ? { pull_request: pr } : {
    workflow_run: { head_sha: 'tested', head_repository: { full_name: 'owner/repo' } }
  };
  await execute(github, { repo: { owner: 'owner', repo: 'repo' }, payload }, { info() {} });
  return merges;
}

test('merges only after both workflows succeed, with the tested SHA', async () => {
  assert.deepEqual(await check(), [{ owner: 'owner', repo: 'repo',
    pull_number: 1, sha: 'tested', merge_method: 'merge' }]);
});

for (const workflow of ['deploy.yml', 'supabase-deploy.yml']) {
  for (const state of ['missing', 'queued', 'in_progress', 'failure', 'cancelled', 'skipped']) {
    test(`${workflow}: ${state} prevents merging`, async () => {
      const run = { id: 2, status: state === 'queued' || state === 'in_progress' ? state : 'completed',
        conclusion: state, head_repository: { full_name: 'owner/repo' },
        pull_requests: [{ number: 1, base: { sha: 'base' } }] };
      assert.equal((await check({ runs: { [workflow]: state === 'missing' ? [] : [run] } })).length, 0);
    });
  }
}

test('a newer pending run overrides an earlier successful run', async () => {
  const shared = { head_repository: { full_name: 'owner/repo' },
    pull_requests: [{ number: 1, base: { sha: 'base' } }] };
  assert.equal((await check({ runs: { 'deploy.yml': [
    { ...shared, id: 1, status: 'completed', conclusion: 'success' },
    { ...shared, id: 2, status: 'in_progress', conclusion: null }
  ] } })).length, 0);
});

for (const [name, pr] of Object.entries({
  draft: { draft: true }, closed: { state: 'closed' },
  main: { base: { ref: 'main', sha: 'base' } },
  'new head': { head: { sha: 'new', repo: { full_name: 'owner/repo' } } },
  'new base': { base: { ref: 'develop', sha: 'new-base' } },
  'different repository': { head: { sha: 'tested', repo: { full_name: 'other/repo' } } }
})) {
  test(`${name} prevents merging`, async () => {
    assert.equal((await check({ pr })).length, 0);
  });
}

test('ready_for_review also requires successful validation', async () => {
  assert.equal((await check({ ready: true })).length, 1);
  assert.equal((await check({ ready: true, runs: { 'deploy.yml': [] } })).length, 0);
});
