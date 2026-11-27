// MUTATION-TIER-VERDICT-REUSE-1 — selftests for scripts/ci/mutation-verdict-from-pr.mjs.
// RED/GREEN: the merge_group seeding script fails OPEN TO RUNNING (nothing seeded) on every
// failure shape, and seeds only records whose key equals the one recomputed on the queue tree.
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prNumberFromQueueRef, findGreenRun, copyMatchingRecords, seedVerdicts } from './mutation-verdict-from-pr.mjs';

let passed = 0;
let failed = 0;
const cleanup = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }
process.on('exit', () => { for (const d of cleanup) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } } });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'mvfp-')); cleanup.push(d); return d; };

const SHA = 'f'.repeat(40);
const QUEUE = `refs/heads/gh-readonly-queue/main/pr-3136-${'a'.repeat(40)}`;
const KEY = 'k'.repeat(64);
const quiet = () => {};

// A fake gh: routes by the api path; `routes` maps a substring to a response (string) or Error.
function fakeGh(routes, downloadFiles = {}) {
  return (args) => {
    if (args[0] === 'run' && args[1] === 'download') {
      const dir = args[args.indexOf('--dir') + 1];
      for (const [f, body] of Object.entries(downloadFiles)) writeFileSync(join(dir, f), body);
      return '';
    }
    const path = args[1];
    for (const [needle, res] of Object.entries(routes)) {
      if (path.includes(needle)) { if (res instanceof Error) throw res; return res; }
    }
    throw new Error(`unrouted gh call ${args.join(' ')}`);
  };
}
const greenRoutes = () => ({
  'pulls/3136': SHA + '\n',
  'workflows/scripts-verify.yml/runs': JSON.stringify({ workflow_runs: [{ id: 11, created_at: '2026-11-23T10:00:00Z' }] }),
  'actions/runs/11/jobs': JSON.stringify({ jobs: [{ name: 'Mutation tier leg — shard 0/6', conclusion: 'success' }, { name: 'Mutation tier leg — shard 1/6', conclusion: 'success' }, { name: 'other', conclusion: 'failure' }] }),
});
const rec = (kernel, key, verdict = 'PASS') => JSON.stringify({ kernel, key, verdict, scores: {}, run_id: '11', at: 'x' });
const envFor = (dir) => ({ MUTATION_VERDICT_DIR: dir, REPO: 'o/r', QUEUE_REF: QUEUE, VERDICT_SHARD: '0' });
const keyMatch = (k) => (kernel, _root, dec) => (kernel === 'good' && !dec ? k : 'different');

console.log('mutation-verdict-from-pr selftests');

test('queue ref parses to the PR number; anything else is null', () => {
  assert(prNumberFromQueueRef(QUEUE) === 3136, 'queue ref');
  assert(prNumberFromQueueRef('refs/pull/3136/merge') === null, 'pull ref is not a queue ref');
  assert(prNumberFromQueueRef(undefined) === null, 'undefined');
});

test('GREEN: green run found, matching-key PASS record seeded, mismatching and non-PASS records rejected', () => {
  const dir = tmp();
  const r = seedVerdicts({
    env: envFor(dir), repoRoot: dir, log: quiet, keyFor: keyMatch(KEY),
    gh: fakeGh(greenRoutes(), { [`good.${KEY}.json`]: rec('good', KEY), [`bad.${KEY}.json`]: rec('bad', KEY), [`failrec.${KEY}.json`]: rec('failrec', KEY, 'FAIL') }),
  });
  assert(r.seeded === 1 && r.runId === 11, `expected exactly 1 seeded from run 11, got ${JSON.stringify(r)}`);
  assert(readdirSync(dir).includes(`good.${KEY}.json`) && !existsSync(join(dir, `bad.${KEY}.json`)), 'only the equal-key record is copied');
});

test('RED: no completed run for the head SHA -> nothing seeded', () => {
  const dir = tmp();
  const routes = { ...greenRoutes(), 'workflows/scripts-verify.yml/runs': JSON.stringify({ workflow_runs: [] }) };
  const r = seedVerdicts({ env: envFor(dir), repoRoot: dir, log: quiet, gh: fakeGh(routes, { [`good.${KEY}.json`]: rec('good', KEY) }), keyFor: keyMatch(KEY) });
  assert(r.seeded === 0 && r.reason === 'no-green-run', JSON.stringify(r));
  assert(readdirSync(dir).length === 0, 'directory stays empty');
});

