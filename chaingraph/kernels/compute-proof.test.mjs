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
import { executionHash } from './_hash.mjs';

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

// (delegated) §18.1 — stark seal verification stays delegated to the vendor verifier (throws, no silent-skip).
let threw = false; try { verifySeal({ ...FIXTURE, receiptFormat: 'stark' }); } catch { threw = true; }
ok(threw, '(delegated) verifySeal() throws for receiptFormat:"stark" — vendor-delegated (§18.1)');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all compute-proof (§18) assertions passed');
process.exit(fail ? 1 : 0);
