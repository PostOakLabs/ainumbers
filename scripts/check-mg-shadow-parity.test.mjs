#!/usr/bin/env node
// check-mg-shadow-parity.test.mjs - RED/GREEN fixture proof for MERGE-GROUP-SHADOW-SQUASH-SIM-1.
//
// Part 1 drives the REAL scripts/mg-shadow-squash-tree.mjs in a temp git repo and feeds the squash
// commit's message to the REAL evaluateFreeze(): a REPROVE-AUTHORIZED line only in a merge commit is
// dropped by the squash (RED), the same line in a non-merge commit survives it (GREEN).
// Part 2 proves check-mg-shadow-parity.mjs can say RED: an unlisted merge_group-only step, a stale
// map entry and a missing replay step each fail; a listed one passes.

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSquashTree } from './mg-shadow-squash-tree.mjs';
import { evaluate } from './check-mg-shadow-parity.mjs';
import { evaluateFreeze, parseAuthorizations } from './check-proven-digest-freeze.mjs';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { sourceDigest } = await import(pathToFileURL(resolve(HERE, '..', 'chaingraph', 'kernels', '_buildid.mjs')).href);

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ' ' + detail}`);
  if (!cond) failed++;
};

// ── Part 1: squash-faithful tree ─────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'mg-shadow-'));
const repo = join(tmp, 'repo');
const g = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const AUDIT = 'research/fixture-audit.md';
const LINE = `REPROVE-AUTHORIZED: art-9001 ${AUDIT}#F-3`;

// Build: main M0; PR branch with one real commit, a side branch merged in with a merge message.
function prBranch(name, { citeIn }) {
  g(repo, 'checkout', '-q', '-B', name, 'origin/main');
  writeFileSync(join(repo, `${name}.txt`), 'work\n');
  g(repo, 'add', `${name}.txt`);
  g(repo, 'commit', '-q', '-m', citeIn === 'commit' ? `Edit kernel\n\n${LINE}` : 'Edit kernel');
  g(repo, 'checkout', '-q', '-B', `${name}-side`, 'origin/main');
  writeFileSync(join(repo, `${name}-side.txt`), 'side\n');
  g(repo, 'add', `${name}-side.txt`);
  g(repo, 'commit', '-q', '-m', 'Side work');
  g(repo, 'checkout', '-q', name);
  g(repo, 'merge', '-q', '--no-ff', `${name}-side`, '-m', citeIn === 'merge' ? `Merge side\n\n${LINE}` : 'Merge side');
  return g(repo, 'rev-parse', 'HEAD');
}

