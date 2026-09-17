#!/usr/bin/env node
// fv-keyless-sign-lane.test.mjs — proven-to-reject fixtures for FV-KEYLESS-SIGN-LANE-1.
//
// Covers the keyless lane ADDED to fv-sigsum-upgrade-flip.mjs by this row: the bundle-binding
// pre-check, the identity stamping in runFlip, and the explicit-only witness deferral. The
// SSHSIG path's own fixtures stay in fv-sigsum-upgrade-flip.test.mjs, untouched.
//
// ⚠ WHAT THESE FIXTURES ARE NOT. Every bundle below is SYNTHETIC and locally constructed —
// no Fulcio certificate, no Rekor entry, no signature of any kind is real here, and nothing in
// this file is evidence that a live keyless signing run happened. These fixtures prove the
// lane's REFUSAL logic (wrong artifact, wrong workflow identity, wrong issuer, no log entry,
// unpinned verify) and its stamping logic. The cryptographic verification is delegated to
// `cosign verify-blob --offline` / `gh attestation verify --custom-trusted-root`, which the
// lane always runs and which cannot be exercised on this machine (no OIDC token, no network) —
// that leg is quoted from a live run at check-off, never asserted from here.
//
// RED-before-green throughout: each guard is shown refusing the case it exists to refuse
// before the calibration case is shown passing.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKeylessBundleBinding,
  keylessSign,
  runFlip,
  KEYLESS_OIDC_ISSUER,
  KEYLESS_SIGNING_IDENTITY_NATURE,
} from './fv-sigsum-upgrade-flip.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const artifactFixtures = JSON.parse(readFileSync(resolve(HERE, 'fv-sigsum-upgrade-flip.fixtures.json'), 'utf8'));
const gateFixtures = JSON.parse(readFileSync(resolve(HERE, 'fv-policy-sign-gate.fixtures.json'), 'utf8'));

const IDENTITY = 'https://github.com/PostOakLabs/ainumbers/.github/workflows/land-verify.yml@refs/heads/main';
const DIGEST = 'ab'.repeat(32);
// The Fulcio OIDC-issuer extension OID (1.3.6.1.4.1.57264.1.8) in DER encoding — the same
// bytes the lane looks for, restated here independently rather than imported, so a typo in the
// lane's constant cannot silently agree with a typo in the fixture.
const ISSUER_OID_DER = Buffer.from([0x2b, 0x06, 0x01, 0x04, 0x01, 0xd9, 0x79, 0x01, 0x08]);

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function expectThrow(fn, pattern, what) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, `expected a refusal for ${what}, got none`);
  assert(pattern.test(err.message), `expected ${what} refusal to match ${pattern}, got: ${err.message}`);
  return err;
}

// SYNTHETIC certificate bytes — a buffer that merely CONTAINS the strings and the OID a real
// Fulcio cert would carry. Not a parseable X.509 certificate and not offered as one.
function synthCertBytes({ identity = IDENTITY, issuer = KEYLESS_OIDC_ISSUER, withOid = true } = {}) {
  const parts = [Buffer.from('SYNTHETIC-TEST-CERT\0', 'utf8'), Buffer.from(identity, 'utf8'), Buffer.from(issuer, 'utf8')];
  if (withOid) parts.push(ISSUER_OID_DER);
  return Buffer.concat(parts);
}

function synthBlobBundle({ digestHex = DIGEST, identity, issuer, withOid = true, tlog = true, mediaType = 'application/vnd.dev.sigstore.bundle.v0.3+json' } = {}) {
  return {
    mediaType,
    verificationMaterial: {
      certificate: { rawBytes: synthCertBytes({ identity, issuer, withOid }).toString('base64') },
      tlogEntries: tlog ? [{ logIndex: '1234', integratedTime: '1757000000' }] : [],
    },
    messageSignature: {
      messageDigest: { algorithm: 'SHA2_256', digest: Buffer.from(digestHex, 'hex').toString('base64') },
      signature: 'c3ludGhldGlj',
    },
  };
}

