#!/usr/bin/env node
// check-sealed-kernel-receipt.test.mjs — controls for SEALED-KERNEL-RECEIPT-PUSH-GATE-1
// (SO #40b pairing: a gate that has only ever been observed green has not been observed at all).
//
// Drives evaluate() with REAL kernel sources, REAL node shards and REAL Groth16 receipts from the
// tree, plus the canonical sourceDigest() and verifySeal() — no stand-in digest or verifier, so a
// green here means the production instruments agree. Two sealed+fresh nodes are picked from the
// estate (digest match first, then seal verification), so a reprove campaign cannot strand a
// hardcoded pick.
// Cases:
//   1. RED    — sealed kernel changed, receipt untouched (the PR #2175 shape at d8241c01).
//   2. GREEN  — sealed kernel changed, head carries a receipt that binds AND verifies over the new bytes.
//   3. RED    — receipt's journal.kernel_digest rewritten by hand to the new digest, old seal kept.
//   4. GREEN  — unsealed (compute_proof_ready "deferred", no receipt) kernel changed.
//   5. GREEN  — receipt at base is already stale (binds an earlier revision): not sealed, ratchet's job.
//   6. RED    — sealed kernel file deleted while its node is still live.
//   7. GREEN  — sealed kernel deleted together with its node (retired).
//   8. RED    — head node lost its compute_proof entirely.

import { evaluate } from './check-sealed-kernel-receipt.mjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { sourceDigest } = await import(pathToFileURL(resolve(ROOT, 'chaingraph/kernels/_buildid.mjs')).href);
const { verifySeal } = await import(pathToFileURL(resolve(ROOT, 'chaingraph/kernels/_computeproof.mjs')).href);
const deps = { sourceDigest, verifySeal };

let failures = 0;
function assert(cond, name) {
  if (cond) console.log('  PASS ' + name);
  else { console.error('  FAIL ' + name); failures++; }
}

// pick two sealed+fresh nodes with a locally verifiable groth16 receipt
const NODES = resolve(ROOT, 'chaingraph/graph/nodes');
const picks = [];
for (const f of readdirSync(NODES).filter((x) => x.endsWith('.json')).sort()) {
  if (picks.length === 2) break;
  const node = JSON.parse(readFileSync(resolve(NODES, f), 'utf8'));
  const cp = node.compute_proof;
  if (node.status !== 'live' || cp?.receiptFormat !== 'groth16-bn254') continue;
  const kp = resolve(ROOT, 'chaingraph/kernels', `${node.tool_id}.kernel.mjs`);
  if (!existsSync(kp)) continue;
  const src = readFileSync(kp, 'utf8');
  if (cp.journal?.kernel_digest !== await sourceDigest(src)) continue;
  if (verifySeal(cp) !== true) continue;
  picks.push({ node, src, path: `chaingraph/kernels/${node.tool_id}.kernel.mjs` });
}
if (picks.length < 2) {
  console.error(`  FAIL setup: need 2 sealed+fresh verifiable nodes, found ${picks.length}`);
  process.exit(1);
}
const [X, Y] = picks;
console.log(`fixtures: X=${X.node.tool_id}  Y=${Y.node.tool_id}`);
const mutate = (s) => s + '\n// SEALED-KERNEL-RECEIPT-PUSH-GATE-1 test mutation\n';
const one = async (c) => (await evaluate([{ path: X.path, tool_id: X.node.tool_id, ...c }], deps))[0];

console.log('case 1: sealed kernel changed, receipt untouched');
let r = await one({ oldSrc: X.src, newSrc: mutate(X.src), baseNode: X.node, headNode: X.node });
assert(r.verdict === 'red' && /not the new bytes/.test(r.why), 'RED: names the stale binding');

console.log('case 2: sealed kernel changed with a fresh verifying receipt');
r = await one({ oldSrc: X.src, newSrc: Y.src, baseNode: X.node, headNode: Y.node });
assert(r.verdict === 'fresh', 'GREEN: fresh receipt binds + verifies over new bytes');

console.log('case 3: hand-rewritten journal.kernel_digest, old seal');
const newSrc = mutate(X.src);
const forged = structuredClone(X.node);
forged.compute_proof.journal.kernel_digest = await sourceDigest(newSrc);
r = await one({ oldSrc: X.src, newSrc, baseNode: X.node, headNode: forged });
assert(r.verdict === 'red' && /does NOT verify/.test(r.why), 'RED: seal rejects the edited journal');

console.log('case 4: deferred (unproven) kernel changed');
const deferred = { ...structuredClone(X.node), compute_proof_ready: 'deferred' };
delete deferred.compute_proof;
r = await one({ oldSrc: X.src, newSrc: mutate(X.src), baseNode: deferred, headNode: deferred });
assert(r.verdict === 'unsealed', 'GREEN: no receipt at base = not sealed');

console.log('case 5: base receipt already stale');
r = await one({ oldSrc: mutate(X.src), newSrc: mutate(mutate(X.src)), baseNode: X.node, headNode: X.node });
assert(r.verdict === 'unsealed' && /earlier revision/.test(r.why), 'GREEN: stale-at-base is the ratchet\'s, not this gate\'s');

console.log('case 6: sealed kernel deleted, node still live');
r = await one({ oldSrc: X.src, newSrc: null, baseNode: X.node, headNode: X.node });
assert(r.verdict === 'red', 'RED: live node lost its sealed kernel');

console.log('case 7: sealed kernel deleted with its node');
r = await one({ oldSrc: X.src, newSrc: null, baseNode: X.node, headNode: null });
assert(r.verdict === 'retired', 'GREEN: retired together');

console.log('case 8: head node has no compute_proof');
const stripped = structuredClone(X.node);
delete stripped.compute_proof;
r = await one({ oldSrc: X.src, newSrc: mutate(X.src), baseNode: X.node, headNode: stripped });
assert(r.verdict === 'red' && /no compute_proof/.test(r.why), 'RED: receipt removed');

if (failures) { console.error(`\n✗ check-sealed-kernel-receipt controls: ${failures} failure(s)`); process.exit(1); }
console.log('\n✓ check-sealed-kernel-receipt controls: 8/8 cases behave (red on the #2175 shape, green on a fresh verifying receipt)');
