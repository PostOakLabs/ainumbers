// stamp-writers.mjs - one PR-owned orchestrator that restamps every sibling stamp a kernel edit
// invalidates (STALE-STAMP-WRITERS-1; spec cite KERNELID-GATE-1, FV-FLOOR-DIGEST-GATE-1,
// BUILD-RIGHT-FIRST-1, CONTRACT A4; source research/STALE-STAMP-PREVENTION-2026-11-07.md layer A).
//
// WHY: on #2891 the builder restamped the proptest kernel_digest_at_authoring but missed the section 17
// identity shard, because nothing says which stamps a kernel edit invalidates. This script derives the
// touched kernel ids from the diff and runs, per id, in order:
//   1. identity shard   node chaingraph/kernels/gen-kernel-identity.mjs --write --shard=<id>
//   2. proptest digest  run the floor file; only on pass, rewrite its kernel_digest_at_authoring header
//                       (value = sourceDigest() from chaingraph/kernels/_buildid.mjs, never hand-built)
//   3. ask-agent block  node scripts/check-ask-agent-block.mjs --write --only <id>   (page + manifest exist)
// check-a11y-tree.mjs --write is whole-tree (repaints siblings), so it is not run here.
//
// This script never computes a hash itself: digests come from sourceDigest() and the repo writers only.
//
// USAGE:
//   node scripts/stamp-writers.mjs --write [--base origin/main] [--ids a,b]
//   node scripts/stamp-writers.mjs --check [--base origin/main] [--ids a,b]
//     --check writes nothing: it exits 1 listing each stale stamp with its fix command.
//   --root <dir> points at another checkout layout (selftest); default is this repo.
//   --ids bypasses git diff derivation.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i !== -1 ? argv[i + 1] : null; };
const ROOT = resolve(arg('--root') || resolve(HERE, '..'));
const BASE = arg('--base') || 'origin/main';
const IDS_ARG = arg('--ids');

const HEADER_RE = /^(\/\/\s*kernel_digest_at_authoring:\s*)(sha256:[0-9a-f]{64})\s*$/im;
const KERNEL_RE = /^chaingraph\/kernels\/([^/]+)\.kernel\.mjs$/;
const SIBLING_RES = [
  /^chaingraph\/kernels\/__proptests__\/([^/]+)\.proptest\.mjs$/,
  /^chaingraph\/kernels\/fixtures\/([^/]+)\.fixtures\.json$/,
  /^manifests\/([^/]+)\.manifest\.json$/,
  /^chaingraph\/([^/]+)\.html$/,
];