function synthAttestBundle({ digestHex = DIGEST } = {}) {
  const statement = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'fv-artifact', digest: { sha256: digestHex } }],
    predicateType: 'https://slsa.dev/provenance/v1',
  };
  return {
    mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    verificationMaterial: {
      certificate: { rawBytes: synthCertBytes().toString('base64') },
      tlogEntries: [{ logIndex: '99', integratedTime: '1757000000' }],
    },
    dsseEnvelope: {
      payloadType: 'application/vnd.in-toto+json',
      payload: Buffer.from(JSON.stringify(statement), 'utf8').toString('base64'),
      signatures: [{ sig: 'c3ludGhldGlj' }],
    },
  };
}

// ── assertKeylessBundleBinding — the refusals ───────────────────────────────

await test('OBSERVED RED — refuses a bundle bound to a DIFFERENT artifact digest (tamper)', () => {
  const bundle = synthBlobBundle({ digestHex: 'cd'.repeat(32) });
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /not bound to this artifact/, 'digest mismatch');
});

await test('OBSERVED RED — refuses a bundle signed by a DIFFERENT workflow identity', () => {
  const bundle = synthBlobBundle({ identity: 'https://github.com/attacker/evil/.github/workflows/pwn.yml@refs/heads/main' });
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /pinned --certificate-identity .* not present/, 'identity mismatch');
});

await test('OBSERVED RED — refuses a bundle from a DIFFERENT OIDC issuer', () => {
  const bundle = synthBlobBundle({ issuer: 'https://accounts.google.com' });
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /pinned --certificate-oidc-issuer .* not present/, 'issuer mismatch');
});

await test('OBSERVED RED — refuses a bundle with NO transparency-log entry', () => {
  const bundle = synthBlobBundle({ tlog: false });
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /no transparency-log entry/, 'missing tlog entry');
});

await test('OBSERVED RED — refuses a certificate carrying no Fulcio OIDC-issuer extension', () => {
  const bundle = synthBlobBundle({ withOid: false });
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /no Fulcio OIDC-issuer extension/, 'non-Fulcio certificate');
});

await test('OBSERVED RED — refuses an UNPINNED verify (no --certificate-identity)', () => {
  const bundle = synthBlobBundle();
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: undefined }),
    /no --certificate-identity pinned/, 'unpinned identity');
});

await test('OBSERVED RED — refuses a non-Sigstore envelope (wrong mediaType)', () => {
  const bundle = synthBlobBundle({ mediaType: 'application/json' });
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /unrecognised mediaType/, 'wrong mediaType');
});

await test('OBSERVED RED — refuses a bundle with a certificate but no subject digest at all', () => {
  const bundle = synthBlobBundle();
  delete bundle.messageSignature;
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /carries no subject digest/, 'no subject digest');
});

await test('OBSERVED RED — refuses a bundle with no signing certificate', () => {
  const bundle = synthBlobBundle();
  delete bundle.verificationMaterial.certificate;
  expectThrow(() => assertKeylessBundleBinding({ bundle, digestHex: DIGEST, certificateIdentity: IDENTITY }),
    /no signing certificate/, 'no certificate');
});

// ── assertKeylessBundleBinding — the calibration cases ──────────────────────

await test('calibration — accepts a well-formed cosign sign-blob bundle bound to this digest', () => {
  const r = assertKeylessBundleBinding({ bundle: synthBlobBundle(), digestHex: DIGEST, certificateIdentity: IDENTITY });
  assert(r.ok === true, 'expected ok=true');
  assert(r.digests.includes(DIGEST), 'expected the artifact digest among the bundle subject digests');
  assert(r.tlogEntryCount === 1, `expected 1 tlog entry, got ${r.tlogEntryCount}`);
  assert(r.certificateOidcIssuer === KEYLESS_OIDC_ISSUER, 'issuer must default to the GitHub Actions OIDC issuer');
});

