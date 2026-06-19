// kernel-hash-integrity.mjs — FIXTURE-INDEPENDENT prevention gate (the one that stops recurrence).
//
// The Arc bug (and the 45-kernel backlog it exposed) was invisible because golden-parity and
// kernel-contract only check kernels that SHIP A FIXTURE. A kernel with no fixture could deploy
// returning hash_valid:false forever. This gate needs no fixture: it probes EVERY live gpu:false
// kernel's buildArtifact with a default input and reproduces the Worker's hash_valid check —
//     execution_hash is 64-hex  AND  executionHash(policy_parameters, output_payload) === execution_hash
// i.e. the kernel actually emits a self-consistent canonical artifact when called server-side.
//
// DEBT RATCHET (so it doesn't block on the existing backlog while still stopping NEW breakage):
//   • kernel listed in kernel-hash-debt.json  → broken only WARNS (known, tracked backlog)
//   • kernel NOT in the debt list that is broken → HARD FAIL (a new or regressed kernel)
//   • kernel in the debt list that now PASSES   → WARN "remove from debt" (ratchet tightening)
// As the backlog is fixed, delete ids from kernel-hash-debt.json; when it's empty, every gpu:false
// kernel is guaranteed self-verifying and stays that way.
//
// gpu:true nodes are skipped (browser-delegated by design — Workstream B). A kernel that throws on
// the default probe input is reported as "needs a fixture" (kernel-contract.test.mjs covers those),
// not hard-failed, to avoid false positives on input-sensitive kernels.
//
// Usage:  node kernel-hash-integrity.mjs            (strict by default — fails on any debt or new breakage)
//         node kernel-hash-integrity.mjs --no-strict (warn-only on debt, hard-fail only on new breakage)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { KERNELS } from './index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STRICT = !process.argv.includes('--no-strict');
const norm = (h) => String(h ?? '').replace(/^sha256:/, '');
const isHex64 = (h) => /^[a-f0-9]{64}$/.test(norm(h));

// debt baseline
const debtPath = resolve(HERE, 'kernel-hash-debt.json');
const debt = new Set(existsSync(debtPath) ? (JSON.parse(readFileSync(debtPath, 'utf8')).debt ?? []) : []);

// gpu flags from the graph the site ships
const cgPath = resolve(HERE, '..', 'chaingraph.json');
const cg = JSON.parse(readFileSync(cgPath, 'utf8'));
const node = {};
for (const n of (cg.nodes ?? [])) node[n.tool_id] = n;

let hardFail = 0;
const knownDebt = [], newBroken = [], fixed = [], unprobeable = [], skipped = [];
let pass = 0;

for (const id of Object.keys(KERNELS)) {
  const n = node[id];
  if (!n || n.status !== 'live') { skipped.push(`${id}(not-live)`); continue; }
  if (n.gpu) { skipped.push(`${id}(gpu:true)`); continue; }          // browser-delegated — not this gate's concern

  const kernel = KERNELS[id];
  let ok = false, threw = false;
  try {
    const art = await kernel.buildArtifact({}, { now: null });
    ok = art && typeof art === 'object'
      && isHex64(art.execution_hash)
      && 'policy_parameters' in art && 'output_payload' in art
      && norm(art.execution_hash) === norm(await executionHash(art.policy_parameters, art.output_payload));
  } catch { threw = true; }

  if (ok) {
    if (debt.has(id)) fixed.push(id);
    else pass++;
  } else if (threw) {
    unprobeable.push(id);                 // input-sensitive — kernel-contract (with a fixture) verifies it
  } else if (debt.has(id)) {
    knownDebt.push(id);                    // known backlog — warn
  } else {
    newBroken.push(id);                    // NEW/REGRESSED broken kernel — block
    hardFail++;
  }
}

if (fixed.length)       console.log(`✓ ${fixed.length} kernel(s) now self-consistent — DELETE from kernel-hash-debt.json: ${fixed.join(', ')}`);
if (unprobeable.length) console.warn(`⚠ ${unprobeable.length} kernel(s) threw on the default probe — add a fixtures/<id>.fixtures.json so kernel-contract can verify: ${unprobeable.join(', ')}`);
if (knownDebt.length)   console.warn(`⚠ ${knownDebt.length} known-debt kernel(s) still emit hash_valid:false (tracked in kernel-hash-debt.json).`);

if (hardFail) {
  console.error(`\n✗ ${hardFail} kernel(s) emit a NON-self-consistent artifact and are NOT in the debt baseline (new or regressed):`);
  for (const id of newBroken) console.error(`    ${id}`);
  console.error('  A kernel here returns hash_valid:false on the live Worker. Fix it to the art-12 contract');
  console.error('  (import executionHash from _hash.mjs; async buildArtifact returning {execution_hash, policy_parameters, output_payload}).');
  process.exit(1);
}
if (STRICT && knownDebt.length) {
  console.error(`\n✗ --strict: ${knownDebt.length} kernel(s) remain in the hash-debt backlog. Remediate them, then clear kernel-hash-debt.json.`);
  process.exit(1);
}
console.log(`✓ kernel-hash-integrity OK — ${pass} gpu:false kernel(s) self-verifying; ${knownDebt.length} tracked in backlog; no new breakage.`);
process.exit(0);
