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

await test('reproduces the confirmed 133/507 stale count against the real committed chaingraph.json', async () => {
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
  // 474 -> 489 post-ZKPROVE-BATCH-1 (2026-07-31): drained the deferred GPU queue, landing fifteen
  // nodes (art-492, art-494..art-507) with groth16 compute_proof. The splice asserted, per node,
  // that the shard's sha256-source compute_image already equalled the receipt's journal
  // kernel_digest before writing — so every one of the fifteen enters the FRESH set by
  // construction, and no existing node's digest moved. Denominator and fresh each move by exactly
  // 15; the stale count does not move.
  // 489 -> 493 post-ORPHANPROVE-1 (2026-07-31): proved the last four deferred nodes
  // (art-15/16/17/18) after authoring their canonical golden vectors, which they had shipped
  // without. Authoring a fixtures file adds no kernel source, so no sha256-source digest moved:
  // the splice asserted, per node, that the shard's sha256-source compute_image already equalled
  // the receipt's journal kernel_digest before writing. All four enter the FRESH set by
  // construction. Denominator and fresh each move by exactly 4; the stale count does not move.
  // 493 -> 498 post-ZKPROVE-BATCH-2 (2026-08-01): drained the deferred GPU queue again, landing the
  // five nodes the 2026-07-31 kernel wave shipped deferred (art-508..art-512) with groth16
  // compute_proof. The splice asserted, per node, that the shard's sha256-source compute_image
  // already equalled the receipt's journal kernel_digest before writing, so all five enter the
  // FRESH set by construction and no existing node's digest moved. Denominator and fresh each move
  // by exactly 5; the stale count does not move.
  // 498 -> 499 post-ASSEMBLE-LAND-17 (2026-08-01): landed the nine INBOUND nodes (art-513..art-521).
  // Eight of the nine ship compute_proof_ready:'deferred' with an empty compute_proof, so they are
  // NOT in scope here; only art-517-audit-trail-completeness arrived carrying a groth16 receipt
  // (built by INBOUND-AUDIT-1, PR #191). Its compute_proof is byte-identical to the shard on
  // origin/main (sha256[0:16] 28d8e87eff01b439 both sides) -- assembly spliced it verbatim and this
  // row did not re-prove it -- so its journal kernel_digest still equals its recomputed source
  // digest and it enters the FRESH set by construction. Denominator and fresh each move by exactly
  // 1; the stale count does not move.
  // 499 -> 507 post-ZKPROVE-BATCH-3 (2026-08-01): drained the deferred GPU queue again, proving the
  // eight INBOUND nodes ASSEMBLE-LAND-17 shipped deferred (art-513/514/515/516/518/519/520/521)
  // with groth16 compute_proof. The splice asserted, per node, that the shard's sha256-source
  // compute_image already equalled the receipt's journal kernel_digest before writing, so all eight
  // enter the FRESH set by construction and no existing node's digest moved. Denominator and fresh
  // each move by exactly 8; the stale count does not move.
  // 131 -> 132 post-ASSEMBLE-LAND-18 (2026-08-01): landed PRIVIN-ART518-FIX-1 (PR #795), which put
  // art-518-bulk-disbursement-integrity's duplicate_key onto the SPEC.md §25.1 sha256-salted@1
  // salted-commitment form. That edits kernel SOURCE, so its sha256-source compute_image moved
  // (d399955e44b9c1d3 -> 8a8f97422f9faf1a) while its groth16 receipt still carries the pre-edit
  // journal.kernel_digest -- attest_bulk_disbursement_integrity therefore enters the STALE set.
  // NON-SEMANTIC, and deliberately not reproven here: the new commitment contract is gated behind an
  // OPTIONAL policy_parameters key (duplicate_key_commitment_scheme). Absent, every code path is the
  // pre-edit path, and all six pre-existing golden vectors recompute BYTE-IDENTICAL execution_hashes
  // across the edit (46da9a83.., 3a1e9e50.., 11d55e97.., 76c91ef4.., c6f606e7.., f65ffcfe..), so the
  // receipt's journal.output still describes exactly the computation it attested. This is the
  // out-of-proof-scope shape the KNOWN_SEMANTIC_STALE set in the gate exists to distinguish, so
  // art-518 is NOT added to it. Reproving art-518 is GPU-queue work, tracked separately.
  // Denominator does not move; fresh -1, stale +1.
  // 132 -> 133 post-NORMTERM-FIX-MCPNAME-2 (2026-08-01): renamed attest_settlement_orchestrator
  // (art-292) to lint_settlement_orchestrator_conformance and corrected its kernel comment, which
  // no longer claims to "extend the self-attestation doctrine" (the exact misreading this row
  // exists to fix). That edits kernel SOURCE (a comment), so its sha256-source compute_image moved
  // (4e7ce5129e316675 -> e62a92dde4068256) while its groth16 receipt still carries the pre-edit
  // journal.kernel_digest -- lint_settlement_orchestrator_conformance therefore enters the STALE
  // set. NON-SEMANTIC: golden-parity confirms output_payload (and execution_hash) byte-identical
  // across the edit for the node's fixture vector. Reproving is GPU-queue work, tracked separately.
  // Denominator does not move; fresh -1, stale +1.
  assert(total === 507, `expected 507 in-scope gpu:false proven nodes, got ${total}`);
  assert(fresh.length === 374, `expected 374 fresh (calibration set), got ${fresh.length}`);
  assert(stale.length === 133, `expected 133 stale (132 plus lint_settlement_orchestrator_conformance/art-292, non-semantic, landed via NORMTERM-FIX-MCPNAME-2), got ${stale.length}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
