#!/usr/bin/env node
// check-proven-digest-freeze.test.mjs - RED/GREEN fixture proof for check-proven-digest-freeze.mjs.
//
// Drives the gate's real evaluateFreeze() with the REAL canonical sourceDigest() from _buildid.mjs and
// the REAL computeStaleness() from check-s18-digest-freshness.mjs. Nothing here is a stand-in for either;
// only the trees are fixtures. Each case states the verdict it must reach; a case reaching the other
// verdict fails the test, so the gate is proven able to say both RED and GREEN.

import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateFreeze, parseAuthorizations, nodeNumber, isProven } from './check-proven-digest-freeze.mjs';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { sourceDigest } = await import(pathToFileURL(resolve(HERE, '..', 'chaingraph', 'kernels', '_buildid.mjs')).href);

const ID = 'art-9001-fixture-node';
const KERNEL_V1 = "import { executionHash } from './_hash.mjs';\nexport function compute(x) { return { y: x * 2 }; }\n";
const KERNEL_V2 = "import { executionHash } from './_hash.mjs';\nexport function compute(x) { return { y: x * 3 }; }\n";
const AUDIT = 'research/fixture-audit.md';

const shard = async (src, extra = {}) => ({
  tool_id: ID,
  status: 'live',
  gpu: false,
  description: 'Original description.',
  compute_proof: { journal: { kernel_digest: await sourceDigest(src) } },
  ...extra,
});

async function run(name, { base, head, baseSrc, headSrc, cite = '', fileExists = () => true }, expectRefused) {
  const { refused } = await evaluateFreeze({
    ids: [ID],
    baseShard: () => base,
    headShard: () => head,
    baseSrc: () => baseSrc,
    headSrc: () => headSrc,
    authorizations: parseAuthorizations(cite),
    citedFileExists: fileExists,
    sourceDigestFn: sourceDigest,
    computeStalenessFn: computeStaleness,
  });
  const got = refused.length > 0;
  const ok = got === expectRefused;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${got ? 'RED' : 'GREEN'} (expected ${expectRefused ? 'RED' : 'GREEN'})${refused.length ? ' - ' + refused[0].reason : ''}`);
  return ok;
}

const base = await shard(KERNEL_V1);
const results = [];

// GREEN: copy-only change. Shard description edited, kernel bytes identical.
results.push(await run('copy-only change passes', {
  base, head: { ...base, description: 'Reworded description.' }, baseSrc: KERNEL_V1, headSrc: KERNEL_V1,
}, false));

// GREEN: CRLF-only change. sourceDigest normalizes line endings, so the digest does not move.
results.push(await run('line-ending-only change passes', {
  base, head: base, baseSrc: KERNEL_V1, headSrc: KERNEL_V1.replace(/\n/g, '\r\n'),
}, false));

// RED: kernel edited, no citation, receipt left stale.
results.push(await run('kernel edit with no citation fails', {
  base, head: base, baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
}, true));

// RED: kernel edited with a fresh receipt but no citation.
results.push(await run('fresh receipt but no citation fails', {
  base, head: await shard(KERNEL_V2), baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
}, true));

// RED: citation present, receipt still attests the old kernel.
results.push(await run('citation but no fresh receipt fails', {
  base, head: base, baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
  cite: `REPROVE-AUTHORIZED: art-9001 ${AUDIT}#F-3`,
}, true));

// RED: citation names an audit file that does not exist.
results.push(await run('citation to a missing audit file fails', {
  base, head: await shard(KERNEL_V2), baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
  cite: `REPROVE-AUTHORIZED: art-9001 ${AUDIT}#F-3`, fileExists: () => false,
}, true));

// RED: citation for a different node does not authorize this one.
results.push(await run('citation for another node fails', {
  base, head: await shard(KERNEL_V2), baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
  cite: `REPROVE-AUTHORIZED: art-900 ${AUDIT}#F-3`,
}, true));

// GREEN: citation present and the receipt was re-proved against the edited kernel.
results.push(await run('citation plus fresh receipt passes', {
  base, head: await shard(KERNEL_V2), baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
  cite: `Fix rounding.\n\nREPROVE-AUTHORIZED: art-9001 ${AUDIT}#F-3\n`,
}, false));

// RED: proven node whose head shard reads "deferred", even with kernel untouched.
results.push(await run('flip to deferred fails', {
  base, head: { ...base, compute_proof_ready: 'deferred' }, baseSrc: KERNEL_V1, headSrc: KERNEL_V1,
}, true));

// RED: compute_proof_ready "ready" on a gpu:true node is frozen too.
const gpuBase = await shard(KERNEL_V1, { compute_proof_ready: 'ready', gpu: true });
results.push(await run('gpu:true ready node edit fails', {
  base: gpuBase, head: gpuBase, baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
}, true));

// GREEN: a deferred node is never frozen (its first prove is allowed).
const deferred = { tool_id: ID, status: 'live', gpu: false, compute_proof_ready: 'deferred' };
results.push(await run('deferred node edit passes', {
  base: deferred, head: deferred, baseSrc: KERNEL_V1, headSrc: KERNEL_V2,
}, false));

// Helper controls.
const helperOk = [
  nodeNumber('art-191-conversion-receipt-builder') === '191',
  nodeNumber('504-settlement-risk-capital-optimizer') === '504',
  nodeNumber('art-05-ai-act') === '5',
  isProven({ compute_proof_ready: 'ready' }) && !isProven({ compute_proof_ready: 'deferred', compute_proof: { journal: { kernel_digest: 'x' } } }),
  parseAuthorizations('REPROVE-AUTHORIZED: art-012 a/b.md#F-1 and REPROVE-AUTHORIZED: art-7 c.md#x').length === 2,
].every(Boolean);
console.log(`${helperOk ? '✓' : '✗'} helper controls (node number, proven scope, citation parse)`);
results.push(helperOk);

const failed = results.filter((r) => !r).length;
if (failed) {
  console.error(`✗ proven-digest freeze fixture proof: ${failed} of ${results.length} case(s) wrong`);
  process.exit(1);
}
console.log(`✓ proven-digest freeze fixture proof: ${results.length}/${results.length} cases reached their expected verdict`);
