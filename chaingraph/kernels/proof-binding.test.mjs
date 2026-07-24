// proof-binding.test.mjs — §16 Proof Binding GATE (conformance-by-construction, SPEC.md §15).
// Asserts: (a) sign->verify round-trip; (b) tamper on execution_hash OR proofValue fails verify;
// (c) determinism (same artifact+key+created => byte-identical proofValue); (d) backward-compat
// (unsigned artifact unchanged + still hash-valid + signing mints no new execution_hash);
// (e) did:key round-trip resolves the public key for verification;
// (f) §16.5 (v0.7) proof sets + endorsement chains: a parallel proof set of 2 verifies, a chained
//     endorsement (previousProof) verifies in dependency order, a broken previousProof MUST fail.
// Node 18+ (WebCrypto Ed25519).  Run:  node kernels/proof-binding.test.mjs
import { buildArtifact } from './art-04-agent-identity-attestation-checker.kernel.mjs';
import { sign, verify, addProof, verifyProofs, rawPubkeyToDidKey, didKeyToPublicKey, PROOF_CRYPTOSUITE, addMldsaProof, mldsaKeygen, MLDSA_PROOF_CRYPTOSUITE } from './_proof.mjs';
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
const CREATED = '2026-06-25T00:00:00Z';

const kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const vm = await rawPubkeyToDidKey(kp.publicKey);                    // real did:key for this run
ok(/^did:key:z6Mk/.test(vm), '(e) generated did:key has z6Mk Ed25519 prefix');

const base = await buildArtifact(PP, { now: CREATED });
ok(!base.audit_signature.proof, '(d) unsigned artifact has no audit_signature.proof');
ok(base.chaingraph_version === '0.4.0', '(d) envelope tag stays 0.4.0');
ok(base.execution_hash === await executionHash(PP, base.output_payload), '(d) unsigned hash valid');

const signed = await sign(base, { verificationMethod: vm, created: CREATED, privateKey: kp.privateKey });
ok(signed.audit_signature.proof.type === 'DataIntegrityProof', 'proof.type DataIntegrityProof');
ok(signed.audit_signature.proof.cryptosuite === PROOF_CRYPTOSUITE, 'proof carries eddsa-jcs-2022');
ok(signed.audit_signature.proof.proofValue[0] === 'z', 'proofValue is multibase z-base58btc');
ok(signed.execution_hash === base.execution_hash, '(d) signing did NOT mint a new execution_hash');
ok(signed.chaingraph_version === '0.4.0', '(d) signing did NOT bump chaingraph_version');

// (e) verify using a public key resolved from the did:key alone (caller path)
const resolvedPub = await didKeyToPublicKey(vm);
ok(await verify(signed, resolvedPub), '(a/e) sign -> verify round-trip via did:key-resolved key');

// (b) tamper detection
const tampHash = structuredClone(signed); tampHash.execution_hash = '0'.repeat(64);
ok(!(await verify(tampHash, resolvedPub)), '(b) tampered execution_hash fails verify');
const tampPayload = structuredClone(signed); tampPayload.output_payload.injected = true;
ok(!(await verify(tampPayload, resolvedPub)), '(b) tampered output_payload fails verify');
const tampSig = structuredClone(signed); tampSig.audit_signature.proof.proofValue = 'z' + 'A'.repeat(86);
ok(!(await verify(tampSig, resolvedPub)), '(b) tampered proofValue fails verify');

// (c) determinism — Ed25519 (RFC 8032) is deterministic; prove byte-identical proofValue
const signed2 = await sign(base, { verificationMethod: vm, created: CREATED, privateKey: kp.privateKey });
ok(signed.audit_signature.proof.proofValue === signed2.audit_signature.proof.proofValue, '(c) deterministic proofValue');