await test('calibration — accepts an actions/attest DSSE bundle whose in-toto subject carries this digest', () => {
  const r = assertKeylessBundleBinding({ bundle: synthAttestBundle(), digestHex: DIGEST, certificateIdentity: IDENTITY });
  assert(r.ok === true, 'expected ok=true for the DSSE/in-toto shape');
  assert(r.digests.includes(DIGEST), 'expected the in-toto subject digest to be read');
});

// ── keylessSign refuses to sign into an unpinnable verify ───────────────────

await test('OBSERVED RED — keylessSign refuses without a pinned certificateIdentity (never reaches cosign)', () => {
  expectThrow(() => keylessSign({ message: Buffer.from(DIGEST, 'utf8') }),
    /requires certificateIdentity/, 'keylessSign without identity');
});

// ── runFlip with an injected keyless signer ────────────────────────────────

function fakeKeylessSign() {
  return {
    bundlePath: '/tmp/keyless-signature.sigstore.json',
    signingIdentityNature: KEYLESS_SIGNING_IDENTITY_NATURE,
    certificateIdentity: IDENTITY,
    certificateOidcIssuer: KEYLESS_OIDC_ISSUER,
    verifyCommand: 'cosign verify-blob --bundle … --offline --certificate-identity … --certificate-oidc-issuer …',
  };
}

function fakeSshSign() {
  return { armoredText: '-----BEGIN SSH SIGNATURE-----\nfake\n-----END SSH SIGNATURE-----\n' };
}

function fakeRegisterAndVerify({ digestHex, outDir }) {
  const recordPath = join(outDir, `sigsum-record-${digestHex.slice(0, 16)}.json`);
  const record = {
    anchor_type: 'c2sp-tlog-proof-v1',
    log_url: 'https://seasalp.glasklar.is',
    anchored_hash: `sha256:${digestHex}`,
    tree_head: { size: 12345, root_hash: 'aa'.repeat(32) },
    inclusion_proof: { leaf_index: 999, path: [] },
  };
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  return { recordPath, record, verifyJson: { ALL_PASS: true } };
}

