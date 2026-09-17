#!/usr/bin/env node
// fv-sigsum-upgrade-flip.mjs — FV-SIGSUM-UPGRADE-FLIP-1
//
// WHAT THIS IS: wires Sigsum registration into the PROVISIONAL -> SIGNED
// upgrade path. `check-fv-provisional-expiry.mjs` already flips an expired,
// unchallenged artifact's `status` to canonical and appends its own
// status_history entry (attestation_basis: "challenge-window-expiry"). This
// script runs AFTER that, once `fv-policy-sign-gate.mjs` says the artifact
// is eligible for machine sign-off, and adds the WITNESSED countersignature:
//   (a) sign the artifact's content digest with the CI policy SSHSIG key
//       (namespace fv-policy-sign@ainumbers.co — see helm/hub/extsig.mjs,
//       FV-SSHSIG-POLICY-KEY-1; that key/secret lives in the helm repo's CI,
//       out of this repo's fence, so `sign` is an INJECTED function here —
//       see `sshKeygenSign`/`sshKeygenVerify` below for the real
//       implementation this repo's own CLI wires by default)
//   (b) register the digest with Sigsum via the EXISTING, unmodified
//       register-sigsum.mjs (spawned as a subprocess — never re-implemented,
//       never edited: SIGSUM-NAMED-POLICY-1 owns that file's pinned policy)
//   (c) store the full offline-verifiable Sigsum record beside the artifact
//   (d) append ONE status_history entry carrying the Sigsum leaf reference
//
// CHAINPOINT GUARD (SO #0, absolute) holds transitively: this script's own
// "verify" leg is register-sigsum.mjs's `verify` command, which never calls
// the log — every byte it checks was fetched once at registration time.
//
// FAIL-CLOSED GUARD: this script refuses to touch an artifact whose
// `status` still reads "PROVISIONAL" — that means check-fv-provisional-expiry.mjs
// has not run the expiry flip yet, and the gate's own challengeWindow
// predicate (consumed from the CALLER's evidence, not re-derived here) is
// the caller's attestation that the window ran its course. This script
// re-checks the artifact's own on-disk state as a second, independent guard
// against a caller passing stale or mismatched gate evidence.
//
// RATE LIMIT (288/24h per domain suffix, register-sigsum.mjs's own note):
// this script registers ONE digest per flip call. When artifact volume
// exceeds what individual registrations can sustain, the documented
// mitigation is the manifest-signing pattern already used elsewhere in this
// estate — register ONE root over a digest manifest (a small Merkle/list
// commitment of many artifact digests) instead of one leaf per artifact.
// Not built here: FIXTURE volume is one artifact, and building batching
// machinery for a batch size of one would be speculative. The row this
// script closes states the pattern; a future row builds it if/when routine
// PROVISIONAL artifacts actually ship in volume.
//
// Usage:
//   node fv-sigsum-upgrade-flip.mjs flip \
//     --artifact <artifact.json> --gate-input <evidence.json> \
//     --policy-key <ssh-ed25519 priv key> --allowed-signers <file> --principal <name> \
//     --sigsum-key <sigsum priv.jwk.json> [--sigsum-token-key <k> --sigsum-domain <d>] \
//     [--out-dir <dir>] [--dry-run]
//   node fv-sigsum-upgrade-flip.mjs flip --signer keyless \
//     --artifact <artifact.json> --gate-input <evidence.json> \
//     --certificate-identity https://github.com/PostOakLabs/ainumbers/.github/workflows/land-verify.yml@refs/heads/main \
//     --defer-witness-to-log-root-row FV-SIGSUM-LOGROOT-WATCH-1
//   import { planFlip, runFlip } from './fv-sigsum-upgrade-flip.mjs'   # pure/injectable, no I/O forced
//
// KEYLESS LANE (FV-KEYLESS-SIGN-LANE-1, 2026-09-10): `--signer keyless` swaps
// step (a) for a Sigstore keyless bundle (ephemeral Fulcio cert bound to the
// workflow's OIDC identity — no long-lived key, no Actions secret). Everything
// else above is untouched: same guards, same evidence flow, SSHSIG still the
// default. See the KEYLESS LANE section below.