// (g) REGRESSION: an artifact with NO pre-existing audit_signature key MUST round-trip. Guards the
// securedDocument() empty-wrapper bug — sign() synthesizes a proof-only audit_signature, and verify's
// securedDocument() must strip that now-empty wrapper so the secured document matches the pre-sign doc.
// Before the fix this verified false 100% of the time (docHash diverged on the stray audit_signature:{}).
const bare = { record_type: 'approval', role: 'approver', subject_hash: 'sha256:abc' };
ok(!('audit_signature' in bare), '(g) fixture has no audit_signature pre-sign');
const signedBare = await sign(bare, { verificationMethod: vm, created: CREATED, privateKey: kp.privateKey });
ok(await verify(signedBare, await didKeyToPublicKey(vm)), '(g) sign -> verify round-trips with no pre-existing audit_signature');
const tampBare = structuredClone(signedBare); tampBare.role = 'attacker';
ok(!(await verify(tampBare, await didKeyToPublicKey(vm))), '(g) tamper still fails on no-pre-existing-audit_signature path');

// (h) REGRESSION: an artifact carrying an EMPTY audit_signature:{} pre-sign must also round-trip.
// 'absent' and '{}' are indistinguishable at verify time (both strip to {}), so securedDocument
// normalizes an empty audit_signature to absent at BOTH sign and verify — else this path diverges
// from (g) and one of the two cannot verify. (This is the case the §23 vc-2.0 input-attestation
// fixture exercises: it signs a credential with an explicit empty audit_signature:{}.)
const emptyWrap = { record_type: 'approval', role: 'approver', subject_hash: 'sha256:abc', audit_signature: {} };
const signedEmpty = await sign(emptyWrap, { verificationMethod: vm, created: CREATED, privateKey: kp.privateKey });
ok(await verify(signedEmpty, await didKeyToPublicKey(vm)), '(h) sign -> verify round-trips with an empty audit_signature:{} pre-sign');
const tampEmpty = structuredClone(signedEmpty); tampEmpty.role = 'attacker';
ok(!(await verify(tampEmpty, await didKeyToPublicKey(vm))), '(h) tamper still fails on empty-audit_signature path');

// ── (f) §16.5 proof sets + endorsement chains (countersignature fixture, OCG v0.7) ──────────────
const kpA = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const kpB = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const kpE = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);   // endorser
const vmA = await rawPubkeyToDidKey(kpA.publicKey);
const vmB = await rawPubkeyToDidKey(kpB.publicKey);
const vmE = await rawPubkeyToDidKey(kpE.publicKey);
const resolveKey = (did) => didKeyToPublicKey(did);

// parallel proof set of 2 independent signers over the same artifact
let setArt = await addProof(base, { verificationMethod: vmA, created: CREATED, privateKey: kpA.privateKey, id: 'urn:ocg:proof:a' });
setArt = await addProof(setArt, { verificationMethod: vmB, created: CREATED, privateKey: kpB.privateKey, id: 'urn:ocg:proof:b' });
ok(Array.isArray(setArt.audit_signature.proof) && setArt.audit_signature.proof.length === 2, '(f) proof set of 2 lives as an array at audit_signature.proof');
ok(await verifyProofs(setArt, resolveKey), '(f) parallel proof set of 2 verifies');
ok(setArt.execution_hash === base.execution_hash, '(f) proof set minted no new execution_hash');
ok(setArt.chaingraph_version === '0.4.0', '(f) proof set did not bump chaingraph_version');

// chained endorsement: E countersigns proof:a (previousProof references it)
const chained = await addProof(setArt, { verificationMethod: vmE, created: CREATED, privateKey: kpE.privateKey, id: 'urn:ocg:proof:endorse-a', previousProof: 'urn:ocg:proof:a' });
ok(chained.audit_signature.proof.length === 3, '(f) endorsement appended as third proof');
ok(chained.audit_signature.proof[2].previousProof === 'urn:ocg:proof:a', '(f) endorsement carries previousProof');
ok(await verifyProofs(chained, resolveKey), '(f) proof set of 2 + chained endorsement verifies in dependency order');

// broken previousProof MUST fail: (1) dangling reference, (2) endorsed proof tampered after endorsement
const dangling = structuredClone(chained);
dangling.audit_signature.proof[2].previousProof = 'urn:ocg:proof:missing';
ok(!(await verifyProofs(dangling, resolveKey)), '(f) dangling previousProof reference fails the chain');
const tampChain = structuredClone(chained);
tampChain.audit_signature.proof[0].proofValue = 'z' + 'A'.repeat(86);   // endorsed proof no longer what E signed
ok(!(await verifyProofs(tampChain, resolveKey)), '(f) tampering the endorsed proof breaks both its own verify and the endorsement');
const tampEndorse = structuredClone(chained);
tampEndorse.audit_signature.proof[2].proofValue = 'z' + 'B'.repeat(86);
ok(!(await verifyProofs(tampEndorse, resolveKey)), '(f) tampered endorsement proofValue fails');

