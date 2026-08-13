// compute-proof.test.mjs — §18 Compute-Integrity Proof GATE (conformance-by-construction, SPEC.md §15).
// Asserts the BINDING and the SELF-CONTAINED BN254 Groth16 reference verifier (§18.1):
//   (a) attach + verifyBinding round-trip for a well-formed receipt whose journal binds output_payload and
//       whose imageId is published in compute_images; (struct) missing/!type/!format/!seal/!journal fails;
//       (journal) journal.output != output_payload fails; (img) imageId not published fails;
//   (d) backward-compat — attaching compute_proof mints no new execution_hash, no chaingraph_version bump,
//       and an artifact without compute_proof has no §18 binding;
//   (verify) verifySeal() VERIFIES A REAL Groth16-BN254 receipt fixture (green = a real proof verified),
//       REJECTS a tampered seal and a wrong journal, and DELEGATES (throws) for receiptFormat:"stark".
// Node 18+.  Run:  node kernels/compute-proof.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildArtifact } from './art-04-agent-identity-attestation-checker.kernel.mjs';
import { attachComputeProof, verifyBinding, verifySeal, SEAL_VERIFICATION, RECOMMENDED_RECEIPT_FORMAT } from './_computeproof.mjs';
import { executionHash, cgCanon } from './_hash.mjs';
import { sourceDigest } from './_buildid.mjs';
import { classifyNode } from '../../scripts/check-compute-proof-coverage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const PP = {
  credential: {
    credential_type: 'AgentCredential', agent_id: 'a1', issuer: 'did:key:zStub',
    issued_at: 1, expires_at: 4102444800, scopes: ['read:account'], signature: 'ed25519:zz',
  },
  validate_at_unix: 1750000000,
};
const CREATED = '2026-06-27T00:00:00Z';
const IMAGE_ID = 'sha256:' + 'b'.repeat(64);
const published = [IMAGE_ID]; // node.compute_images[].image_id (system "risc0")

const base = await buildArtifact(PP, { now: CREATED });
ok(!base.audit_signature.compute_proof, '(d) unsigned artifact has no audit_signature.compute_proof');
ok(!verifyBinding(base, { publishedImageIds: published }), '(d) artifact without compute_proof has no §18 binding');

// A well-formed receipt (seal bytes are opaque to the binding check; offline-produced per §18.2).
const receipt = {
  type: 'ZkVmReceipt', system: 'risc0', receiptFormat: RECOMMENDED_RECEIPT_FORMAT,
  imageId: IMAGE_ID, seal: 'c2VhbA==', journal: { output: base.output_payload },
};
const proven = attachComputeProof(base, receipt);
ok(proven.audit_signature.compute_proof.type === 'ZkVmReceipt', '(a) compute_proof recorded');
ok(RECOMMENDED_RECEIPT_FORMAT === 'groth16-bn254', '(a) RECOMMENDED receiptFormat is groth16-bn254');
ok(verifyBinding(proven, { publishedImageIds: published }), '(a) binding round-trip passes (journal↔output + imageId published)');
ok(verifyBinding(proven), '(a) binding passes without Graph Index leg (artifact-internal binding only)');

// (d) backward-compat — attaching compute_proof changes NOTHING in the hash preimage / envelope tag.
ok(proven.execution_hash === base.execution_hash, '(d) attaching compute_proof mints no new execution_hash');
ok(proven.execution_hash === await executionHash(PP, proven.output_payload), '(d) execution_hash still valid');
ok(proven.chaingraph_version === '0.4.0', '(d) chaingraph_version stays 0.4.0');

// (journal) §18.0 — the journal MUST bind output_payload.
const badJournal = structuredClone(proven); badJournal.audit_signature.compute_proof.journal = { output: { injected: true } };
ok(!verifyBinding(badJournal, { publishedImageIds: published }), '(journal) journal.output != output_payload fails');
const noJournalOut = structuredClone(proven); noJournalOut.audit_signature.compute_proof.journal = {};
ok(!verifyBinding(noJournalOut, { publishedImageIds: published }), '(journal) journal missing output fails');

// (img) §18.1 — imageId must be published in compute_images.
ok(!verifyBinding(proven, { publishedImageIds: ['sha256:' + '9'.repeat(64)] }), '(img) imageId not published fails');