import { readFileSync, writeFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';

import { evaluateEligibility } from './fv-policy-sign-gate.mjs';

const subtle = webcrypto.subtle;
export const CI_POLICY_SSHSIG_NAMESPACE = 'fv-policy-sign@ainumbers.co';

// ---------------------------------------------------------------------------
// Pure planning step — no I/O. Decides whether a flip may proceed at all.
// ---------------------------------------------------------------------------

export function planFlip({ artifact, gateEvidence }) {
  const verdict = evaluateEligibility(gateEvidence);
  if (!verdict.eligible) {
    return { proceed: false, reason: 'gate verdict not eligible', verdict };
  }
  if (!artifact || typeof artifact !== 'object') {
    return { proceed: false, reason: 'artifact missing or not an object', verdict };
  }
  if (artifact.status === 'PROVISIONAL') {
    return {
      proceed: false,
      reason: 'artifact.status is still PROVISIONAL — check-fv-provisional-expiry.mjs has not flipped it yet; refusing to countersign an unexpired/unflipped artifact regardless of caller-supplied gate evidence',
      verdict,
    };
  }
  if (!Array.isArray(artifact.status_history) || !artifact.status_history.some((h) => h && h.attestation_basis === 'challenge-window-expiry')) {
    return {
      proceed: false,
      reason: 'artifact.status_history carries no challenge-window-expiry entry — the expiry flip this countersignature witnesses is not on record',
      verdict,
    };
  }
  return { proceed: true, verdict };
}

// ---------------------------------------------------------------------------
// Real signer: shells to the actual `ssh-keygen -Y sign` binary (same
// mechanism as helm/hub/ci-sign.mjs; independently implemented here, not
// imported, because the CI policy key + its secret live in the helm repo's
// CI — cross-repo fence — this repo only needs the SAME wire mechanism, not
// that repo's code). Verifies its own output before trusting it, same
// "a signer that lies about succeeding must not be trusted silently"
// discipline as ci-sign.mjs.
// ---------------------------------------------------------------------------

export function sshKeygenSign({ message, privateKeyPath, allowedSignersText, principal }) {
  const workDir = mkdtempSync(join(tmpdir(), 'fv-sigsum-flip-'));
  const messagePath = join(workDir, 'message');
  const sigPath = `${messagePath}.sig`;
  const allowedSignersPath = join(workDir, 'allowed_signers');
  try {
    writeFileSync(messagePath, message);
    const signResult = spawnSync(
      'ssh-keygen',
      ['-Y', 'sign', '-f', privateKeyPath, '-n', CI_POLICY_SSHSIG_NAMESPACE, messagePath],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    if (signResult.status !== 0) {
      throw new Error(`ssh-keygen -Y sign exited ${signResult.status}: ${signResult.stderr?.toString('utf8') ?? ''}`);
    }
    const armoredText = readFileSync(sigPath, 'utf8');

    writeFileSync(allowedSignersPath, allowedSignersText);
    const verifyResult = spawnSync(
      'sh',
      ['-c', `ssh-keygen -Y verify -f "${allowedSignersPath}" -I "${principal}" -n "${CI_POLICY_SSHSIG_NAMESPACE}" -s "${sigPath}" < "${messagePath}"`],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (verifyResult.status !== 0) {
      throw new Error(`freshly produced signature failed its own verify: ${verifyResult.stdout?.toString('utf8') ?? ''}${verifyResult.stderr?.toString('utf8') ?? ''}`);
    }
    return { armoredText, verifyStdout: verifyResult.stdout?.toString('utf8') ?? '' };
  } finally {
    try { unlinkSync(messagePath); } catch {}
    try { unlinkSync(sigPath); } catch {}
    try { unlinkSync(allowedSignersPath); } catch {}
  }
}

// ---------------------------------------------------------------------------
// KEYLESS LANE (FV-KEYLESS-SIGN-LANE-1, Tim's signing-architecture ruling B,
// 2026-09-10). ADDED beside sshKeygenSign, never replacing it: the SSHSIG path
// above is untouched, and every fail-closed guard in planFlip/runFlip is
// signer-agnostic and unchanged.
//
// Identity: an ephemeral Fulcio certificate bound to the GitHub workflow's own
// OIDC token — no long-lived key, no Actions secret, no Sigsum domain submit
// token (the two blockers that left the SSHSIG+Sigsum chain inert). The
// artifact field this lane stamps is
// `signing_identity_nature: ci-oidc-workflow-identity`
// (workspace-root FORMALVERIF-BUILD-SPEC.md §7a). ⛔ `attestation_grade` is NOT
// touched by this lane — §7a: "the grade records the policy validation, never
// the signing identity".
//
// VERIFICATION IS PINNED, ALWAYS. An unpinned verify proves only that somebody
// signed. Both pins are mandatory here and there is no flag to drop them:
//   --certificate-identity     <workflow URI>
//   --certificate-oidc-issuer  https://token.actions.githubusercontent.com
// ---------------------------------------------------------------------------

export const KEYLESS_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const KEYLESS_SIGNING_IDENTITY_NATURE = 'ci-oidc-workflow-identity';
// Fulcio X.509 extension OIDs, dotted form as it appears in a decoded cert
// (SHA-256 of the DER is not needed — these land as literal bytes in the DER):
//   1.3.6.1.4.1.57264.1.8  = OIDC issuer (v2)
//   1.3.6.1.4.1.57264.1.9  = build signer URI
const FULCIO_ISSUER_OID_BYTES = Buffer.from([0x2b, 0x06, 0x01, 0x04, 0x01, 0xd9, 0x79, 0x01, 0x08]);

function decodeCertificateBytes(bundle) {
  const material = bundle?.verificationMaterial;
  const b64 =
    material?.certificate?.rawBytes ??
    material?.x509CertificateChain?.certificates?.[0]?.rawBytes ??
    null;
  return b64 ? Buffer.from(b64, 'base64') : null;
}

function bundleSubjectDigests(bundle) {
  // Two bundle shapes reach this lane:
  //  * `cosign sign-blob --bundle` → messageSignature.messageDigest (raw digest bytes)
  //  * `actions/attest`            → DSSE in-toto statement, digests under subject[].digest.sha256
  const out = [];
  const md = bundle?.messageSignature?.messageDigest;
  if (md?.digest) out.push(Buffer.from(md.digest, 'base64').toString('hex'));
  const payloadB64 = bundle?.dsseEnvelope?.payload;
  if (payloadB64) {
    try {
      const statement = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      for (const subject of statement?.subject ?? []) {
        if (subject?.digest?.sha256) out.push(String(subject.digest.sha256).toLowerCase());
      }
    } catch {
      /* fall through — an unparseable payload yields no digests and the binding check fails closed */
    }
  }
  return out;
}

/**
 * Fail-closed PRE-CHECK over a Sigstore bundle's envelope, run before the
 * bundle is trusted for anything.
 *
 * ⚠ SCOPE, stated honestly: this is NOT cryptographic verification and is not
 * offered as a substitute for one. It checks that the bundle in hand is bound
 * to the digest we signed, carries a transparency-log entry, and carries the
 * identity + issuer we pinned. The cryptographic verify is delegated to
 * `cosign verify-blob --offline` / `gh attestation verify
 * --custom-trusted-root` (verifyKeylessBundleOffline below), which this lane
 * ALWAYS runs — this function exists so a bundle that is merely wrong (wrong
 * artifact, wrong workflow, missing log entry) is refused with an exact,
 * quotable message rather than being handed to a verifier that would report a
 * less specific failure.
 *
 * The identity/issuer legs are byte-presence checks over the DER — a full
 * X.509 SAN/extension parse is the verifier's job, and duplicating it here
 * would be a second, unreviewed implementation of the thing that matters most.
 */
export function assertKeylessBundleBinding({ bundle, digestHex, certificateIdentity, certificateOidcIssuer = KEYLESS_OIDC_ISSUER }) {
  const fail = (msg) => { throw new Error(`keyless bundle binding FAILED: ${msg}`); };

  if (!bundle || typeof bundle !== 'object') fail('bundle missing or not an object');
  if (!certificateIdentity) fail('no --certificate-identity pinned — an unpinned verify proves only that somebody signed (FORMALVERIF-BUILD-SPEC.md §7a)');
  if (!certificateOidcIssuer) fail('no --certificate-oidc-issuer pinned — see FORMALVERIF-BUILD-SPEC.md §7a');

  if (!/^application\/vnd\.dev\.sigstore\.bundle/.test(String(bundle.mediaType ?? ''))) {
    fail(`unrecognised mediaType ${JSON.stringify(bundle.mediaType ?? null)} — expected a application/vnd.dev.sigstore.bundle* envelope`);
  }

  const tlogEntries = bundle.verificationMaterial?.tlogEntries ?? [];
  if (!Array.isArray(tlogEntries) || tlogEntries.length === 0) {
    fail('no transparency-log entry in verificationMaterial.tlogEntries — an unlogged keyless signature carries none of the properties this lane claims');
  }

  const digests = bundleSubjectDigests(bundle);
  if (digests.length === 0) fail('bundle carries no subject digest (neither messageSignature.messageDigest nor a parseable in-toto subject)');
  if (!digests.includes(String(digestHex).toLowerCase())) {
    fail(`bundle is not bound to this artifact — signed digest(s) ${JSON.stringify(digests)}, artifact digest ${digestHex}`);
  }

  const certBytes = decodeCertificateBytes(bundle);
  if (!certBytes) fail('no signing certificate in verificationMaterial — a keyless bundle without its Fulcio certificate cannot bind any identity');
  if (!certBytes.includes(Buffer.from(certificateIdentity, 'utf8'))) {
    fail(`pinned --certificate-identity ${certificateIdentity} not present in the signing certificate`);
  }
  if (!certBytes.includes(Buffer.from(certificateOidcIssuer, 'utf8'))) {
    fail(`pinned --certificate-oidc-issuer ${certificateOidcIssuer} not present in the signing certificate`);
  }
  if (!certBytes.includes(FULCIO_ISSUER_OID_BYTES)) {
    fail('signing certificate carries no Fulcio OIDC-issuer extension (OID 1.3.6.1.4.1.57264.1.8) — not a keyless workflow-identity certificate');
  }

  return { ok: true, digests, tlogEntryCount: tlogEntries.length, certificateIdentity, certificateOidcIssuer };
}

/**
 * Offline verification of a produced bundle. ZERO network: `--offline` for
 * cosign, `--custom-trusted-root` for gh (the trusted root is fetched ONCE, in
 * CI, exactly as land-verify.yml's attest-fv-artifacts job already does), so
 * this is the same offline posture as register-sigsum.mjs's CHAINPOINT GUARD —
 * every byte checked was fetched at signing time.
 */
export function verifyKeylessBundleOffline({ artifactPath, bundlePath, certificateIdentity, certificateOidcIssuer = KEYLESS_OIDC_ISSUER, tool = 'cosign', cosignBin = 'cosign', ghBin = 'gh', trustedRootPath, owner }) {
  if (tool === 'gh') {
    if (!trustedRootPath) throw new Error('gh attestation verify requires --trusted-root (fetch once with `gh attestation trusted-root`) — refusing a verify that would call the network');
    const args = ['attestation', 'verify', artifactPath, '--bundle', bundlePath, '--custom-trusted-root', trustedRootPath];
    if (owner) args.push('--owner', owner);
    const r = spawnSync(ghBin, args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`gh attestation verify FAILED (exit ${r.status}): ${r.stdout ?? ''}${r.stderr ?? ''}`);
    return { tool: 'gh', command: `${ghBin} ${args.join(' ')}`, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }
  const args = ['verify-blob', '--bundle', bundlePath, '--offline', '--certificate-identity', certificateIdentity, '--certificate-oidc-issuer', certificateOidcIssuer, artifactPath];
  const r = spawnSync(cosignBin, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cosign verify-blob FAILED (exit ${r.status}): ${r.stdout ?? ''}${r.stderr ?? ''}`);
  return { tool: 'cosign', command: `${cosignBin} ${args.join(' ')}`, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Real keyless signer — the `sign` injection point's second implementation,
 * shaped exactly like sshKeygenSign: produce, then verify our own output
 * before trusting it (same "a signer that lies about succeeding must not be
 * trusted silently" discipline), then return.
 *
 * Runs `cosign sign-blob --bundle` (a plain pinned binary step — ⛔ no new
 * third-party GitHub Action is introduced by this lane; `actions/attest` is
 * the alternative producer and is already SHA-pinned in land-verify.yml).
 */
export function keylessSign({ message, certificateIdentity, certificateOidcIssuer = KEYLESS_OIDC_ISSUER, outDir, cosignBin = 'cosign' }) {
  if (!certificateIdentity) {
    throw new Error('keylessSign requires certificateIdentity (the workflow URI to pin) — refusing to sign into an unpinnable verify');
  }
  const workDir = outDir ?? mkdtempSync(join(tmpdir(), 'fv-keyless-flip-'));
  const messagePath = join(workDir, 'keyless-message');
  const bundlePath = join(workDir, 'keyless-signature.sigstore.json');
  writeFileSync(messagePath, message);

  const signResult = spawnSync(cosignBin, ['sign-blob', '--yes', '--bundle', bundlePath, messagePath], { encoding: 'utf8' });
  if (signResult.status !== 0) {
    throw new Error(`cosign sign-blob exited ${signResult.status}: ${signResult.stdout ?? ''}${signResult.stderr ?? ''}`);
  }

  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  const digestHex = message.toString('utf8');
  const binding = assertKeylessBundleBinding({
    bundle,
    digestHex: /^[0-9a-f]{64}$/i.test(digestHex) ? digestHex : Buffer.from(message).toString('hex'),
    certificateIdentity,
    certificateOidcIssuer,
  });
  const verify = verifyKeylessBundleOffline({ artifactPath: messagePath, bundlePath, certificateIdentity, certificateOidcIssuer, cosignBin });

  return {
    bundlePath,
    bundle,
    binding,
    verifyStdout: verify.stdout,
    verifyCommand: verify.command,
    signingIdentityNature: KEYLESS_SIGNING_IDENTITY_NATURE,
    certificateIdentity,
    certificateOidcIssuer,
  };
}

// ---------------------------------------------------------------------------
// Real Sigsum register+verify: spawns the EXISTING register-sigsum.mjs —
// never edited, never re-implemented (SIGSUM-NAMED-POLICY-1 owns that
// file's pinned policy; ⚠ never concurrent with that row per this row's
// fence note).
// ---------------------------------------------------------------------------

export function registerAndVerifyWithSigsum({ digestHex, sigsumKeyPath, sigsumTokenKeyPath, sigsumDomain, outDir, scriptPath }) {
  const recordPath = join(outDir, `sigsum-record-${digestHex.slice(0, 16)}.json`);
  const registerArgs = ['register-sigsum.mjs', 'register', '--hash', `sha256:${digestHex}`, '--key', sigsumKeyPath, '--out', recordPath];
  if (sigsumTokenKeyPath && sigsumDomain) {
    registerArgs.push('--token-key', sigsumTokenKeyPath, '--domain', sigsumDomain);
  }
  const registerResult = spawnSync('node', [scriptPath, ...registerArgs.slice(1)], { encoding: 'utf8' });
  if (registerResult.status !== 0) {
    throw new Error(`register-sigsum.mjs register failed (exit ${registerResult.status}): ${registerResult.stdout}${registerResult.stderr}`);
  }
  const verifyResult = spawnSync('node', [scriptPath, 'verify', recordPath], { encoding: 'utf8' });
  if (verifyResult.status !== 0) {
    throw new Error(`register-sigsum.mjs verify failed (exit ${verifyResult.status}) on freshly registered record: ${verifyResult.stdout}${verifyResult.stderr}`);
  }
  const verifyJson = JSON.parse(verifyResult.stdout);
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  return {
    recordPath,
    record,
    registerStdout: registerResult.stdout,
    verifyStdout: verifyResult.stdout,
    verifyJson,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator — takes injected `sign`/`registerAndVerify` so the fixture
// test below can prove the flip logic (eligibility gate, status guard,
// status_history stamp, record path) WITHOUT a real key or a real network
// call to Sigsum. The CLI below wires the real functions.
// ---------------------------------------------------------------------------

export async function runFlip({ artifactPath, artifact, gateEvidence, sign, registerAndVerify, outDir, dryRun, witnessDeferredTo }) {
  const plan = planFlip({ artifact, gateEvidence });
  if (!plan.proceed) {
    return { flipped: false, reason: plan.reason, verdict: plan.verdict };
  }

  const artifactBytes = readFileSync(artifactPath);
  const digestHex = Buffer.from(await subtle.digest('SHA-256', artifactBytes)).toString('hex');

  const sigResult = sign({ message: Buffer.from(digestHex, 'utf8') });

  // Witness leg. DEFAULT IS UNCHANGED: one Sigsum leaf per flip, exactly as
  // before. `witnessDeferredTo` exists because Tim's ruling B moves Sigsum
  // witnessing up one level (the log root / manifest root, at checkpoint
  // frequency) rather than retiring it — and the row that builds that watcher
  // is a separate, later row. ⛔ The deferral is NEVER implicit: it must be
  // asked for by name, it names the successor row in the artifact's own
  // status_history, and the entry says in words that no per-artifact witness
  // is present. Quietly dropping the witness design is precisely what the
  // scope memo forbids.
  const sigsumResult = witnessDeferredTo ? null : registerAndVerify({ digestHex, outDir });

  const historyEntry = {
    status: artifact.status,
    attestation_basis: artifact.attestation_basis,
    date: new Date().toISOString(),
    reason: sigsumResult
      ? 'Sigsum-witnessed countersignature registered — the witnessed log entry proves the challenge window ran its course'
      : `countersignature registered WITHOUT a per-artifact Sigsum leaf — independent witnessing is deferred to the log-root watcher (${witnessDeferredTo}); this entry carries a signature and a transparency-log entry, but no third-party witness cosignature over this artifact`,
    actor: 'fv-sigsum-upgrade-flip.mjs',
    ...(sigsumResult
      ? {
          sigsum_leaf_index: sigsumResult.record.inclusion_proof.leaf_index,
          sigsum_tree_size: sigsumResult.record.tree_head.size,
          sigsum_log_url: sigsumResult.record.log_url,
          sigsum_record_file: basename(sigsumResult.recordPath),
        }
      : { sigsum_witness: 'deferred-to-log-root', sigsum_witness_deferred_to: witnessDeferredTo }),
    ssh_signature_present: Boolean(sigResult.armoredText),
    // §7a identity predicate — stamped only by a signer that reports one, so
    // the SSHSIG path's entry stays byte-identical to what it produced before.
    // ⛔ attestation_grade is not written here, by this lane or any other.
    ...(sigResult.signingIdentityNature
      ? {
          signing_identity_nature: sigResult.signingIdentityNature,
          keyless_bundle_file: sigResult.bundlePath ? basename(sigResult.bundlePath) : undefined,
          keyless_certificate_identity: sigResult.certificateIdentity,
          keyless_certificate_oidc_issuer: sigResult.certificateOidcIssuer,
        }
      : {}),
    digest_sha256: digestHex,
  };

  if (!dryRun) {
    const updated = { ...artifact, status_history: [...artifact.status_history, historyEntry] };
    writeFileSync(artifactPath, JSON.stringify(updated, null, 2) + '\n');
  }

  return {
    flipped: true,
    dryRun: Boolean(dryRun),
    digestHex,
    historyEntry,
    sigsumRecordPath: sigsumResult ? sigsumResult.recordPath : null,
    verifyJson: sigsumResult ? sigsumResult.verifyJson : null,
    witnessDeferredTo: witnessDeferredTo ?? null,
    keylessBundlePath: sigResult.bundlePath ?? null,
    keylessVerifyCommand: sigResult.verifyCommand ?? null,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (cmd !== 'flip') {
    console.error([
      'usage: fv-sigsum-upgrade-flip.mjs flip --artifact <artifact.json> --gate-input <evidence.json>',
      '         [--signer sshsig|keyless]  (default sshsig — the original path, unchanged)',
      '         sshsig:  --policy-key <k> --allowed-signers <f> --principal <n>',
      '         keyless: --certificate-identity <workflow URI> [--certificate-oidc-issuer <iss>]',
      '         witness: --sigsum-key <k> [--sigsum-token-key <k> --sigsum-domain <d>]',
      '                  | --defer-witness-to-log-root-row <ROW-ID>   (explicit deferral only)',
      '         [--out-dir <dir>] [--dry-run]',
    ].join('\n'));
    process.exitCode = 2;
    return;
  }

  const artifactPath = resolve(flag(rest, 'artifact'));
  const gateInputPath = resolve(flag(rest, 'gate-input'));
  const policyKeyPath = flag(rest, 'policy-key');
  const allowedSignersPath = flag(rest, 'allowed-signers');
  const principal = flag(rest, 'principal');
  const sigsumKeyPath = flag(rest, 'sigsum-key');
  const sigsumTokenKeyPath = flag(rest, 'sigsum-token-key');
  const sigsumDomain = flag(rest, 'sigsum-domain');
  const outDir = resolve(flag(rest, 'out-dir', dirname(artifactPath)));
  const dryRun = rest.includes('--dry-run');
  const signer = flag(rest, 'signer', 'sshsig');
  const certificateIdentity = flag(rest, 'certificate-identity');
  const certificateOidcIssuer = flag(rest, 'certificate-oidc-issuer', KEYLESS_OIDC_ISSUER);
  const witnessDeferredTo = flag(rest, 'defer-witness-to-log-root-row');

  if (signer !== 'sshsig' && signer !== 'keyless') {
    console.error(`unknown --signer ${signer} — expected "sshsig" (the SSHSIG+Sigsum path, unchanged) or "keyless" (FV-KEYLESS-SIGN-LANE-1)`);
    process.exitCode = 2;
    return;
  }

  if (!artifactPath || !gateInputPath) {
    console.error('missing required flag(s) — see usage');
    process.exitCode = 2;
    return;
  }
  if (signer === 'sshsig' && (!policyKeyPath || !allowedSignersPath || !principal)) {
    console.error('missing required flag(s) for --signer sshsig — see usage');
    process.exitCode = 2;
    return;
  }
  if (signer === 'keyless' && !certificateIdentity) {
    console.error('--signer keyless requires --certificate-identity <workflow URI> — an unpinned verify proves only that somebody signed (FORMALVERIF-BUILD-SPEC.md §7a)');
    process.exitCode = 2;
    return;
  }
  if (!witnessDeferredTo && !sigsumKeyPath) {
    console.error('missing --sigsum-key — the per-artifact Sigsum witness leg is the default for BOTH signers; pass --defer-witness-to-log-root-row <ROW-ID> to defer it explicitly (never implicitly)');
    process.exitCode = 2;
    return;
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const gateEvidence = JSON.parse(readFileSync(gateInputPath, 'utf8'));
  const allowedSignersText = signer === 'sshsig' ? readFileSync(allowedSignersPath, 'utf8') : null;
  const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'register-sigsum.mjs');

  const result = await runFlip({
    artifactPath,
    artifact,
    gateEvidence,
    sign: signer === 'keyless'
      ? ({ message }) => keylessSign({ message, certificateIdentity, certificateOidcIssuer, outDir })
      : ({ message }) => sshKeygenSign({ message, privateKeyPath: policyKeyPath, allowedSignersText, principal }),
    registerAndVerify: ({ digestHex, outDir: od }) => registerAndVerifyWithSigsum({ digestHex, sigsumKeyPath, sigsumTokenKeyPath, sigsumDomain, outDir: od, scriptPath }),
    outDir,
    dryRun,
    witnessDeferredTo,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.flipped ? 0 : 1;
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  main();
}