// ── §22.11 (EXQ-1) — resume/exception record signing + hash-exclusion ──────────────────────────
// A resume message or exception record is a §16 signed artifact bound to a named human. The
// exception_class/exception_detail/item_state/resume_approval fields are hash-EXCLUDED (SPEC.md
// §22.11) — a record with and without them must hash identically.
const withoutExq = await buildArtifact(PP, { now: CREATED });
const withExq = structuredClone(withoutExq);
withExq.exception_class = 'business';
withExq.exception_detail = { type: 'business', code: 'bad_input', message: 'business rule rejected item' };
withExq.item_state = 'pending_human';
withExq.resume_approval = { required_events: 2, approver_group: 'ops-leads', resume_form: {}, timeout: '2026-08-01T00:00:00Z' };
ok(withExq.execution_hash === withoutExq.execution_hash, '(§22.11) record with/without exception_class/exception_detail/item_state/resume_approval hashes identically');

const kpResume = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const vmResume = await rawPubkeyToDidKey(kpResume.publicKey);
const signedResume = await sign(withExq, { verificationMethod: vmResume, created: CREATED, privateKey: kpResume.privateKey });
const resolvedResumePub = await didKeyToPublicKey(vmResume);
ok(await verify(signedResume, resolvedResumePub), '(§22.11) signed exception record — sign -> verify round-trip via named-human did:key');
ok(signedResume.execution_hash === withoutExq.execution_hash, '(§22.11) signing the exception record did not mint a new execution_hash');

// exception_class is hash-EXCLUDED (execution_hash unaffected), but the §16 proof covers the whole
// artifact — mutating it post-signature still breaks the SIGNATURE, same as any other tamper case.
const tampExqField = structuredClone(signedResume);
tampExqField.exception_class = 'application';
ok(tampExqField.execution_hash === signedResume.execution_hash, '(§22.11) mutated exception_class leaves execution_hash unchanged (hash-excluded scope)');
ok(!(await verify(tampExqField, resolvedResumePub)), '(§22.11) mutated exception_class after signing still fails proof verify (whole-artifact tamper-evidence)');

const tampExqSig = structuredClone(signedResume);
tampExqSig.audit_signature.proof.proofValue = 'z' + 'C'.repeat(86);
ok(!(await verify(tampExqSig, resolvedResumePub)), '(§22.11) tampered proofValue on a signed exception record fails verify');

// ── §PQC-1 (CW-2) — hybrid ML-DSA dual proof (NORMATIVE OPTIONAL, extends §16; SPEC.md §PQC-1) ──
// A hybrid signer appends an ML-DSA-65 (FIPS 204) proof alongside the classical eddsa-jcs-2022
// proof, BOTH over the same §16.1 secured document. Default-off: base/signed above never call
// addMldsaProof, so everything already asserted (byte-identical execution_hash, unsigned-shape,
// (b)/(c)/(d) fixtures) already stands as the "zero-PQC artifact stays fully conformant" proof —
// this block adds the hybrid-specific assertions only.
const mldsaKeys = mldsaKeygen(new Uint8Array(32).fill(11));
const mldsaVm = 'urn:ocg:mldsa-key:test-1';
const resolveHybridKey = (verificationMethod, cryptosuite) =>
  cryptosuite === MLDSA_PROOF_CRYPTOSUITE ? mldsaKeys.publicKey : didKeyToPublicKey(verificationMethod);