test('RED: a red Mutation tier shard in the only run -> nothing seeded', () => {
  const dir = tmp();
  const routes = { ...greenRoutes(), 'actions/runs/11/jobs': JSON.stringify({ jobs: [{ name: 'Mutation tier leg — shard 0/6', conclusion: 'success' }, { name: 'Mutation tier leg — shard 1/6', conclusion: 'failure' }] }) };
  const r = seedVerdicts({ env: envFor(dir), repoRoot: dir, log: quiet, gh: fakeGh(routes, { [`good.${KEY}.json`]: rec('good', KEY) }), keyFor: keyMatch(KEY) });
  assert(r.seeded === 0 && r.reason === 'no-green-run', JSON.stringify(r));
  assert(readdirSync(dir).length === 0, 'directory stays empty');
});

test('RED: a GitHub API error -> nothing seeded, no throw', () => {
  const dir = tmp();
  const routes = { ...greenRoutes(), 'pulls/3136': new Error('HTTP 502') };
  const r = seedVerdicts({ env: envFor(dir), repoRoot: dir, log: quiet, gh: fakeGh(routes), keyFor: keyMatch(KEY) });
  assert(r.seeded === 0 && r.reason === 'error', JSON.stringify(r));
  assert(readdirSync(dir).length === 0, 'directory stays empty');
});

test('RED: an artifact download error -> nothing seeded, no throw', () => {
  const dir = tmp();
  const base = fakeGh(greenRoutes());
  const gh = (args) => { if (args[0] === 'run') throw new Error('artifact expired'); return base(args); };
  const r = seedVerdicts({ env: envFor(dir), repoRoot: dir, log: quiet, gh, keyFor: keyMatch(KEY) });
  assert(r.seeded === 0 && r.reason === 'error', JSON.stringify(r));
});

test('RED: every record has a key mismatch -> nothing seeded', () => {
  const dir = tmp();
  const r = seedVerdicts({ env: envFor(dir), repoRoot: dir, log: quiet, gh: fakeGh(greenRoutes(), { [`good.${KEY}.json`]: rec('good', KEY) }), keyFor: () => 'z'.repeat(64) });
  assert(r.seeded === 0 && r.rejected === 1, JSON.stringify(r));
  assert(readdirSync(dir).length === 0, 'directory stays empty');
});

test('RED: not a queue ref, missing env, or a bad head SHA -> nothing seeded', () => {
  const dir = tmp();
  assert(seedVerdicts({ env: { ...envFor(dir), QUEUE_REF: 'refs/pull/1/merge' }, repoRoot: dir, log: quiet, gh: fakeGh(greenRoutes()) }).seeded === 0, 'pull ref');
  assert(seedVerdicts({ env: { REPO: 'o/r', QUEUE_REF: QUEUE }, repoRoot: dir, log: quiet, gh: fakeGh(greenRoutes()) }).seeded === 0, 'no dir');
  assert(seedVerdicts({ env: envFor(dir), repoRoot: dir, log: quiet, gh: fakeGh({ ...greenRoutes(), 'pulls/3136': 'garbage' }) }).seeded === 0, 'bad sha');
});

test('findGreenRun skips a newer red run and returns the older all-green run', () => {
  const routes = {
    'workflows/scripts-verify.yml/runs': JSON.stringify({ workflow_runs: [{ id: 1, created_at: '2026-11-23T09:00:00Z' }, { id: 2, created_at: '2026-11-23T11:00:00Z' }] }),
    'actions/runs/2/jobs': JSON.stringify({ jobs: [{ name: 'Mutation tier leg — shard 0/6', conclusion: 'failure' }] }),
    'actions/runs/1/jobs': JSON.stringify({ jobs: [{ name: 'Mutation tier leg — shard 0/6', conclusion: 'success' }] }),
  };
  assert(findGreenRun({ gh: fakeGh(routes), repo: 'o/r', headSha: SHA }) === 1, 'older green run wins over newer red run');
});

test('copyMatchingRecords rejects a record whose filename disagrees with its own key', () => {
  const dl = tmp();
  const out = tmp();
  writeFileSync(join(dl, `good.${'q'.repeat(64)}.json`), rec('good', KEY));
  const r = copyMatchingRecords({ downloadDir: dl, verdictDir: out, repoRoot: dl, keyFor: keyMatch(KEY) });
  assert(r.copied === 0 && r.rejected === 1, JSON.stringify(r));
});

console.log(`\nmutation-verdict-from-pr selftests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