// (struct) malformed receipts fail the binding.
const mk = (mut) => { const a = structuredClone(proven); mut(a.audit_signature.compute_proof); return a; };
ok(!verifyBinding(mk((c) => { delete c.seal; }), { publishedImageIds: published }), '(struct) missing seal fails');
ok(!verifyBinding(mk((c) => { c.type = 'NotAReceipt'; }), { publishedImageIds: published }), '(struct) wrong type fails');
ok(!verifyBinding(mk((c) => { c.receiptFormat = 'plonk'; }), { publishedImageIds: published }), '(struct) unknown receiptFormat fails');
ok(!verifyBinding(mk((c) => { c.imageId = ''; }), { publishedImageIds: published }), '(struct) empty imageId fails');

// ── (verify) §18.1 — the self-contained BN254 Groth16 reference verifier on a REAL receipt ──
// Fixture is a real RISC0_DEV_MODE=0 Groth16-BN254 receipt for the art-04 runner-guest (see fixtures/
// compute-proof/PROVENANCE.md for the exact toolchain + command that produced it). Green here means a
// real zkVM proof actually verified against the published ImageID — not a structure-only check.
ok(SEAL_VERIFICATION === 'reference-verifier', '(verify) SEAL_VERIFICATION marker is "reference-verifier"');
const FIXTURE = JSON.parse(readFileSync(resolve(HERE, 'fixtures/compute-proof/art-04-agent-identity-attestation-checker.receipt.json'), 'utf8'));
ok(FIXTURE.receiptFormat === 'groth16-bn254' && FIXTURE.seal && FIXTURE.imageId.startsWith('sha256:'), '(verify) fixture is a groth16-bn254 receipt');
ok(verifySeal(FIXTURE) === true, '(verify) verifySeal VERIFIES the real Groth16-BN254 receipt against its ImageID');

// the real receipt must also bind to its own output_payload (full §18 chain on a real proof).
const realArtifact = await buildArtifact(PP, { now: CREATED });
const realProven = attachComputeProof(realArtifact, FIXTURE);
ok(verifyBinding(realProven, { publishedImageIds: [FIXTURE.imageId] }), '(verify) real receipt binds output_payload + published ImageID');

// negative — a tampered seal must be REJECTED (guards against a vacuous verifier).
const sealBytes = Uint8Array.from(atob(FIXTURE.seal), (ch) => ch.charCodeAt(0)); sealBytes[200] ^= 0x01;
const tampered = { ...FIXTURE, seal: btoa(String.fromCharCode(...sealBytes)) };
ok(verifySeal(tampered) === false, '(verify) tampered seal is REJECTED');

// negative — a wrong journal (different claim digest) must be REJECTED.
const wrongJournal = structuredClone(FIXTURE); wrongJournal.journal.output.pass = 7;
ok(verifySeal(wrongJournal) === false, '(verify) wrong journal is REJECTED');

// negative — a deliberately EMPTIED journal (the async-vacuous class, ASYNC-VACUOUS-REMEDIATE-1: 20
// receipts once verified while journal.output === {}) must be REJECTED too, on the real on-disk fixture.
const emptyJournalFixture = structuredClone(FIXTURE); emptyJournalFixture.journal.output = {};
ok(verifySeal(emptyJournalFixture) === false, '(verify) emptied journal.output ({}) is REJECTED — the async-vacuous class');

