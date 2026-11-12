// stamp-writers.test.mjs - selftest for scripts/stamp-writers.mjs (STALE-STAMP-WRITERS-1).
// Builds a throwaway checkout layout in a temp dir: the REAL _buildid.mjs (so digests are the real
// sourceDigest()), a stub gen-kernel-identity.mjs that stamps the shard through that same helper, one
// kernel, its shard and its proptest floor. Orchestration is under test; the real writers have their own
// gates. Cases: RED (kernel edited, shard stale -> --check exit 1 naming the shard), GREEN (--write then
// --check exit 0, second --write is a byte-for-byte no-op), proptest-fail (nothing stamped, exit 1).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SCRIPT = resolve(HERE, 'stamp-writers.mjs');
const ID = 'art-selftest-kernel';

const STUB_IDENTITY = `
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from './_buildid.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const id = process.argv.find((a) => a.startsWith('--shard=')).slice(8);
const d = await sourceDigest(readFileSync(resolve(here, id + '.kernel.mjs'), 'utf8'));
const p = resolve(here, '..', 'graph', 'nodes', id + '.json');
const s = JSON.parse(readFileSync(p, 'utf8'));
s.compute_images = [{ system: 'sha256-source', image_id: d }];
const out = JSON.stringify(s, null, 2) + '\\n';
if (out !== readFileSync(p, 'utf8')) writeFileSync(p, out);
`;

function put(root, rel, text) {
  const p = resolve(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

function fixture({ proptestPasses }) {
  const root = mkdtempSync(resolve(tmpdir(), 'stamp-writers-'));
  mkdirSync(resolve(root, 'chaingraph', 'kernels'), { recursive: true });
  copyFileSync(resolve(REPO, 'chaingraph', 'kernels', '_buildid.mjs'), resolve(root, 'chaingraph', 'kernels', '_buildid.mjs'));
  put(root, 'chaingraph/kernels/gen-kernel-identity.mjs', STUB_IDENTITY);
  put(root, `chaingraph/kernels/${ID}.kernel.mjs`, 'export const v = 1;\n');
  put(root, `chaingraph/graph/nodes/${ID}.json`, JSON.stringify({ tool_id: ID, status: 'live', gpu: false, compute_images: [] }, null, 2) + '\n');
  const z = 'sha256:' + '0'.repeat(64);
  put(root, `chaingraph/kernels/__proptests__/${ID}.proptest.mjs`,
    `// ${ID} floor.\n// kernel_digest_at_authoring: ${z}\nprocess.exit(${proptestPasses ? 0 : 1});\n`);
  return root;
}

const run = (root, ...a) => spawnSync(process.execPath, [SCRIPT, '--root', root, '--ids', ID, ...a], { encoding: 'utf8' });
const read = (root, rel) => readFileSync(resolve(root, rel), 'utf8');
const SHARD = `chaingraph/graph/nodes/${ID}.json`;
const PROP = `chaingraph/kernels/__proptests__/${ID}.proptest.mjs`;
const cleanup = [];

try {
  // RED: kernel edited, nothing stamped -> exit 1, names the shard and the proptest, with fix commands.
  const a = fixture({ proptestPasses: true }); cleanup.push(a);
  const red = run(a, '--check');
  assert.equal(red.status, 1, 'RED: --check must exit 1 on stale stamps');
  assert.match(red.stderr, /identity shard graph\/nodes\/art-selftest-kernel\.json/, 'RED: names the stale shard');
  assert.match(red.stderr, /gen-kernel-identity\.mjs --write --shard=art-selftest-kernel/, 'RED: gives the shard fix command');
  assert.match(red.stderr, /proptest art-selftest-kernel\.proptest\.mjs/, 'RED: names the stale proptest header');
  console.log('RED ok: stale shard + proptest named, exit 1');

  // GREEN: --write stamps both, --check passes, second --write changes no byte.
  const w1 = run(a, '--write');
  assert.equal(w1.status, 0, 'GREEN: --write exit 0: ' + w1.stderr);
  assert.equal(run(a, '--check').status, 0, 'GREEN: --check exit 0 after --write');
  const snap = [read(a, SHARD), read(a, PROP)];
  const w2 = run(a, '--write');
  assert.equal(w2.status, 0, 'second --write exit 0');
  assert.deepEqual([read(a, SHARD), read(a, PROP)], snap, 'second --write is a byte-for-byte no-op');
  assert.match(w2.stdout, /proptest current/, 'second --write reports the proptest as current');
  console.log('GREEN ok: --write then --check exit 0; second --write is a no-op');

  // Editing the kernel makes the stamps stale again; --check sees it.
  put(a, `chaingraph/kernels/${ID}.kernel.mjs`, 'export const v = 2;\n');
  assert.equal(run(a, '--check').status, 1, 'a later kernel edit reds --check again');
  console.log('RED-again ok: a second kernel edit is detected');

  // proptest-fail: the floor does not pass -> header is NOT stamped, exit 1.
  const b = fixture({ proptestPasses: false }); cleanup.push(b);
  const before = read(b, PROP);
  const wf = run(b, '--write');
  assert.equal(wf.status, 1, 'proptest-fail: --write exits 1');
  assert.equal(read(b, PROP), before, 'proptest-fail: header left unstamped');
  assert.match(wf.stdout, /proptest not stamped/, 'proptest-fail: says why');
  console.log('proptest-fail ok: failing floor is never stamped');

  console.log('stamp-writers selftest: all cases passed');
} finally {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
}
