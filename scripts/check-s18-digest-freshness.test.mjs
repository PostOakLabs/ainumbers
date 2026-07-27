#!/usr/bin/env node
// check-s18-digest-freshness.test.mjs — proven-to-reject fixture for S18-DIGEST-GATE-1.
//
// A digest-freshness gate never observed to catch a mismatch isn't known to catch one. This feeds
// computeStaleness() a fixture where a node's kernel source is tampered AFTER its receipt was
// written (exactly the c60eaad-class scenario the gate exists for), asserts it's flagged stale, then
// asserts an untouched node is flagged fresh. Uses the REAL canonical `sourceDigest()` from
// `_buildid.mjs` throughout — never a stand-in — so a pass here means the actual production digest
// path both matches good input and rejects tampered input.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);

const REAL_SOURCE = 'export function compute(p){ return { output: p.x + 1 }; }\n';
const TAMPERED_SOURCE = 'export function compute(p){ return { output: p.x + 999 }; }\n';

await test('flags a node as stale when its kernel source changed since the receipt was written', async () => {
  const receiptDigest = await sourceDigest(REAL_SOURCE); // digest committed at prove time
  const cg = {
    nodes: [{
      tool_id: 'art-999-tamper-fixture', mcp_name: 'tamper_fixture_node', status: 'live', gpu: false,
      audit_signature: { compute_proof: { journal: { kernel_digest: receiptDigest, output: 1 } } },
    }],
  };
  // kernel source on disk has since been edited (TAMPERED_SOURCE), never re-proven
  const { stale, fresh, total } = await computeStaleness(cg, { 'art-999-tamper-fixture': TAMPERED_SOURCE }, sourceDigest);
  assert(total === 1, `expected 1 in-scope node, got ${total}`);
  assert(stale.length === 1, 'expected the tampered node to be flagged stale');
  assert(fresh.length === 0, 'expected zero fresh nodes in this fixture');
  assert(stale[0].state === 'stale', `expected state "stale", got ${stale[0].state}`);
  assert(stale[0].journalDigest === receiptDigest, 'journalDigest should be the receipt value, unchanged');
  assert(stale[0].recomputed !== receiptDigest, 'recomputed digest must differ from the (unchanged) receipt digest');
});

await test('calibration: passes a node whose source has NOT changed since the receipt was written', async () => {
  const receiptDigest = await sourceDigest(REAL_SOURCE);
  const cg = {
    nodes: [{
      tool_id: 'art-998-calibration-fixture', mcp_name: 'calibration_fixture_node', status: 'live', gpu: false,
      audit_signature: { compute_proof: { journal: { kernel_digest: receiptDigest, output: 1 } } },
    }],
  };
  const { stale, fresh } = await computeStaleness(cg, { 'art-998-calibration-fixture': REAL_SOURCE }, sourceDigest);
  assert(fresh.length === 1, 'expected the untouched node to be flagged fresh');
  assert(stale.length === 0, 'expected zero stale nodes in this fixture');
});

await test('reports NO_KERNEL_FILE (never crashes) when the kernel file is missing from the lookup', async () => {
  const receiptDigest = await sourceDigest(REAL_SOURCE);
  const cg = {
    nodes: [{
      tool_id: 'art-997-missing-kernel', mcp_name: 'missing_kernel_node', status: 'live', gpu: false,
      audit_signature: { compute_proof: { journal: { kernel_digest: receiptDigest, output: 1 } } },
    }],
  };
  const { results } = await computeStaleness(cg, {}, sourceDigest);
  assert(results.length === 1 && results[0].state === 'NO_KERNEL_FILE', `expected NO_KERNEL_FILE, got ${JSON.stringify(results)}`);
});

await test('CRLF/CR line-ending normalization does not produce a false stale (canonicalization sanity)', async () => {
  const lf = 'export function compute(p){\n  return { output: p.x };\n}\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const receiptDigest = await sourceDigest(lf);
  const cg = {
    nodes: [{
      tool_id: 'art-996-crlf-fixture', mcp_name: 'crlf_fixture_node', status: 'live', gpu: false,
      audit_signature: { compute_proof: { journal: { kernel_digest: receiptDigest, output: 1 } } },
    }],
  };
  const { stale, fresh } = await computeStaleness(cg, { 'art-996-crlf-fixture': crlf }, sourceDigest);
  assert(fresh.length === 1 && stale.length === 0, 'CRLF-vs-LF of identical logical source must NOT read as stale');
});

await test('reproduces the confirmed 132/462 stale count against the real committed chaingraph.json', async () => {
  const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
  const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));
  const liveGpuFalse = (cg.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
  const kernelSources = {};
  for (const n of liveGpuFalse) {
    const p = resolve(KDIR, `${n.tool_id}.kernel.mjs`);
    try { kernelSources[n.tool_id] = readFileSync(p, 'utf8'); } catch { /* left undefined -> NO_KERNEL_FILE */ }
  }
  const { stale, fresh, total } = await computeStaleness(cg, kernelSources, sourceDigest);
  // 454 -> 461 post-ASSEMBLE-LAND-PROVE8-1 (2026-07-25): landed 7 of 8 deferred nodes
  // (art-470/471/474/475/477/478/479) with groth16 compute_proof, execution_hash unchanged
  // (attaching a receipt doesn't move compute) — denominator moves, stale count doesn't.
  // 461 -> 462 post-ASSEMBLE-LAND-ART476-1 (2026-07-26): landed art-476 (S18-ART476-FIX-2 +
  // S18-ART476-PROVE-2, PR #657) with groth16 compute_proof, kernel_digest unchanged by
  // construction (inlined SHA-256 reproduces the same policyParametersHash) — denominator
  // moves, stale count doesn't.
  // 132 -> 131 post-ASSEMBLE-LAND-ART336-1 (2026-07-26): landed art-336 (S18-ART336-FIX-1 +
  // S18-ART336-PROVE-1, PR #655) — kernel source moved b1cf4e50->65a08e84 and the reprove
  // receipt now matches it, so compute_ltv_ratios (art-336) drops out of stale. Named,
  // node-by-node: this is the only node that moved.
  // 462 -> 474 post-ASSEMBLE-LAND-W2PROOFS-1 (2026-07-27): landed the twelve assurance-wave-2
  // nodes (art-480..art-491, PR #687) with groth16 compute_proof. Verified before/after the
  // assemble: zero nodes moved their compute_images sha256-source digest, so the denominator
  // and the fresh set each move by exactly 12 and the stale count does not move.
  assert(total === 474, `expected 474 in-scope gpu:false proven nodes, got ${total}`);
  assert(fresh.length === 343, `expected 343 fresh (calibration set), got ${fresh.length}`);
  assert(stale.length === 131, `expected 131 stale (132 minus compute_ltv_ratios/art-336, landed via ASSEMBLE-LAND-ART336-1), got ${stale.length}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