// (delegated) §18.1 — stark seal verification stays delegated to the vendor verifier (throws, no silent-skip).
let threw = false; try { verifySeal({ ...FIXTURE, receiptFormat: 'stark' }); } catch { threw = true; }
ok(threw, '(delegated) verifySeal() throws for receiptFormat:"stark" — vendor-delegated (§18.1)');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// WIDENED COVERAGE (COMPUTEPROOF-TEST-COVERAGE-1, 2026-08-13). Everything above verifies ONE exemplar
// (art-04). Two independent rows flagged that as a real gap — S18-RATCHET-ETHMATH-0811-1: "compute-proof
// .test.mjs pins a single art-04 exemplar and does NOT cover these receipts"; ART607-GUEST-ERROR-1 confirmed
// it again. This estate has separately shipped a valid groth16 seal over an ERROR journal (art-529,
// historical — see check-compute-proof-coverage.mjs's classifyNode() comment) and 20 proofs that once
// verified while attesting NOTHING (the async-vacuous class, ASYNC-VACUOUS-REMEDIATE-1). A green proof is
// evidence about the ONE INPUT it ran, never about the kernel — the suite passing was a statement about
// art-04 and nothing else.
//
// COVERAGE POLICY — a NAMED REPRESENTATIVE SET, not every receipt in the graph (stated, not silent).
// verifySeal() does a real BN254 pairing check, measured ~60-85ms/call; at 581 currently-proven gpu:false
// live receipts that is 35-50s+ of real crypto, run on every `preflight.mjs --changed origin/main` pre-push
// — the exact floor SO explicitly protects (cut from 5m 7.7s to 0.49s by a DIFFERENT gate's scoping; see
// this row's check-off for measured before/after timings here). The full-estate non-vacuity/recompute
// question is already owned, full-estate, by scripts/check-recompute-equality.mjs (SO #34,
// ASYNC-VACUOUS-GATE-1, ~8s, wired into preflight.mjs + CI) — it re-executes every proven node's kernel in
// a sandbox and requires journal.output to reproduce, but it never touches the cryptographic seal. This
// suite's unique job is the seal + binding + independent-digest chain that recompute-equality never
// exercises, so a fast representative set is the right shape here rather than re-running that gate's
// full-estate sweep a second time under a slower crypto path.
//
// SELECTION RULE (written down — the async-vacuous class survived exactly BECAUSE sampling was silent):
//   - art-04  (above) — the one BESPOKE-image exemplar (Rust-ported guest, not the universal QuickJS
//     runner) — exercises the non-universal-imageId path. Kept from the original suite.
//   - art-01  — a UNIVERSAL guest image (sha256:a1a0bc89…) exemplar. That image covers 573 of 581 live
//     proven receipts, so at least one is required for this suite to say anything about most of them.
//   - art-189 — a CONVERTED-CRYPTO node: one of the kernels ASYNC-VACUOUS-REMEDIATE-1 converted from async
//     to sync via an inlined pure-JS SHA-256 (art-476's inlining pattern), and one that genuinely computes
//     SHA-256 digests inside compute() — "crypto" on both the conversion mechanism and the kernel's own
//     logic.
//   - art-201, art-371 — the two other BESPOKE-image survivor-set nodes (RIDER-KERNEL.md's
//     `{art-04, art-201, art-371, art-413/414/415}`), each under a distinct imageId from art-04's.
//   - art-529 — the exact node check-compute-proof-coverage.mjs's classifyNode() names as the historical
//     instance of a REAL verifying seal over an ERROR journal (CCPCORE-PROVE-1). It is proven and
//     non-error today; included to prove the CURRENT receipt clears every check this suite runs, not
//     merely that the class was fixed elsewhere. It is also a §25 ocg-private-input@1 kernel, so — unlike
//     the other four — its journal cannot be cross-checked against a published fixture vector by
//     construction (its real input is a private witness); that one leg is skipped for it, stated inline,
//     matching check-recompute-equality.mjs's own pre-existing §25 exclusion.
//   - art-607 — the DEFERRED exemplar (compute_proof_ready:"deferred"). ART607-GUEST-ERROR-1 diagnosed why
//     it cannot be proven today (an eager top-level TextEncoder call the zkVM guest lacks). Included so
//     this suite also asserts the deferred path classifies honestly — never silently read as proven.
//
// Every receipt is read from chaingraph.json (the Graph Index — the same place a real consumer reads it
// from) or the kernel's own dedicated fixture file, never re-derived or invented. kernel_digest is
// independently recomputed from the KERNEL SOURCE FILE on disk via _buildid.mjs's sourceDigest() — SO #34:
// never read the digest back out of the artifact under test. journal.output is cross-checked against the
// kernel's own golden fixture vector (an independent file), never against itself.

const CG = JSON.parse(readFileSync(resolve(HERE, '..', 'chaingraph.json'), 'utf8'));
function nodeById(id) {
  const n = CG.nodes.find((x) => x.tool_id === id);
  if (!n) throw new Error(`compute-proof.test.mjs: node "${id}" not found in chaingraph.json — selection rule is stale, fix the list above`);
  return n;
}
const kernelSource = (id) => readFileSync(resolve(HERE, `${id}.kernel.mjs`), 'utf8');
const fixtureVectors = (id) => JSON.parse(readFileSync(resolve(HERE, 'fixtures', `${id}.fixtures.json`), 'utf8')).vectors;
const tamperSeal = (cp) => { const b = Uint8Array.from(atob(cp.seal), (ch) => ch.charCodeAt(0)); b[200] ^= 0x01; return { ...cp, seal: btoa(String.fromCharCode(...b)) }; };