let hybrid = await addProof(base, { verificationMethod: vm, created: CREATED, privateKey: kp.privateKey, id: 'urn:ocg:proof:classical' });
hybrid = await addMldsaProof(hybrid, { verificationMethod: mldsaVm, created: CREATED, secretKey: mldsaKeys.secretKey, id: 'urn:ocg:proof:pq' });
ok(Array.isArray(hybrid.audit_signature.proof) && hybrid.audit_signature.proof.length === 2, '(PQC-1) hybrid proof set of 2 lives as an array at audit_signature.proof');
ok(hybrid.audit_signature.proof[0].cryptosuite === PROOF_CRYPTOSUITE && hybrid.audit_signature.proof[1].cryptosuite === MLDSA_PROOF_CRYPTOSUITE, '(PQC-1) proof set carries eddsa-jcs-2022 + ML-DSA-65, in that order');
ok(hybrid.execution_hash === base.execution_hash, '(PQC-1) hybrid proof set minted no new execution_hash');
ok(hybrid.chaingraph_version === '0.4.0', '(PQC-1) hybrid proof set did not bump chaingraph_version');
ok(await verifyProofs(hybrid, resolveHybridKey), '(PQC-1) hybrid proof set verifies both proofs independently');

// each proof ALSO verifies standalone (each is a full §16.1 secured-document signature, not a
// combined/aggregated scheme) — drop the other proof and confirm the remaining one still verifies.
const classicalOnlyView = structuredClone(hybrid);
classicalOnlyView.audit_signature.proof = [classicalOnlyView.audit_signature.proof[0]];
ok(await verifyProofs(classicalOnlyView, resolveHybridKey), '(PQC-1) classical proof verifies independently of the ML-DSA proof');
const pqOnlyView = structuredClone(hybrid);
pqOnlyView.audit_signature.proof = [pqOnlyView.audit_signature.proof[1]];
ok(await verifyProofs(pqOnlyView, resolveHybridKey), '(PQC-1) ML-DSA proof verifies independently of the classical proof');

// tampered body fails BOTH proofs, not just one
const tampHybrid = structuredClone(hybrid);
tampHybrid.execution_hash = '1'.repeat(64);
ok(!(await verifyProofs(tampHybrid, resolveHybridKey)), '(PQC-1) tampered body fails the full hybrid set');
const tampHybridClassicalOnly = structuredClone(tampHybrid);
tampHybridClassicalOnly.audit_signature.proof = [tampHybridClassicalOnly.audit_signature.proof[0]];
ok(!(await verifyProofs(tampHybridClassicalOnly, resolveHybridKey)), '(PQC-1) tampered body fails the classical proof alone');
const tampHybridPqOnly = structuredClone(tampHybrid);
tampHybridPqOnly.audit_signature.proof = [tampHybridPqOnly.audit_signature.proof[1]];
ok(!(await verifyProofs(tampHybridPqOnly, resolveHybridKey)), '(PQC-1) tampered body fails the ML-DSA proof alone');

// tampering only the ML-DSA proofValue leaves the classical proof (and hence single-proof
// eddsa-only conformance) completely unaffected — the two suites are independent, not entangled.
const tampMldsaOnly = structuredClone(hybrid);
tampMldsaOnly.audit_signature.proof[1].proofValue = 'z' + 'D'.repeat(100);
ok(!(await verifyProofs(tampMldsaOnly, resolveHybridKey)), '(PQC-1) tampered ML-DSA proofValue fails the hybrid set');
const tampMldsaOnlyClassicalView = structuredClone(tampMldsaOnly);
tampMldsaOnlyClassicalView.audit_signature.proof = [tampMldsaOnlyClassicalView.audit_signature.proof[0]];
ok(await verifyProofs(tampMldsaOnlyClassicalView, resolveHybridKey), '(PQC-1) classical proof still verifies when only the ML-DSA proofValue is tampered');

// an eddsa-ONLY artifact (this file's `signed` fixture, asserted throughout above) never calls
// addMldsaProof and stays a single (non-array) proof object — the "zero-PQC artifact is byte-
// identical and fully conformant" requirement, restated explicitly for this gate:
ok(!Array.isArray(signed.audit_signature.proof), '(PQC-1) an eddsa-only artifact keeps a single (non-array) proof — no PQC-1 shape leakage');
ok(signed.audit_signature.proof.cryptosuite === PROOF_CRYPTOSUITE, '(PQC-1) an eddsa-only artifact carries ONLY eddsa-jcs-2022 — no ML-DSA proof present');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all proof-binding assertions passed');
process.exit(fail ? 1 : 0);