function git(args) {
  const r = spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', env: gitEnv() });
  return r.status === 0 ? r.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

// Touched kernel ids: a kernel file in the diff, or a sibling artifact whose kernel exists on disk.
export function deriveTouchedIds(root, base) {
  const rel = new Set([
    ...git(['diff', '--name-only', `${base}...HEAD`]),
    ...git(['diff', '--name-only']),
    ...git(['diff', '--name-only', '--cached']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ]);
  const ids = new Set();
  for (const f of rel) {
    const k = f.match(KERNEL_RE);
    if (k) { ids.add(k[1]); continue; }
    for (const re of SIBLING_RES) {
      const m = f.match(re);
      if (m && existsSync(resolve(root, 'chaingraph', 'kernels', `${m[1]}.kernel.mjs`))) ids.add(m[1]);
    }
  }
  return [...ids].sort();
}

async function loadSourceDigest(root) {
  const mod = await import(pathToFileURL(resolve(root, 'chaingraph', 'kernels', '_buildid.mjs')).href);
  return mod.sourceDigest;
}

const normD = (d) => (typeof d === 'string' && d.startsWith('sha256:')) ? d : 'sha256:' + d;
const proptestPath = (root, id) => resolve(root, 'chaingraph', 'kernels', '__proptests__', `${id}.proptest.mjs`);
const shardPath = (root, id) => resolve(root, 'chaingraph', 'graph', 'nodes', `${id}.json`);
const hasAskAgentInputs = (root, id) =>
  existsSync(resolve(root, 'manifests', `${id}.manifest.json`)) && existsSync(resolve(root, 'chaingraph', `${id}.html`));

function runNode(root, args) {
  return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
}

// Current state of each stamp for one id, read-only. Returns [{ stamp, fix }] for every stale one.
export async function findStale(root, id, sourceDigest) {
  const stale = [];
  const kernelSrc = readFileSync(resolve(root, 'chaingraph', 'kernels', `${id}.kernel.mjs`), 'utf8');
  const want = await sourceDigest(kernelSrc);

  const sp = shardPath(root, id);
  if (existsSync(sp)) {
    let shard = null;
    try { shard = JSON.parse(readFileSync(sp, 'utf8')); } catch { /* reported stale below */ }
    const live = shard && shard.status === 'live' && shard.gpu === false;
    if (!shard || live) {
      const img = shard && (shard.compute_images ?? []).find((i) => i.system === 'sha256-source');
      if (!img || normD(img.image_id) !== want) {
        stale.push({ stamp: `identity shard graph/nodes/${id}.json sha256-source ${img ? img.image_id : '(missing)'} != ${want}`,
          fix: `node chaingraph/kernels/gen-kernel-identity.mjs --write --shard=${id}` });
      }
    }
  }

  const pp = proptestPath(root, id);
  if (existsSync(pp)) {
    const m = readFileSync(pp, 'utf8').match(HEADER_RE);
    if (!m || m[2] !== want) {
      stale.push({ stamp: `proptest ${id}.proptest.mjs kernel_digest_at_authoring ${m ? m[2] : '(missing)'} != ${want}`,
        fix: `node scripts/stamp-writers.mjs --write --ids ${id}` });
    }
  }

  if (hasAskAgentInputs(root, id)) {
    const page = resolve(root, 'chaingraph', `${id}.html`);
    const before = readFileSync(page, 'utf8');
    const r = runNode(root, ['scripts/check-ask-agent-block.mjs', '--write', '--only', id]);
    const after = readFileSync(page, 'utf8');
    if (after !== before) {
      writeFileSync(page, before); // --check must leave the tree untouched
      stale.push({ stamp: `ask-agent block in chaingraph/${id}.html is stale`,
        fix: `node scripts/check-ask-agent-block.mjs --write --only ${id}` });
    } else if (r.status !== 0) {
      stale.push({ stamp: `ask-agent writer failed for ${id}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`,
        fix: `node scripts/check-ask-agent-block.mjs --write --only ${id}` });
    }
  }
  return stale;
}

// Restamp one proptest header. Runs the floor first; stamps only on pass.
export async function restampProptest(root, id, sourceDigest) {
  const pp = proptestPath(root, id);
  if (!existsSync(pp)) return { state: 'absent' };
  const kernelSrc = readFileSync(resolve(root, 'chaingraph', 'kernels', `${id}.kernel.mjs`), 'utf8');
  const want = await sourceDigest(kernelSrc);
  const text = readFileSync(pp, 'utf8');
  const m = text.match(HEADER_RE);
  if (m && m[2] === want) return { state: 'current' };
  const r = runNode(root, [pp]);
  if (r.status !== 0) {
    return { state: 'failed', detail: `${id}.proptest.mjs exited ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}` };
  }
  let next;
  if (m) next = text.replace(HEADER_RE, `$1${want}`);
  else { const nl = text.indexOf('\n'); next = text.slice(0, nl + 1) + `// kernel_digest_at_authoring: ${want}\n` + text.slice(nl + 1); }
  writeFileSync(pp, next);
  return { state: 'stamped' };
}

export async function writeAll(root, ids, log = console.log) {
  const sourceDigest = await loadSourceDigest(root);
  let failed = 0;
  for (const id of ids) {
    if (!existsSync(resolve(root, 'chaingraph', 'kernels', `${id}.kernel.mjs`))) { log(`  SKIP ${id}: no kernel on disk`); continue; }
    if (existsSync(shardPath(root, id))) {
      const r = runNode(root, ['chaingraph/kernels/gen-kernel-identity.mjs', '--write', `--shard=${id}`]);
      if (r.status !== 0) { failed++; log(`  FAIL ${id}: identity shard writer exit ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`); continue; }
      log(`  ${id}: identity shard written`);
    }
    const p = await restampProptest(root, id, sourceDigest);
    if (p.state === 'failed') { failed++; log(`  FAIL ${id}: proptest not stamped - ${p.detail}`); continue; }
    log(`  ${id}: proptest ${p.state}`);
    if (hasAskAgentInputs(root, id)) {
      const r = runNode(root, ['scripts/check-ask-agent-block.mjs', '--write', '--only', id]);
      if (r.status !== 0) { failed++; log(`  FAIL ${id}: ask-agent writer exit ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`); continue; }
      log(`  ${id}: ask-agent block written`);
    }
  }
  return failed;
}

async function main() {
  const write = argv.includes('--write');
  const check = argv.includes('--check');
  if (write === check) { console.error('usage: stamp-writers.mjs --write | --check [--base origin/main] [--ids a,b] [--root dir]'); process.exit(2); }
  const ids = IDS_ARG ? IDS_ARG.split(',').filter(Boolean) : deriveTouchedIds(ROOT, BASE);
  if (!ids.length) { console.log('stamp-writers: no touched kernel ids - nothing to do.'); return; }
  console.log(`stamp-writers: ${ids.length} touched kernel id(s): ${ids.join(', ')}`);
  if (write) {
    const failed = await writeAll(ROOT, ids);
    if (failed) { console.error(`stamp-writers: ${failed} writer failure(s).`); process.exit(1); }
    console.log('stamp-writers: done.');
    return;
  }
  const sourceDigest = await loadSourceDigest(ROOT);
  let n = 0;
  for (const id of ids) {
    if (!existsSync(resolve(ROOT, 'chaingraph', 'kernels', `${id}.kernel.mjs`))) continue;
    for (const s of await findStale(ROOT, id, sourceDigest)) {
      n++;
      console.error(`  STALE ${id}: ${s.stamp}\n        fix: ${s.fix}`);
    }
  }
  if (n) { console.error(`stamp-writers --check: ${n} stale stamp(s). Fix: node scripts/stamp-writers.mjs --write`); process.exit(1); }
  console.log('stamp-writers --check: every sibling stamp is current.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
