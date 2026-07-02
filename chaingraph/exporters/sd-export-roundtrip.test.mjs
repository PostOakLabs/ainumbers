// sd-export-roundtrip.test.mjs — §13.12 SD-JWT selective-disclosure export GATE (SPEC.md §15, v0.7).
// Asserts, per the v0.7 delta:
//   (a) export with 2 inputs redacted -> verify with disclosures MUST pass;
//   (b) digest mismatch MUST fail (tampered disclosure value);
//   (c) always-disclosed set MUST be complete — the gate fails if an input leaks into
//       always-disclosed cleartext or an output becomes redactable;
//   (d) salts are freshly CSPRNG-generated per export (the one permitted nondeterminism) — two
//       exports of the same artifact differ in disclosure bytes yet both verify, and the envelope
//       (execution_hash) is untouched;
//   (e) signature is JWS EdDSA under the §16 signing key (kid = §16 verificationMethod);
//       a wrong key MUST fail verification.
// Node 18+ (WebCrypto Ed25519).  Run:  node chaingraph/exporters/sd-export-roundtrip.test.mjs
import { buildArtifact } from '../kernels/art-04-agent-identity-attestation-checker.kernel.mjs';
import { rawPubkeyToDidKey } from '../kernels/_proof.mjs';
import { exportSdJwt, presentSdJwt, verifySdJwt, assertProfileShape, inputContainer } from './sdjwt.mjs';
import { decodeSdJwt } from './_sdjwt-core.bundle.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const enc = (s) => new TextEncoder().encode(s);
const hasher = async (data) => new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc(data) : data));
const b64u = (u8) => Buffer.from(u8).toString('base64url');

const PP = {
  credential: {
    credential_type: 'AgentCredential', agent_id: 'a1', issuer: 'did:key:zStub',
    issued_at: 1, expires_at: 4102444800, scopes: ['read:account'], signature: 'ed25519:zz',
  },
  validate_at_unix: 1750000000,
  // third input so the delta's "2 inputs redacted" still leaves a disclosure to verify with;
  // the kernel ignores unknown inputs but the §4 hash anchors them like any decision input
  requester_context: 'sd-export-gate-fixture',
};
const artifact = await buildArtifact(PP, { now: '2026-07-02T00:00:00Z' });
const { keys: inputKeys } = inputContainer(artifact);
ok(inputKeys.length >= 3, `fixture artifact has >= 3 top-level input values (${inputKeys.join(', ')})`);

const kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const vm = await rawPubkeyToDidKey(kp.publicKey);

// (e) export under the §16 signing key
const exp1 = await exportSdJwt(artifact, { privateKey: kp.privateKey, verificationMethod: vm, spec_version: '0.7.0', compute_capability: 'server' });
ok(exp1.media_type === 'application/sd-jwt', '(e) media type application/sd-jwt');
const decoded = await decodeSdJwt(exp1.sd_jwt, hasher);
ok(decoded.jwt.header.alg === 'EdDSA', '(e) JWS alg is EdDSA');
ok(decoded.jwt.header.kid === vm, '(e) kid carries the §16 verificationMethod');
ok(decoded.disclosures.length === inputKeys.length, `(c) exactly the ${inputKeys.length} top-level inputs are disclosable`);

// (c) always-disclosed completeness / redactability split
let shapeOk = true; let shapeErr = '';
try { await assertProfileShape(exp1.sd_jwt, artifact); } catch (e) { shapeOk = false; shapeErr = e.message; }
ok(shapeOk, '(c) always-disclosed set complete; inputs redactable; outputs not redactable' + (shapeErr ? ` [${shapeErr}]` : ''));
ok(decoded.jwt.payload.execution_hash === artifact.execution_hash, '(c) execution_hash rides cleartext and untouched');

// (a) redact 2 inputs -> verify with remaining disclosures passes
const keepKey = inputKeys[0];
const redacted = await presentSdJwt(exp1.sd_jwt, { policy_parameters: { [keepKey]: true } });
const redactedDecoded = await decodeSdJwt(redacted, hasher);
ok(redactedDecoded.disclosures.length === inputKeys.length - 2, `(a) 2 inputs redacted, ${inputKeys.length - 2} disclosure(s) kept`);
const v1 = await verifySdJwt(redacted, kp.publicKey);
ok(v1.ok, '(a) redacted export verifies with disclosures (issuer signature + digest binding)');
ok(v1.ok && v1.payload.execution_hash === artifact.execution_hash, '(a) verified payload still binds execution_hash');
ok(v1.ok && JSON.stringify(v1.payload.output_payload) === JSON.stringify(artifact.output_payload), '(a) all outputs present after redaction');

// (b) digest mismatch MUST fail: tamper the kept disclosure's value
const parts = redacted.split('~');
const disclosureIdx = parts.length - 2; // [jwt, ...disclosures, ''] — last disclosure before trailing ~
const tamperedDisclosure = JSON.parse(Buffer.from(parts[disclosureIdx], 'base64url').toString('utf8'));
tamperedDisclosure[2] = 'tampered-value';
parts[disclosureIdx] = b64u(enc(JSON.stringify(tamperedDisclosure)));
const tampered = parts.join('~');
const v2 = await verifySdJwt(tampered, kp.publicKey);
ok(!v2.ok, '(b) tampered disclosure value (digest mismatch) fails verification');

// (b2) tampered always-disclosed payload fails the JWS
const [h, p, s] = parts[0].split('.');
const payloadObj = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
payloadObj.execution_hash = '0'.repeat(64);
const forged = [h, b64u(enc(JSON.stringify(payloadObj))), s].join('.') + '~' + parts.slice(1).join('~');
const v3 = await verifySdJwt(forged, kp.publicKey);
ok(!v3.ok, '(b) tampered always-disclosed execution_hash fails the JWS');

// (e2) wrong key fails
const kp2 = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const v4 = await verifySdJwt(redacted, kp2.publicKey);
ok(!v4.ok, '(e) verification under a different key fails');

// (d) fresh CSPRNG salts per export — disclosures differ across exports, both verify, envelope untouched
const exp2 = await exportSdJwt(artifact, { privateKey: kp.privateKey, verificationMethod: vm, spec_version: '0.7.0', compute_capability: 'server' });
ok(exp1.sd_jwt !== exp2.sd_jwt, '(d) two exports differ (fresh salts — the one permitted nondeterminism)');
const d1 = (await decodeSdJwt(exp1.sd_jwt, hasher)).disclosures.map((d) => d.salt).sort();
const d2 = (await decodeSdJwt(exp2.sd_jwt, hasher)).disclosures.map((d) => d.salt).sort();
ok(JSON.stringify(d1) !== JSON.stringify(d2), '(d) disclosure salts are fresh per export');
ok((await verifySdJwt(exp2.sd_jwt, kp.publicKey)).ok, '(d) second export verifies too');
ok(artifact.execution_hash === (await buildArtifact(PP, { now: '2026-07-02T00:00:00Z' })).execution_hash, '(d) export never touches the envelope/execution_hash');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all sd-export-roundtrip assertions passed');
process.exit(fail ? 1 : 0);
