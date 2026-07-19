// policy-params-hash.test.mjs — §PPH-1 policy_parameters_hash GATE (SPEC.md §PPH-1, v0.8.10).
// Proves: the digest is the ONE canonical path over policy_parameters alone (§PPH-1.1), it is
// BARE hex accepted either-way by verifiers (§PPH-1.1a), it is EXCLUDED from the §4 preimage so
// adding it never moves execution_hash (§PPH-1.2), and a tampered/stale digest is detected
// prefix-insensitively (§PPH-1.3).
// Node 18+ (WebCrypto + node: builtins only — zero npm deps).
// Run:  node chaingraph/kernels/policy-params-hash.test.mjs
import { cgCanon, assertIJson, canonicalPreimage, executionHash } from './_hash.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const SHA256REF = /^(sha256:)?[0-9a-f]{64}$/; // #/$defs/sha256ref — prefix OPTIONAL

// §PPH-1.1 reference implementation: SHA-256 over the JCS canonical form of policy_parameters
// ALONE, through cgCanon — the same canonicalizer §4 uses. Never a second canonicalization.
//
// NOTE the JSON.stringify: cgCanon returns a key-SORTED OBJECT, not a string. Encoding its return
// value directly yields "[object Object]" — a CONSTANT digest (b28c94b2…) for every input, which
// still passes a determinism check and fails ONLY under a mutation check. That trap fired for real
// while this gate was being written; the mutation assertions at the bottom are what caught it and
// they are load-bearing. §PPH-1.1 warns about it in normative text. Do not "simplify" this line.
//
// §PPH-1.1a: emits the BARE form, which is what producers SHOULD emit (this is the same call path
// executionHash() uses, and it returns bare hex — see the "No sha256: prefix" comment in _hash.mjs).
async function policyParametersHash(policy_parameters) {
  assertIJson(policy_parameters); // same I-JSON rejection §4 applies — never emit an unstable hash
  const bytes = new TextEncoder().encode(JSON.stringify(cgCanon(policy_parameters)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// §PPH-1.3 verifier: strips the OPTIONAL prefix and compares the 64 hex chars. MUST NOT care
// whether the stored value carries the prefix.
const bare = (v) => String(v).replace(/^sha256:/, '');
async function verifyPPH(artifact) {
  return bare(artifact.policy_parameters_hash) === await policyParametersHash(artifact.policy_parameters);
}

// A representative artifact's hashed members. Key order is deliberately NOT sorted here, so the
// JCS sort in cgCanon is exercised rather than accidentally satisfied by insertion order.
const policy_parameters = {
  execution_backend: 'server',
  input_parameters: { zeta: 3, alpha: 'a', nested: { b: false, a: [2, 1] } }
};
const output_payload = { result: 42, note: 'representative' };

const pph = await policyParametersHash(policy_parameters);
const baseHash = await executionHash(policy_parameters, output_payload);

// ---- §PPH-1.1 / §PPH-1.1a: shape, canon path, value form -------------------------------------
ok(SHA256REF.test(pph), `digest matches #/$defs/sha256ref (${pph.slice(0, 16)}…)`);
ok(!pph.startsWith('sha256:'), '§PPH-1.1a: producer emits the BARE form (what the shared path returns)');
ok(SHA256REF.test('sha256:' + pph), '§PPH-1.1a: the prefixed form is ALSO schema-valid (either accepted)');
ok(pph !== baseHash, 'digest is NOT the execution_hash (covers policy_parameters alone, not the pair)');

// Key-order independence: a re-keyed but equal object MUST digest identically.
const reKeyed = {
  input_parameters: { nested: { a: [2, 1], b: false }, alpha: 'a', zeta: 3 },
  execution_backend: 'server'
};
ok(await policyParametersHash(reKeyed) === pph, 'JCS canonicalization makes the digest key-order independent');
ok(await policyParametersHash(policy_parameters) === pph, 'digest is stable across repeat computation (determinism)');

// It really is policy_parameters ALONE: an output_payload change moves execution_hash, not this.
ok(await executionHash(policy_parameters, { result: 43 }) !== baseHash, 'control: a different output_payload DOES move execution_hash');
ok(await policyParametersHash(policy_parameters) === pph, 'digest unmoved by an output_payload change (covers policy_parameters alone)');

// ---- §PPH-1.2 THE EXCLUSION PROOF ------------------------------------------------------------
// Build the with-field and without-field artifacts. The assertion must be NON-VACUOUS: comparing
// canonicalPreimage() over the same two inputs proves nothing, since executionHash() never receives
// an artifact at all. So we assert BOTH halves: (a) the member DOES materially change the
// artifact's own canonical form — it is really present, not a no-op — and (b) the §4 preimage and
// execution_hash are nevertheless byte-identical. Together those say: present in the artifact,
// absent from the hash. Either half alone would be vacuous.
const withoutField = { tool_id: 'representative', execution_hash: baseHash, policy_parameters, output_payload };
const withField = { ...withoutField, policy_parameters_hash: pph };

ok(JSON.stringify(cgCanon(withField)) !== JSON.stringify(cgCanon(withoutField)),
   'the member DOES change the artifact\'s canonical form (it is materially present — makes the next assertion non-vacuous)');
ok(canonicalPreimage(withField.policy_parameters, withField.output_payload)
   === canonicalPreimage(withoutField.policy_parameters, withoutField.output_payload),
   '§4 preimage is byte-identical with and without the member');
ok(await executionHash(withField.policy_parameters, withField.output_payload) === baseHash,
   'execution_hash is byte-identical with and without the member (member is hash-EXCLUDED)');
ok(withField.execution_hash === withoutField.execution_hash,
   'the recorded execution_hash does not move when the member is added (additive: goldens stay pinned)');

// Exclusion is also true BY CONSTRUCTION of the API: executionHash() takes only the two §4 inputs,
// so there is no call in which the member could participate. Assert that construction explicitly.
ok(executionHash.length === 2, 'executionHash() takes exactly the two §4 inputs — the member cannot reach the preimage');

// §PPH-1.2 — absence carries no meaning: the without-field artifact is conformant as-is.
ok(!('policy_parameters_hash' in withoutField), 'an artifact omitting the member is unchanged (absence is conformant, never a defect)');

// ---- §PPH-1.3 verification, prefix-insensitive ------------------------------------------------
ok(await verifyPPH(withField), 'verifier accepts the BARE stored form');
ok(await verifyPPH({ ...withField, policy_parameters_hash: 'sha256:' + pph }), 'verifier accepts the PREFIXED stored form (MUST NOT fail on prefix presence)');

ok(!await verifyPPH({ ...withField, policy_parameters_hash: '0'.repeat(64) }),
   'a tampered digest is detected by recomputation from the artifact\'s own policy_parameters');
ok(!await verifyPPH({ ...withField, policy_parameters: { ...policy_parameters, execution_backend: 'browser' } }),
   'a mutated policy_parameters under a stale digest is detected');

console.log(fail ? `\n${fail} failure(s).` : '\nAll §PPH-1 policy_parameters_hash checks passed.');
process.exit(fail ? 1 : 0);