const SAMPLE = [
  { id: 'art-01-ap2-mandate-chain-validator', note: 'universal guest image (573/581 receipts share it)' },
  { id: 'art-189-markdown-document-converter', note: 'converted-crypto: async→sync via inlined SHA-256 (ASYNC-VACUOUS-REMEDIATE-1)' },
  { id: 'art-201-iscc-content-code-generator', note: 'bespoke-image survivor set' },
  { id: 'art-371-simulate-var-monte-carlo', note: 'bespoke-image survivor set' },
  { id: 'art-529-ccp-default-waterfall-recompute', note: 'historical error-journal instance, now proven', privateInput: true },
];

for (const { id, note, privateInput } of SAMPLE) {
  const node = nodeById(id);
  const cp = node.compute_proof;
  ok(!!cp, `(widened:${id}) node carries a compute_proof — ${note}`);

  // §17 — kernel_digest recomputed from the KERNEL SOURCE FILE on disk, never read from the receipt itself.
  const recomputedDigest = await sourceDigest(kernelSource(id));
  ok(recomputedDigest === cp.journal.kernel_digest, `(widened:${id}) journal.kernel_digest == sha256 recomputed from kernel bytes`);

  // §18.1 — imageId must be published in this node's own compute_images (Graph Index binding leg).
  const publishedImageIds = (node.compute_images ?? []).map((i) => i.image_id);
  ok(publishedImageIds.includes(cp.imageId), `(widened:${id}) imageId is published in compute_images`);

  // journal.output is a real result — never vacuous (the class this row exists because of).
  const out = cp.journal.output;
  ok(!!out && typeof out === 'object' && !Array.isArray(out) && Object.keys(out).length > 0 && !('error' in out),
    `(widened:${id}) journal.output is a non-vacuous result object (no error key, >=1 field)`);

  if (!privateInput) {
    // journal.output cross-checked against an INDEPENDENT source — the kernel's own golden fixture vector
    // — never against itself.
    const vec0 = fixtureVectors(id)[0].output_payload;
    ok(JSON.stringify(cgCanon(out)) === JSON.stringify(cgCanon(vec0)), `(widened:${id}) journal.output equals the fixture's output_payload (independent source)`);
    ok(verifyBinding({ audit_signature: { compute_proof: cp }, output_payload: vec0 }, { publishedImageIds }),
      `(widened:${id}) verifyBinding passes against the independent fixture output_payload`);
  } else {
    console.log(`  · (widened:${id}) §25 ocg-private-input@1 — journal↔fixture cross-check skipped by construction (private witness), matches check-recompute-equality.mjs's exclusion`);
  }

  // the real seal actually verifies.
  ok(verifySeal(cp) === true, `(widened:${id}) verifySeal VERIFIES the real receipt`);

  // negative control — a tampered seal must be REJECTED.
  ok(verifySeal(tamperSeal(cp)) === false, `(widened:${id}) tampered seal is REJECTED`);

  // negative control — a tampered (mutated) journal must be REJECTED.
  const tamperedJournal = structuredClone(cp);
  tamperedJournal.journal.output = { ...tamperedJournal.journal.output, __tamper_probe: true };
  ok(verifySeal(tamperedJournal) === false, `(widened:${id}) tampered (mutated) journal is REJECTED`);

  // negative control — a deliberately EMPTIED journal must be REJECTED (the async-vacuous class:
  // 20 receipts once verified while journal.output === {}, ASYNC-VACUOUS-REMEDIATE-1).
  const emptiedJournal = structuredClone(cp);
  emptiedJournal.journal.output = {};
  ok(verifySeal(emptiedJournal) === false, `(widened:${id}) emptied journal.output ({}) is REJECTED — the async-vacuous class`);
}

// ── the deferred exemplar — must classify honestly, never silently read as proven ──
const deferredNode = nodeById('art-607-erc1967-proxy-slot-classifier');
ok(!deferredNode.compute_proof, '(widened:deferred) art-607 carries no compute_proof');
const deferredVerdict = classifyNode(deferredNode);
ok(deferredVerdict.state === 'deferred', `(widened:deferred) art-607 classifies as "deferred" (got "${deferredVerdict.state}")`);
ok(deferredVerdict.problems.length === 0, `(widened:deferred) art-607's deferral is well-formed (real, non-placeholder deferred_reason) — ${deferredVerdict.problems.join('; ')}`);

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all compute-proof (§18) assertions passed');
process.exit(fail ? 1 : 0);
