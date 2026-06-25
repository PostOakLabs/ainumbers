// proof-binding.test.mjs — §16 Proof Binding GATE (conformance-by-construction, SPEC.md §15).
// Asserts: (a) sign->verify round-trip; (b) tamper on execution_hash OR proofValue fails verify;
// (c) determinism (same artifact+key+created => byte-identical proofValue); (d) backward-compat
// (unsigned artifact unchanged + still hash-valid + signing mints no new execution_hash);
// (e) did:key round-trip resolves the public key for verification.
// Node 18+ (WebCrypto Ed25519).  Run:  node kernels/proof-binding.test.mjs
import { buildArtifact } from './art-04-agent-identity-attestation-checker.kernel.mjs';
import { sign, verify, rawPubkeyToDidKey, didKeyToPublicKey, PROOF_CRYPTOSUITE } from './_proof.mjs';
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

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all proof-binding assertions passed');
process.exit(fail ? 1 : 0);
