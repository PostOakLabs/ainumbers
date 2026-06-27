// compute-proof.test.mjs — §18 Compute-Integrity Proof GATE (conformance-by-construction, SPEC.md §15).
// Asserts the BINDING (OCG specifies the binding; the seal crypto-verify is DELEGATED, §18.1):
//   (a) attach + verifyBinding round-trip for a well-formed receipt whose journal binds output_payload and
//       whose imageId is published in compute_images; (struct) missing/!type/!format/!seal/!journal fails;
//       (journal) journal.output != output_payload fails; (img) imageId not published fails;
//   (d) backward-compat — attaching compute_proof mints no new execution_hash, no chaingraph_version bump,
//       and an artifact without compute_proof has no §18 binding;
//   (delegated) verifySeal() THROWS (no silent-skip — seal verification is delegated, not implemented).
// Node 18+.  Run:  node kernels/compute-proof.test.mjs
import { buildArtifact } from './art-04-agent-identity-attestation-checker.kernel.mjs';
import { attachComputeProof, verifyBinding, verifySeal, SEAL_VERIFICATION, RECOMMENDED_RECEIPT_FORMAT } from './_computeproof.mjs';
import { executionHash } from './_hash.mjs';

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

// (delegated) §18.1 — seal crypto-verify is delegated; verifySeal MUST throw (no silent-skip).
ok(SEAL_VERIFICATION === 'delegated', '(delegated) SEAL_VERIFICATION marker is "delegated"');
let threw = false; try { verifySeal(); } catch { threw = true; }
ok(threw, '(delegated) verifySeal() throws — OCG does not re-implement the proof system (§18.1)');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all compute-proof (§18) assertions passed');
process.exit(fail ? 1 : 0);