try {
  g(tmp, 'init', '-q', '-b', 'main', repo);
  writeFileSync(join(repo, 'README.md'), 'base\n');
  g(repo, 'add', 'README.md');
  g(repo, 'commit', '-q', '-m', 'base');
  g(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  const KERNEL_V1 = "export function compute(x) { return { y: x * 2 }; }\n";
  const KERNEL_V2 = "export function compute(x) { return { y: x * 3 }; }\n";
  const shard = async (src) => ({ tool_id: 'art-9001-fixture-node', status: 'live', gpu: false, compute_proof: { journal: { kernel_digest: await sourceDigest(src) } } });
  // evaluateFreeze takes sync shard getters; resolve the async fixtures first.
  const b = await shard(KERNEL_V1), h = await shard(KERNEL_V2);
  const refusedFor = async (message) => (await evaluateFreeze({
    ids: ['art-9001-fixture-node'],
    baseShard: () => b, headShard: () => h, baseSrc: () => KERNEL_V1, headSrc: () => KERNEL_V2,
    authorizations: parseAuthorizations(message), citedFileExists: () => true,
    sourceDigestFn: sourceDigest, computeStalenessFn: computeStaleness,
  })).refused.length > 0;

  const mergeOnly = prBranch('pr-merge-only', { citeIn: 'merge' });
  const squashA = buildSquashTree({ repo, head: mergeOnly, title: 'PR title A', out: join(tmp, 'sqA') });
  check('squash builds (merge-only fixture)', squashA.ok, squashA.error);
  check('merge-commit-only citation is absent from the squash message', squashA.ok && !squashA.message.includes('REPROVE-AUTHORIZED'), squashA.message);
  check('subject is the PR title', squashA.ok && squashA.message.startsWith('PR title A\n'));
  check('squash-sim freeze is RED when the line lives only in a merge commit', squashA.ok && await refusedFor(squashA.message));
  check('the PR-side merge ref text WOULD have passed (why the shadow was blind)', await refusedFor(g(repo, 'log', '--format=%B', 'origin/main..pr-merge-only')) === false);

  const inCommit = prBranch('pr-commit', { citeIn: 'commit' });
  const squashB = buildSquashTree({ repo, head: inCommit, title: 'PR title B', out: join(tmp, 'sqB') });
  check('squash builds (non-merge fixture)', squashB.ok, squashB.error);
  check('non-merge commit citation survives the squash message', squashB.ok && squashB.message.includes(LINE), squashB.message);
  check('squash-sim freeze is GREEN when the line is in a non-merge commit', squashB.ok && !(await refusedFor(squashB.message)));
  check('squash tree is a single commit on origin/main', squashB.ok && g(squashB.dir, 'rev-list', '--count', 'origin/main..HEAD') === '1');
  check('squash tree carries both the PR and side work', squashB.ok && g(squashB.dir, 'ls-files').includes('pr-commit-side.txt') && g(squashB.dir, 'ls-files').includes('pr-commit.txt'));
} finally {
  spawnSync('git', ['worktree', 'prune'], { cwd: join(tmp, 'repo') });
  rmSync(tmp, { recursive: true, force: true });
}

// ── Part 2: parity gate ──────────────────────────────────────────────────────
const wf = (extraStep = '') => ({
  'land-verify.yml': [
    'jobs:',
    '  land:',
    '    steps:',
    '      - name: Queue thing',
    "        if: github.event_name == 'merge_group'",
    '        run: echo hi',
    extraStep,
  ].join('\n'),
  'scripts-verify.yml': [
    'jobs:',
    '  merge-group-shadow:',
    '    steps:',
    '      - name: Shadow replay',
    '        run: echo hi',
  ].join('\n'),
});
const NEW_STEP = ['      - name: Brand new queue gate', "        if: github.event_name == 'merge_group'", '        run: echo new'].join('\n');

const mapped = new Map([['land-verify.yml::Queue thing', 'Shadow replay']]);
check('parity GREEN: queue-only step is replayed', evaluate(wf(), mapped, new Map()).problems.length === 0);
check('parity GREEN: queue-only step is exempt with a reason', evaluate(wf(), new Map(), new Map([['land-verify.yml::Queue thing', 'measured reason']])).problems.length === 0);
check('parity RED: an unlisted merge_group-only step', evaluate(wf(NEW_STEP), mapped, new Map()).problems.some((p) => p.includes('Brand new queue gate')));
check('parity RED: the mapped shadow step does not exist', evaluate(wf(), new Map([['land-verify.yml::Queue thing', 'Nonexistent']]), new Map()).problems.some((p) => p.includes('does not exist')));
check('parity RED: stale map entry', evaluate(wf(), new Map([...mapped, ['land-verify.yml::Gone', 'Shadow replay']]), new Map()).problems.some((p) => p.includes('stale entry')));
check('parity ignores a step whose if: has no merge_group', evaluate({ ...wf(), 'land-verify.yml': wf()['land-verify.yml'] + "\n      - name: PR only\n        if: github.event_name == 'pull_request'\n        run: echo p" }, mapped, new Map()).problems.length === 0);

console.log(failed ? `\n${failed} case(s) FAILED` : '\nall cases passed');
process.exit(failed ? 1 : 0);
