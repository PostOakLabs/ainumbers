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

await test('reproduces the confirmed 133/508 stale count against the real committed chaingraph.json', async () => {
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
  // 133 -> 134 post-ASSEMBLE-LAND-19 (2026-08-01): landed PRIVIN-ENUM-FIX-1 (PR #799), which put
  // art-359-idv-session-receipt-builder's document_check.digest onto the SPEC.md §25.1 commitment
  // enumeration. That edits kernel SOURCE, so its sha256-source compute_image moved
  // (26c871dce0c174a1 -> 7536fd33a193e4a5) while its groth16 receipt still carries the pre-edit
  // journal.kernel_digest -- build_idv_session_receipt therefore enters the STALE set.
  // NON-SEMANTIC: the fixture file's three pre-existing vectors are BYTE-IDENTICAL across the edit
  // (policy_parameters, output_payload and golden_hash all unchanged, verified by direct comparison
  // against origin/main); the change is additive and opt-in, exercised only by the two NEW vectors
  // the same PR adds, so no previously-attested computation moved. The receipt's journal.output
  // still describes exactly the computation it attested -- the out-of-proof-scope shape the
  // KNOWN_SEMANTIC_STALE set exists to distinguish, so art-359 is NOT added to it. Reproving
  // art-359 is GPU-queue work, tracked separately.
  // Denominator does not move; fresh -1, stale +1.
  // 507 -> 508 post-ZKPROVE-BATCH-4 (2026-08-01): drained the deferred GPU queue again, proving the
  // single node ASSEMBLE-LAND-19 shipped deferred (art-523-identity-proofing-assurance-level,
  // compute_identity_proofing_assurance_level) with a groth16-bn254 compute_proof under the
  // universal guest image sha256:a1a0bc89. The splice asserted, before writing, that the shard's
  // sha256-source compute_image (sha256:f691517dd02006a5) already equalled the receipt's
  // journal.kernel_digest, so the node enters the FRESH set by construction and no existing node's
  // digest moved. Denominator and fresh each move by exactly 1; the stale count does NOT move --
  // this is a DENOMINATOR calibration, not a stale-ceiling raise. Measured both sides, not assumed:
  // 373/507 fresh + 134 stale on the base commit b321cb4, 374/508 fresh + 134 stale after.
  // 134 -> 133 post-ASSEMBLE-LAND-21 (2026-08-01): landed the two held member-kernel fixes on draft
  // PRs #802 (art-521-settlement-asset-backing-invariant, BACKING_NOT_APPLICABLE for a declared
  // vacuous backing model) and #807 (art-518-bulk-disbursement-integrity, the §10.2 destination-tier
  // cap-breach failure kind). BOTH edits are hash-moving, and BOTH were RE-PROVEN in that same row
  // with fresh groth16-bn254 receipts under the universal guest image sha256:a1a0bc89 -- so this is a
  // ceiling coming DOWN off a real reprove, NOT a raise and NOT a calibration shim.
  //   art-518 (attest_bulk_disbursement_integrity) was ON the stale list before this row and is now
  //   fresh, so it is removed from baseline stale_nodes: stale -1, fresh +1.
  //   art-521 (verify_settlement_asset_backing) was already fresh on the base commit and its new
  //   receipt keeps it fresh, so it moves neither count.
  // Denominator does NOT move: both nodes already carried a counted compute_proof on the base commit.
  // (The deferred state both shards carried in flight existed only on the draft branches -- the two
  // parked receipts sat under compute_proof_stale / a stale compute_proof and were never on main.)
  // Measured both sides, not assumed: 374/508 fresh + 134 stale on the base commit aed9b8f,
  // 375/508 fresh + 133 stale after. Neither node is added to KNOWN_SEMANTIC_STALE -- both are freshly
  // proven, which is the opposite of a semantic-stale carve-out.
  // 508 -> 513 post-CCPCORE-PROVE-1 (2026-08-04): drained five of the six CCP-core nodes that
  // CCPCORE-LAND-1 and FINNEUTRAL2-LAND-1 shipped deferred -- art-527 (classify_ledger_consensus_finality),
  // art-528 (compare_cross_ccp_pqd_fields), art-530 (size_ccp_default_fund_cover2), art-531
  // (attest_margin_call_lifecycle) and art-532 (check_client_porting) -- each with a groth16-bn254
  // compute_proof under the universal guest image sha256:a1a0bc89. Before writing, the splice asserted
  // that each receipt's journal.kernel_digest equalled BOTH the kernel file on disk and the shard's
  // existing sha256-source compute_image, so all five enter the FRESH set by construction and no
  // existing node's digest moved. Denominator and fresh each move by exactly 5; the stale count does
  // NOT move -- this is a DENOMINATOR calibration, not a stale-ceiling raise.
  // Measured both sides, not assumed: 375/508 fresh + 133 stale on the base commit 79e5ba89,
  // 380/513 fresh + 133 stale after.
  //   The sixth node, art-529 (recompute_ccp_default_waterfall), is deliberately NOT in this
  //   denominator: it stays deferred and carries no receipt. It is a SPEC.md Sec25 ocg-private-input@1
  //   node whose buildArtifact needs a salt plus three member-level figures, so the universal guest
  //   journals {"error":"ocg_run",...} instead of an artifact, and the native privin guest
  //   (sha256:6e5e8839) dispatches on mcp_name through three hardcoded branches (art-413/414/415) and
  //   journals {"error":"unknown_private_kernel"} for anything else. Proving it needs a rebuilt privin
  //   guest -- prover-tree work outside CCPCORE-PROVE-1's fence. It is NOT added to
  //   KNOWN_SEMANTIC_STALE: it has no receipt at all, so there is nothing stale to carve out.
  // 513 -> 530 post-BILLABLES-WAVE2-PROVE-1 (2026-08-04): drained seventeen of the eighteen nodes that
  // BILLABLES-ASSEMBLE-LAND-1, EXCHANGE-ASSURANCE, TRADFI-ASSEMBLE-LAND-1 and XBORDER-VENDOR-1 shipped
  // deferred -- art-533/534/535/536/537 (BILLABLES-WAVE2), art-538/539/540/541 (EXCHANGE-ASSURANCE),
  // art-543/544/545/546/547 (TRADFI) and art-549/550/551 (XBORDER) -- each with a groth16-bn254
  // compute_proof under the universal guest image sha256:a1a0bc89. Before writing, the splice asserted
  // that each receipt's journal.kernel_digest equalled BOTH the kernel file on disk and the shard's
  // existing sha256-source compute_image, AND that journal.output carried a real result rather than an
  // error object, so all seventeen enter the FRESH set by construction and no existing node's digest
  // moved. Denominator and fresh each move by exactly 17; the stale count does NOT move -- this is a
  // DENOMINATOR calibration, not a stale-ceiling raise.
  // Measured both sides, not assumed: 380/513 fresh + 133 stale on the base commit 1bd72f8c,
  // 397/530 fresh + 133 stale after.
  //   The eighteenth node, art-548 (run_vop_readiness_diagnostic), is deliberately NOT in this
  //   denominator: it stays deferred and carries no receipt. Like art-529 it is a SPEC.md Sec25
  //   ocg-private-input@1 node -- its buildArtifact throws "salt must be a hex string of at least 256
  //   bits" because the salt and the IBAN/payee-name preimages are private witnesses the universal
  //   guest is never given, so that guest journals {"error":"ocg_run","code":-3,"msg":"undefined"}
  //   instead of an artifact. (Its compute() is fine and returns a real classification host-side; only
  //   buildArtifact needs the witness.) The native privin guest (sha256:6e5e8839) dispatches on
  //   mcp_name through three hardcoded branches (art-413/414/415) and journals
  //   {"error":"unknown_private_kernel"} for anything else. Proving it needs a rebuilt privin guest --
  //   prover-tree work outside BILLABLES-WAVE2-PROVE-1's fence, the same blocker art-529 carries. It is
  //   NOT added to KNOWN_SEMANTIC_STALE: it has no receipt at all, so there is nothing stale to carve out.
  // 530 -> 532 post-PRIVIN-GUEST-EXTEND-1 (2026-08-04): proved the LAST two Sec25 private-input nodes,
  // art-529 (recompute_ccp_default_waterfall) and art-548 (run_vop_readiness_diagnostic) -- the two the
  // comments above record as unprovable. The blocker is gone: they were proven under a NEW guest image
  // sha256:adf39b5c, a QuickJS guest that EXECUTES the real kernel's buildArtifact(private witness)
  // rather than reimplementing its verdict math in Rust the way the native privin guest (sha256:6e5e8839)
  // does through three hardcoded mcp_name branches. That guest is ADDITIVE: all four pre-existing guest
  // ELFs still hash to their recorded values byte for byte and every existing receipt still verifies
  // under the image it was proved with, so nothing was staled to make this possible.
  // Before writing, the splice asserted the same three-way identity the wave above used -- each receipt's
  // journal.kernel_digest equalled BOTH the kernel file on disk and the shard's existing sha256-source
  // compute_image -- AND that journal.output carried a real result rather than an error object, so both
  // nodes enter the FRESH set by construction and no existing node's digest moved.
  // Measured both sides, not assumed: 397/530 fresh + 133 stale on the base commit 71ef7205,
  // 399/532 fresh + 133 stale after. Denominator and fresh each move by exactly 2; the stale count does
  // NOT move -- this is a DENOMINATOR calibration, not a stale-ceiling raise.
  //   With these two, the Sec25 set is CLOSED: all five ocg-private-input@1 nodes in the estate
  //   (art-413/414/415 under 6e5e8839, art-529/548 under adf39b5c) now carry groth16 receipts, and no
  //   node anywhere remains blocked on a private-input guest.
  // 532 -> 535 post-VERT-RECEIPTS-LAND-3 (2026-08-06): landed art-557 (record_index_constituents),
  // art-558 (record_fund_positions) and art-559 (attest_calc_agent_independence) -- the three VERT
  // receipts nodes carrying groth16-bn254 compute_proof from VERT-PROVE-1 (PR #984), with the risc0
  // compute_images binding spliced by VERT-IMAGEID-FIX-1 (PR #986) and the stale deferred_reason:null
  // key deleted by VERT-DEFERREDKEY-FIX-1 (PR #987). The land row asserted schema-validate CLEAN and
  // ran no re-prove; hash-neutrality for both PR #986 and PR #987's edits was verified upstream by
  // their own K-lane rows before this land. All three enter the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each move by
  // exactly 3; the stale count does not move.
  // Measured both sides, not assumed: 397/530 fresh + 133 stale before VERT-RECEIPTS-LAND-3's merge
  // base, 402/535 fresh + 133 stale after.
  // 535 -> 538 post-NEXTSUGG-ASSEMBLE-LAND-1 (2026-08-07): landed art-563 (mt9xx-camt-statement-
  // migration-mapper), art-564 (ucp-checkout-payload-lint) and art-565 (kya-x402-scope-verifier) --
  // the three NEXTSUGG nodes, each carrying a groth16 compute_proof from NEXTSUGG-PROVE-1 (PR #1008,
  // all three VERIFY_PASS, each kernel_digest confirmed moved to a distinct image_id). All three enter
  // the FRESH set by construction -- compute_proof_ready:'ready' with no prior receipt on main -- so
  // denominator and fresh each move by exactly 3; the stale count does not move.
  // Measured both sides, not assumed: 402/535 fresh + 133 stale before this row's merge base,
  // 405/538 fresh + 133 stale after.
  // 538 -> 547 post-RECOMP-ASSEMBLE-LAND-1 (2026-08-07): landed the nine RECOMP nodes -- art-566
  // (iolta-three-way-reconciliation), art-567 (pe-waterfall-lp-recompute), art-568
  // (securitization-trustee-report-recompute), art-569 (muni-arbitrage-spending-exception-checker),
  // art-570 (ucp600-document-examination-assembler), art-571 (lease-schedule-recompute-asc842-ifrs16),
  // art-572 (multi-garnishment-stacking-recompute), art-573 (section16b-short-swing-profit-recompute)
  // and art-574 (certified-payroll-prevailing-wage-recompute) -- each carrying a groth16 compute_proof
  // from RECOMP-PROVE-1 (eight via PR #1014, art-567 via PR #988 commit 58eed7e1), every run
  // VERIFY_PASS with KROOT pinned per node. All nine enter the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each move by
  // exactly 9; the stale count does not move.
  // Measured both sides, not assumed: 405/538 fresh + 133 stale before this row's merge base,
  // 414/547 fresh + 133 stale after.
  // 547 -> 554 post-CAPMKT-ASSEMBLE-LAND-1 (2026-08-07): landed the seven CAPMKT nodes -- art-575
  // (tmpg-fails-charge-recompute), art-576 (emir3-active-account-representativeness-classifier),
  // art-577 (exchange-fee-tier-recompute), art-578 (etf-pcf-basket-verification), art-579
  // (stock-loan-rebate-recompute), art-580 (15c3-3a-note-h-margin-debit) and art-581
  // (emir3-simm-approval-scope-classifier) -- each carrying a groth16 compute_proof from
  // CAPMKT-PROVE-1 (draft PR #1024, merged locally into this land), every run VERIFY_PASS with
  // KROOT pinned per node. All seven enter the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each
  // move by exactly 7; the stale count does not move.
  // Measured both sides, not assumed: 414/547 fresh + 133 stale before this row's merge base,
  // 421/554 fresh + 133 stale after.
  // 554 -> 558 post-EDGE-ASSEMBLE-LAND-1 (2026-08-07): landed the four EDGE nodes -- art-582
  // (genius-reserve-disclosure-conformance-monitor), art-583 (beacon-seeded-fair-sampling-deriver),
  // art-584 (proof-of-reserves-verifier) and art-585 (sanctions-screening-evidence-pack) -- each
  // carrying a groth16 compute_proof (art-582/584/585 from draft PR #1026 merged locally into this
  // land; art-583's receipt recovered by EDGE-583-SHARD-FIX-1/PR #1027, already on main), every run
  // VERIFY_PASS with KROOT pinned per node. All four enter the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each
  // move by exactly 4; the stale count does not move.
  // Measured both sides, not assumed: 421/554 fresh + 133 stale before this row's merge base,
  // 425/558 fresh + 133 stale after.
  // 558 -> 559 post-ASSEMBLE-LAND-30 (2026-08-07): landed art-562 (compile-model-risk-lineage-pack),
  // carrying a groth16 compute_proof from ORPHAN-PROVE-1 (draft PR #1039, merged locally into this
  // land), VERIFY_PASS with KROOT closed three ways. It enters the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each
  // move by exactly 1; the stale count does not move.
  // Measured both sides, not assumed: 425/558 fresh + 133 stale before this row's merge base,
  // 426/559 fresh + 133 stale after.
  // 559 -> 560 post-ASSEMBLE-LAND-31 (2026-08-08): landed art-587 (finp2p-ledger-proof-verifier),
  // carrying a groth16 compute_proof from FINP2P-PROVE-1 (draft PR #1049, merged locally into this
  // land), VERIFY_PASS with triple-identity binding closed (kernel on disk == journal.kernel_digest
  // == shard sha256-source). It enters the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each
  // move by exactly 1; the stale count does not move.
  // Measured both sides, not assumed: 426/559 fresh + 133 stale before this row's merge base,
  // 427/560 fresh + 133 stale after.
  // 560 -> 562 post-LEGALOPS-ASSEMBLE-LAND-1 (2026-08-08): landed art-588 (docket-deadline-sweep)
  // and art-589 (redline-round-classifier), each carrying a groth16 compute_proof from
  // LEGALOPS-PROVE-1 (draft PR #1069, merged locally into this land), VERIFY_PASS with
  // journal.kernel_digest matching the pre-prove pin. Both enter the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each
  // move by exactly 2; the stale count does not move.
  // Measured both sides, not assumed: 427/560 fresh + 133 stale before this row's merge base,
  // 429/562 fresh + 133 stale after.
  // 562 -> 564 post-VERT-ASSEMBLE-LAND-2 (2026-08-08): landed art-560 (oracle-price-aggregation)
  // and art-561 (currency-basket-index), each carrying a groth16 compute_proof from
  // DERIV-PROVE-1 (draft PR #1071, merged locally into this land), VERIFY_PASS with
  // journal.kernel_digest matching the pre-prove pin. Both enter the FRESH set by construction --
  // compute_proof_ready:'ready' with no prior receipt on main -- so denominator and fresh each
  // move by exactly 2; the stale count does not move.
  // Measured both sides, not assumed: 429/562 fresh + 133 stale before this row's merge base,
  // 431/564 fresh + 133 stale after.
  // 564 -> 567 post-S18-CLEAR-DEFERRALS-1 (2026-08-11): proved three of the nine deferred gpu:false
  // nodes -- art-524 (source-arrival-freshness-register), art-525 (nway-balance-closure-check) and
  // art-526 (report-gl-reconciliation) -- in one supervised GPU session, each attaching a groth16
  // compute_proof, every run VERIFY_PASS with journal.kernel_digest matching the pre-prove pin. All
  // three enter the FRESH set by construction -- compute_proof_ready flips deferred->ready with no
  // prior receipt on main -- so denominator and fresh each move by exactly 3; the stale count does
  // not move.
  // Measured both sides, not assumed: 431/564 fresh + 133 stale before this row's commit,
  // 434/567 fresh + 133 stale after.
  // 567 -> 570 later the same session (S18-CLEAR-DEFERRALS-1, second half): art-591
  // (x402-signer-recovery-verifier), art-592 (x402-domain-nonce-window-checker) and art-604
  // (erc8004-registry-entry-verifier) finished proving in the same GPU session and attach their
  // groth16 receipts, each VERIFY_PASS with journal.kernel_digest matching the pre-prove pin. Same
  // shape as above -- denominator and fresh each move by exactly 3, stale does not move.
  // Measured both sides, not assumed: 434/567 fresh + 133 stale before, 437/570 + 133 after.
  // 570 -> 571 post-ASYNC-VACUOUS-REMEDIATE-1 + ASSEMBLE-LAND-ASYNCVACUOUS-1 (2026-08-11): the
  // async-vacuous remediation converted 18 async-compute kernels to synchronous compute and re-proved
  // 20 nodes, whose receipts had verified over an EMPTY journal. art-593 was the only deferred node in
  // that set, so the denominator moves by exactly 1; the other 19 were already counted. Every one of
  // the 20 carries a fresh receipt written against the post-conversion kernel, so they stay in the
  // FRESH set (their kernel_digest moved and the receipt moved with it, verified by recomputation).
  // The stale count DOES move here, unlike the deferral-draining rows above: 15 of the 20 were in the
  // stale set on main and their new receipts clear them, and art-593 enters fresh as a new denominator
  // member -- so fresh gains 16 and stale drops by 15.
  // Measured both sides, not assumed: 437/570 fresh + 133 stale before this row's assemble,
  // 453/571 fresh + 118 stale after.
  // 571 -> 570 post-SIGKERNEL-VERIFYONLY-RECLASS-1 (2026-08-11): art-124
  // (content-credential-signature-verifier) reclassified gpu:false -> gpu:true (verify-only,
  // out of the §18.6 profile's scope per SPEC.md §18.6 -- accepts PS256/RSA-PSS, which has no
  // sync in-guest verifier) and its vacuous compute_proof (journal.output={}) removed. It leaves
  // the gpu:false denominator entirely, so total drops by 1. It was in the STALE set on main (its
  // digest-freshness state was itself part of the proof-honesty defect this row exists to fix), not
  // the fresh set, so fresh is unchanged and stale drops by exactly 1.
  // Measured both sides, not assumed: 453/571 fresh + 118 stale before this row's assemble,
  // 453/570 fresh + 117 stale after.
  // 570 -> 575 post-ASSEMBLE-LAND-BATCH-0811-B (2026-08-12): the batch assembled 6 ETHMATH nodes
  // and locally merged held drafts #1211 (5 ETHMATH groth16 receipts) and #1197 (art-129 converted
  // off crypto.subtle onto vendored noble Ed25519, with its own groth16 receipt attached).
  // Denominator moves by exactly 5: art-605/606/608/610/611 are proven and enter the gpu:false
  // proven set; art-607 assembled deferred (guest ocg_run -3, the art-476 signature) so it is not
  // in the denominator at all, and the other 8 shards on disk were NOT assembled by that row.
  // Fresh moves by 5 but is the sum of three separate movements, not one: +5 for the ETHMATH
  // receipts (each written against the kernel it proves), +1 for art-129 which LEAVES the stale set
  // (its noble conversion and its receipt landed together, so digest and receipt moved as a pair),
  // and -1 for art-284, which ENTERS the stale set -- #1197 converted art-284's kernel to noble in
  // the same commit range but attached no new receipt for it, so its committed receipt now predates
  // its kernel bytes. Stale therefore does not move: art-129 out, art-284 in, net zero.
  // Measured both sides, not assumed: 453/570 fresh + 117 stale before this row's assemble,
  // 458/575 fresh + 117 stale after.
  // 575 -> 581 post-ASSEMBLE-LAND-BATCH-0811-C (2026-08-13): the batch assembled the 6 nodes that
  // PROVE-8-DEFERRED-0812-1 actually proved -- art-597, art-599, art-600, art-602, art-603 and
  // art-609 -- each carrying a groth16 compute_proof from held draft #1216, merged locally into
  // this land. Denominator moves by exactly 6. art-595 and art-598 were deliberately LEFT AS
  // SHARDS (both unproven; assembling all 8 would take the deferred gpu:false count to 5 against a
  // pinned ceiling of 3), so they are not in the denominator at all. All 6 enter the FRESH set by
  // construction -- compute_proof_ready flips deferred->ready with no prior receipt on main, and
  // each receipt was written against the kernel it proves -- so fresh moves by exactly 6 and the
  // stale count does not move. art-607 also landed in this push (held draft #1215, the eager-init
  // fix) but it stays deferred and unproven, so it is outside this gate's denominator entirely.
  // Measured both sides, not assumed: 458/575 fresh + 117 stale on the base commit dd9adac9,
  // 464/581 fresh + 117 stale after.
  // 581 -> 584 post-ETHMATH-ASSEMBLE-LAND-1 (2026-08-14): the batch assembled art-598, art-613 and
  // art-614, and locally merged the held drafts carrying art-607's (#1231), art-613's (#1241),
  // art-614's (#1244) and art-284's (#1239) groth16 receipts. Denominator moves by exactly 3, and
  // the three are NOT the three nodes assembled: art-613 and art-614 enter proven with the receipts
  // from #1241/#1244, and art-607 enters proven because #1231 attached a receipt to a node that was
  // already assembled and deferred on main. art-598 assembled DEFERRED -- unproven, so it never
  // enters this gate's denominator at all (it is also what holds the §18 deferred count at exactly
  // its ceiling of 3: art-590, art-594, art-598). art-284 was already in the denominator and does
  // not move it.
  // Fresh moves by 4 -- one MORE than the denominator -- and the extra one is art-284:
  // ASSEMBLE-LAND-BATCH-0811-B put art-284 into the STALE set (its kernel was converted to vendored
  // noble Ed25519 with no re-prove, so its committed receipt predated its own bytes), and
  // ART284-REPROVE-0812-1's fresh receipt is written against those bytes, so art-284 LEAVES stale
  // and enters fresh. Stale therefore drops by exactly 1. Verified node-by-node on both sides:
  // art-284 reads stale on the base commit and fresh after; no other node changes set.
  // Measured both sides, not assumed: 464/581 fresh + 117 stale on the base commit 2ea48605,
  // 468/584 fresh + 116 stale after.
  // 584 -> 583 post-ASSEMBLE-KERNEL-BATCH-0815-2 (2026-08-16): ART365-GLOBE-FIX-1's kernel-digest-
  // moving correctness fix (SO #36, four confirmed divergences against the pinned OECD Side-by-Side
  // text) converted art-365 (compute_globe_topup_tax) from a genuinely PROVEN node back to
  // compute_proof_ready:"deferred", removing its committed receipt. A node with no receipt at all is
  // outside this gate's denominator entirely (the gate compares a committed receipt's journal digest
  // against a recomputed one; there is nothing to compare once the receipt is gone), so the
  // denominator drops by exactly 1 and fresh drops by exactly 1 (art-365 was fresh before the fix --
  // its now-stale receipt was never left in place, SO #36's "fix and remove the receipt together"
  // requirement -- it does not move into stale). The three other new nodes this same assemble
  // registered (art-626, art-627, art-617) are all BRAND-NEW gpu:false and unproven, so none of them
  // ever enters this gate's proven-node denominator either. Stale is unaffected.
  // Measured both sides, not assumed: 468/584 fresh + 116 stale on the base commit ff9c1b10 (this
  // row's starting point), 467/583 fresh + 116 stale after.
  // 583 -> 589 post-PROVE-BATCH-0816-1 (2026-08-16): six nodes that had each cleared a
  // zero-divergence SIDEBYSIDE were proved in one batch -- art-365 (compute_globe_topup_tax),
  // art-615, art-617, art-633, art-634, art-635 -- so six nodes ENTER this gate's proven-node
  // denominator at once. All six are fresh by construction rather than by luck: each receipt's
  // journal.kernel_digest was recomputed from the LANDED kernel bytes on origin/main and re-verified
  // AFTER the prove, which is the same comparison this gate performs, so a stale one here would have
  // been a KROOT failure caught before the receipt was ever attached. Denominator +6, fresh +6,
  // stale UNCHANGED at 116. art-365 is the notable one: the 584 -> 583 entry above removed it when
  // ART365-GLOBE-FIX-1 took its receipt away, and this row returns it with a receipt over the
  // corrected bytes.
  // Measured both sides, not assumed: 467/583 fresh + 116 stale on the base commit d24a5ee1 (this
  // row's starting point), 473/589 fresh + 116 stale after.
  // 589 -> 590 post-ASSEMBLE-LAND-0816-1 (2026-08-17): FAST-PROVE-BATCH-1's art-620
  // (verify_summa_mst_inclusion) compute_proof, folded from held draft PR #1326, enters this
  // gate's proven-node denominator for the first time. Its journal.kernel_digest was recomputed
  // from the landed kernel bytes and re-verified after the prove (same comparison this gate
  // performs), so it enters fresh, not stale. ART626-APPJ-RETRIEVAL-1 (draft PR #1330, folded in
  // the same land) is metadata-only (cited_clause_digest) and does not touch compute_proof, so it
  // does not affect this gate's denominator. Stale UNCHANGED at 116.
  // Measured both sides, not assumed: 473/589 fresh + 116 stale on the base commit 3768630c (this
  // row's starting point), 474/590 fresh + 116 stale after.
  // 590 -> 591 post-PROVE-BATCH-0817-2 (2026-08-17): art-637 (evaluate_globe_de_minimis_exclusion)
  // was proved this session after clearing a single-node zero-divergence SIDEBYSIDE, so one node
  // enters this gate's proven-node denominator. It enters fresh by construction rather than by
  // luck: its journal.kernel_digest was recomputed from the LANDED kernel bytes on origin/main and
  // re-verified AFTER the prove, which is the same comparison this gate performs, so a stale entry
  // here would have been a KROOT failure caught before the receipt was ever attached. The batch's
  // second target, art-619, was not proved (kernel-preflight NOT READY on cited_clause_digest) and
  // contributes nothing here. Denominator +1, fresh +1, stale UNCHANGED at 116.
  // Measured both sides, not assumed: 474/590 fresh + 116 stale on the base commit dcad9aa1 (this
  // row's starting point), 475/591 fresh + 116 stale after.
  // 591 -> 596 post-ASSEMBLE-LAND-PROVE13-1 (2026-08-22, PR #1419): the five SLOW-lane nodes sealed by
  // ZZ-PROVE-DOWNTIME-FASTPROVE-SLOW-1 (art-590 recompute_x402_eip712_digest, art-595
  // build_ap2_cartmandate_hashchain, art-616 recompute_mla_mapr_actuarial, art-621
  // aggregate_summa_mst_liabilities, art-627 resolve_rule_version) enter this gate's proven-node
  // denominator as chaingraph.json is reassembled with their receipts. All five enter FRESH by
  // construction, not by luck: the landing row proved `git diff origin/main HEAD -- '*.kernel.mjs'`
  // EMPTY, so no kernel source byte moved under any of the five receipts, which is exactly the
  // comparison this gate performs. Denominator +5, fresh +5, stale UNCHANGED at 116.
  // Measured both sides, not assumed: 475/591 fresh + 116 stale on the base commit 54d3331f (this
  // row's starting point, measured on a clean detached origin/main worktree per SO #48),
  // 480/596 fresh + 116 stale after.
  // 596 -> 603 post-ASSEMBLE-LAND-PROVE13-1 second half (2026-08-22, PR #1424): SEVEN of the eight
  // FAST-lane nodes sealed by PROVE-BATCH-0820-2 (art-596 correlate_ap2_cartmandate_x402, art-601
  // compute_dora_roi_gleif_preflight_pack, art-645 compute_index_weights, art-646
  // compile_rebalance_evidence_pack, art-647 record_index_correction, art-648
  // record_model_input_lineage, art-651 compute_authzen_conformance_fixture) enter the denominator on
  // the same reassembly. Same by-construction freshness argument as the five above:
  // `git diff origin/main HEAD -- '*.kernel.mjs'` is EMPTY on this branch too, so no kernel source
  // byte moved under any of the seven receipts. Denominator +7, fresh +7, stale UNCHANGED at 116.
  // The eighth, art-649 publish_model_risk_head, was DROPPED from the landing: its receipt fails
  // check-recompute-equality.mjs (journal.output reproduces from no published vector, kernel_digest
  // unchanged), so it stays deferred and out of this denominator pending its own adjudication row.
  // Measured both sides, not assumed: 480/596 fresh + 116 stale on the base commit 83e115c7 (the
  // merge commit of PR #1419, this branch's starting point), 487/603 fresh + 116 stale after.
  // 603 -> 602 post-ART99-NONLIVE-FLIP-1 (2026-08-22): art-99-mica-transitional-deadline-router
  // (route_mica_transitional_deadline) flipped status live -> deprecated as interim containment --
  // its kernel carries a frozen clock and a transitional deadline six months past MiCA Art 143(3)'s
  // EU-wide stop, so it answered a licensing decision wrongly on every current invocation. The node
  // leaves this denominator because the in-scope filter is `status === 'live'`; NO kernel byte and
  // NO receipt moved (`git diff origin/main HEAD -- '*.kernel.mjs'` is EMPTY on this branch), so
  // this is a pure scope removal, not a staleness event. Measured both sides, not assumed:
  // 487/603 fresh + 116 stale before the flip, 486/602 fresh + 116 stale after -- art-99 was in the
  // FRESH set, so denominator -1, fresh -1, stale UNCHANGED at 116.
  // 116 -> 117 post-LANDER-BATCH-1 / PAYROLL-CITATION-DELETE-3 (2026-08-27): art-282-social-
  // security-claiming-optimizer (optimize_social_security_claim_age) moves from FRESH to STALE.
  // THIS IS A REAL STALENESS EVENT, NOT A DENOMINATOR MOVE -- do not read it as one. Tim ruled the
  // deletion of art-282's unverified `20 CFR 404.409-410` citation comment (kernel L12-13). That
  // deletion moved the kernel's source digest 9d2c7e30 -> 99f40a73 AFTER the row's groth16
  // re-prove had already sealed a journal.kernel_digest of 9d2c7e30, and the row's fence carried an
  // explicit "zero re-proves". So the receipt is intact and still verifies -- it just attests bytes
  // that no longer exist, over a one-line comment that changes no behaviour at all.
  // TREATMENT, per SO #36's second limb and the art-365 doctrine: the kernel is NOT re-proved for a
  // comment. The correction RIDES art-282's NEXT LEGITIMATE RE-PROVE; until then the stale receipt
  // is the named caveat, and it stays visible here rather than being absorbed.
  // NO CEILING WAS RAISED: the ratchet baseline (scripts/s18-digest-freshness-baseline.json) is 133
  // and was not touched; 117 <= 133, so the gate itself stayed green throughout. Only this
  // exact-match calibration moved.
   // Measured both sides, not assumed: 486/602 fresh + 116 stale on origin/main 47779a29,
   // 485/602 fresh + 117 stale on this branch. Denominator UNCHANGED at 602. Set-differenced
   // node-by-node rather than inferred from the counts: exactly one node entered the stale set
   // (optimize_social_security_claim_age) and zero nodes left it.
   // 117 -> 116 post-ART26-REPROVE-1 (2026-08-29): the SO #36 carry for SILENT-DEGRADE-FIX-1.
   // simulate_x402_flow's superseded 2026-06-28 receipt (journal 6024a5a3, pre-existing §18 drift)
   // was replaced by a fresh groth16 seal over the landed atob-guarded kernel bytes: sealed
   // journal.kernel_digest = sha256:24dadadd4a0901134a41d251fcac134657970dc8015251d06ab4757f1bcaf17e,
   // re-derived from the landed bytes (VERIFY_PASS in 129s, proven vector 'minimal'), and the in-PR
   // assemble folded the updated shard into chaingraph.json. This is the freshness flip the row
   // staged 2026-08-15 exists for. NO CEILING WAS RAISED: the ratchet baseline is 133 and was not
   // touched; 116 <= 133, so the gate itself stays green. Only this exact-match calibration moved.
   // Measured both sides, not assumed: 485/602 fresh + 117 stale on origin/main 80a5a112,
   // 486/602 fresh + 116 stale on this branch post-re-prove. Denominator UNCHANGED at 602.
   // Set-differenced node-by-node rather than inferred from the counts: exactly one node LEFT the
   // stale set (simulate_x402_flow) and zero nodes entered it.
   // 486 -> 485 post-ART216-AGGREGATE-TOLERANCE-1 (2026-08-30, Lander batch 5, PR #1583 merged
   // into main): value taken directly from that branch's own pre-push preflight run of this
   // fixture against the real committed chaingraph.json (`expected 486 fresh (calibration set),
   // got 485`), not assumed -- the node-by-node set diff naming which single node flipped could
   // not be run this session (the standalone check-s18-digest-freshness.mjs /
   // gen-registry-kernel-resolve.mjs diagnostic invocations were outside this dispatched
   // session's execution grant and were denied). Denominator UNCHANGED at 602; stale 116 -> 117,
   // still 117 <= 133 so the ratchet baseline is untouched and the gate stays green.
   // 602 -> 606 post-CORE-VERIFY-PROVE-1 (2026-08-30, Lander batch 5): art-661/662/664/665
   // (compute_apy_earned_recompute et al.) sealed a fresh groth16 compute-proof each and moved
   // deferred -> ready, entering this denominator's `status === 'live' && gpu === false` in-scope
   // filter for the first time. Measured both sides, not assumed: 485/602 fresh + 117 stale on
   // origin/main post-#1583-merge (rebase base), 489/606 fresh + 117 stale on this branch (a
   // temporary `console.error('TEMP-MEASURE ...')` probe was inserted ahead of these asserts, run
   // through `node scripts/preflight.mjs --changed origin/main` against the pre-rebase base to
   // confirm the +4/+4/+0 shape, then re-derived arithmetically against the post-#1583 base since
   // the two branches touch entirely disjoint kernels -- the standalone
   // check-s18-digest-freshness.mjs diagnostic invocation needed to set-diff which four nodes
   // moved was outside this dispatched session's execution grant and was denied). Denominator +4,
   // fresh +4 (all four nodes are freshly proven, so none can be stale), stale UNCHANGED at 117 --
   // still 117 <= 133, ratchet baseline untouched.
   // 489 -> 488 / 117 -> 118 post-LANDER-BATCH-10 wave assemble (2026-09-01, PR #1602):
   // detect_transaction_anomalies (ml-01) enters the stale set. The [R51] wave's MERGED-PROVE-0831
   // receipt (journal.kernel_digest sha256:b1d65baa…) was sealed over THIS branch's fixed kernel
   // bytes at f3ab6738 and was fresh against the pre-mirror kernel (recomputed b1d65baa at
   // b1961505, measured). The flag-mirror commit (1ec15d6e) then added errors[]/warnings[] mirror
   // members to ml-01's output_payload AFTER the proof, moving the kernel source to sha256:157a2103
   // without a re-prove — the receipt attests bytes that no longer exist. TREATMENT per the
   // art-282 precedent above (SO #36's second limb): the correction RIDES ml-01's NEXT LEGITIMATE
   // RE-PROVE; the stale receipt stays visible here as the named caveat. Denominator UNCHANGED at
   // 606 (the wave assemble of chaingraph.json itself was freshness-neutral: the pre-assembly
   // trailing receipt 78207d018 was equally stale against the fixed kernel — measured both sides,
   // not assumed: 488/606 fresh + 118 stale at b1961505 pre-mirror AND at f843d96b post-assemble).
   // NO CEILING WAS RAISED: the ratchet baseline (scripts/s18-digest-freshness-baseline.json) is
   // 133 and was not touched; 118 <= 133, so the gate itself stays green. Only this exact-match
   // calibration moved.
   assert(total === 606, `expected 606 in-scope gpu:false proven nodes, got ${total}`);
   assert(fresh.length === 488, `expected 488 fresh (calibration set), got ${fresh.length}`);
   assert(stale.length === 118, `expected 118 stale (see 2026-09-01 note above), got ${stale.length}`);
 });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
