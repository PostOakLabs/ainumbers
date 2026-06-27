// kernel-identity.test.mjs — §17 Kernel Identity Binding GATE (conformance-by-construction, SPEC.md §15).
// Asserts: (det) sourceDigest is deterministic + LF-normalized (CRLF == LF); (a) buildIdentity+attach sets
// audit_signature.build_identity; (cross) the §17.1 three-way cross-check (artifact == recomputed source ==
// Graph Index compute_images) passes for a faithful digest and FAILS on any tamper; (d) backward-compat —
// attaching build_identity mints no new execution_hash, no chaingraph_version bump, and an artifact without
// build_identity has no §17 binding.
// Node 18+ (WebCrypto SHA-256).  Run:  node kernels/kernel-identity.test.mjs
import { readFileSync } from 'node:fs';
import { buildArtifact } from './art-04-agent-identity-attestation-checker.kernel.mjs';
import { sourceDigest, buildIdentity, attachBuildIdentity, verifyBuildIdentity, normalizeSource, BUILDID_BUILDTYPE } from './_buildid.mjs';
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

// Real kernel source bytes — the §17 digest is over the deployed kernel file.
const KSRC = readFileSync(new URL('./art-04-agent-identity-attestation-checker.kernel.mjs', import.meta.url), 'utf8');
const digest = await sourceDigest(KSRC);
ok(/^sha256:[0-9a-f]{64}$/.test(digest), 'sourceDigest is a sha256:-prefixed 64-hex digest');

// (det) deterministic + LF-normalized: same text -> same digest; CRLF -> LF gives the SAME digest.
const digest2 = await sourceDigest(KSRC);
ok(digest === digest2, '(det) sourceDigest deterministic for identical source');
const crlf = normalizeSource('a\r\nb').length === 3 && normalizeSource('a\r\nb') === 'a\nb';
ok(crlf, '(det) normalizeSource collapses CRLF -> LF');
const dLf = await sourceDigest('line1\nline2\n');
const dCrlf = await sourceDigest('line1\r\nline2\r\n');
ok(dLf === dCrlf, '(det) CRLF and LF source produce the SAME digest (OS / autocrlf safe)');

const base = await buildArtifact(PP, { now: CREATED });
ok(!base.audit_signature.build_identity, '(d) unsigned artifact has no audit_signature.build_identity');
ok(!verifyBuildIdentity(base, { recomputedDigest: digest }), '(d) artifact without build_identity has no §17 binding');

const bi = await buildIdentity(KSRC, { buildType: BUILDID_BUILDTYPE, source_ref: 'kernels/art-04-agent-identity-attestation-checker.kernel.mjs' });
const bound = attachBuildIdentity(base, bi);
ok(bound.audit_signature.build_identity.kernel_digest === digest, '(a) build_identity records the kernel_digest');
ok(bound.audit_signature.build_identity.buildType === BUILDID_BUILDTYPE, '(a) build_identity records the buildType');

// (d) backward-compat — attaching build_identity changes NOTHING in the hash preimage / envelope tag.
ok(bound.execution_hash === base.execution_hash, '(d) attaching build_identity mints no new execution_hash');
ok(bound.execution_hash === await executionHash(PP, bound.output_payload), '(d) execution_hash still valid');
ok(bound.chaingraph_version === '0.4.0', '(d) chaingraph_version stays 0.4.0');

// (cross) §17.1 three-way cross-check — artifact == recomputed source == Graph Index compute_images.
const published = [digest]; // node.compute_images[].image_id (system "sha256-source")
ok(verifyBuildIdentity(bound, { recomputedDigest: digest, publishedImageIds: published }), '(cross) three-way cross-check passes for a faithful digest');

// (cross/tamper) any leg disagreeing fails the binding.
ok(!verifyBuildIdentity(bound, { recomputedDigest: 'sha256:' + '0'.repeat(64), publishedImageIds: published }), '(cross) wrong recomputed source digest fails');
ok(!verifyBuildIdentity(bound, { recomputedDigest: digest, publishedImageIds: ['sha256:' + '1'.repeat(64)] }), '(cross) digest not published in compute_images fails');
const tampered = structuredClone(bound); tampered.audit_signature.build_identity.kernel_digest = 'sha256:' + 'a'.repeat(64);
ok(!verifyBuildIdentity(tampered, { recomputedDigest: digest, publishedImageIds: published }), '(cross) tampered recorded kernel_digest fails');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all kernel-identity (§17) assertions passed');
process.exit(fail ? 1 : 0);