async function withArtifact(fn) {
  const workDir = mkdtempSync(join(tmpdir(), 'fv-keyless-lane-test-'));
  try {
    const artifactPath = join(workDir, 'artifact.json');
    const artifact = JSON.parse(JSON.stringify(artifactFixtures.expired_upgraded_artifact));
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    return await fn({ workDir, artifactPath, artifact });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

await test('keyless flip stamps signing_identity_nature: ci-oidc-workflow-identity and both pins', async () => {
  await withArtifact(async ({ workDir, artifactPath, artifact }) => {
    const result = await runFlip({
      artifactPath, artifact, gateEvidence: gateFixtures.eligible_example,
      sign: fakeKeylessSign, registerAndVerify: fakeRegisterAndVerify, outDir: workDir, dryRun: false,
    });
    assert(result.flipped === true, `expected flipped=true, got reason: ${result.reason}`);
    const entry = result.historyEntry;
    assert(entry.signing_identity_nature === 'ci-oidc-workflow-identity', `expected the §7a keyless identity value, got ${entry.signing_identity_nature}`);
    assert(entry.keyless_certificate_identity === IDENTITY, 'the pinned workflow identity must be recorded on the artifact');
    assert(entry.keyless_certificate_oidc_issuer === KEYLESS_OIDC_ISSUER, 'the pinned OIDC issuer must be recorded on the artifact');
    assert(entry.sigsum_leaf_index === 999, 'the default per-artifact Sigsum witness leg still runs for the keyless signer');
    assert(!('attestation_grade' in entry), '⛔ §7a: this lane must NEVER write attestation_grade — the grade records policy validation, never identity');
    assert(entry.attestation_basis === 'challenge-window-expiry', 'the existing attestation_basis is restated, never overwritten');
  });
});

await test('SSHSIG flip entry is UNCHANGED by this row — no identity fields appear for a signer that reports none', async () => {
  await withArtifact(async ({ workDir, artifactPath, artifact }) => {
    const result = await runFlip({
      artifactPath, artifact, gateEvidence: gateFixtures.eligible_example,
      sign: fakeSshSign, registerAndVerify: fakeRegisterAndVerify, outDir: workDir, dryRun: false,
    });
    const entry = result.historyEntry;
    assert(entry.ssh_signature_present === true, 'the SSHSIG leg still reports its signature');
    assert(!('signing_identity_nature' in entry), 'no identity field may appear on the SSHSIG path — that entry stays byte-identical to the pre-row shape');
    assert(!('keyless_bundle_file' in entry), 'no keyless field may appear on the SSHSIG path');
    assert(entry.sigsum_leaf_index === 999, 'the SSHSIG path still carries the Sigsum leaf reference');
  });
});

// ── witness deferral is EXPLICIT ONLY ──────────────────────────────────────

await test('OBSERVED RED — witness deferral is never implicit: without the flag the Sigsum leaf leg still runs', async () => {
  await withArtifact(async ({ workDir, artifactPath, artifact }) => {
    let called = 0;
    const result = await runFlip({
      artifactPath, artifact, gateEvidence: gateFixtures.eligible_example,
      sign: fakeKeylessSign,
      registerAndVerify: (a) => { called++; return fakeRegisterAndVerify(a); },
      outDir: workDir, dryRun: false,
    });
    assert(called === 1, `expected the Sigsum witness leg to run exactly once by default, ran ${called} times`);
    assert(result.witnessDeferredTo === null, 'no deferral may be recorded when none was asked for');
    assert(!('sigsum_witness' in result.historyEntry), 'the default entry carries a real leaf, not a deferral marker');
  });
});

await test('explicit deferral names the successor row in status_history and says the witness is absent', async () => {
  await withArtifact(async ({ workDir, artifactPath, artifact }) => {
    let called = 0;
    const result = await runFlip({
      artifactPath, artifact, gateEvidence: gateFixtures.eligible_example,
      sign: fakeKeylessSign,
      registerAndVerify: (a) => { called++; return fakeRegisterAndVerify(a); },
      outDir: workDir, dryRun: false,
      witnessDeferredTo: 'FV-SIGSUM-LOGROOT-WATCH-1',
    });
    assert(called === 0, 'a deferred witness leg must not register a per-artifact Sigsum leaf');
    const entry = result.historyEntry;
    assert(entry.sigsum_witness === 'deferred-to-log-root', 'the deferral must be marked on the artifact');
    assert(entry.sigsum_witness_deferred_to === 'FV-SIGSUM-LOGROOT-WATCH-1', 'the successor row must be named on the artifact');
    assert(/no third-party witness cosignature over this artifact/.test(entry.reason),
      `the reason must state the absence in words, got: ${entry.reason}`);
    assert(!('sigsum_leaf_index' in entry), 'a deferred entry must not claim a leaf index it does not have');

    const onDisk = JSON.parse(readFileSync(artifactPath, 'utf8'));
    assert(onDisk.status_history.length === 2, `expected 2 status_history entries, got ${onDisk.status_history.length}`);
    assert(onDisk.status_history[0].actor === 'check-fv-provisional-expiry.mjs', 'the original expiry entry must be preserved');
  });
});

await test('guards are signer-agnostic — the keyless signer is never called for an ineligible flip', async () => {
  await withArtifact(async ({ workDir, artifactPath }) => {
    const artifact = JSON.parse(JSON.stringify(artifactFixtures.still_provisional_artifact));
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    const before = readFileSync(artifactPath, 'utf8');
    let signed = 0;
    const result = await runFlip({
      artifactPath, artifact, gateEvidence: gateFixtures.eligible_example,
      sign: () => { signed++; return fakeKeylessSign(); },
      registerAndVerify: fakeRegisterAndVerify, outDir: workDir, dryRun: false,
      witnessDeferredTo: 'FV-SIGSUM-LOGROOT-WATCH-1',
    });
    assert(result.flipped === false, 'expected the PROVISIONAL guard to refuse');
    assert(signed === 0, 'a refused flip must never reach the signer');
    assert(readFileSync(artifactPath, 'utf8') === before, 'a refused flip must never touch the artifact file');
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
