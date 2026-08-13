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
//   import { planFlip, runFlip } from './fv-sigsum-upgrade-flip.mjs'   # pure/injectable, no I/O forced

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

export async function runFlip({ artifactPath, artifact, gateEvidence, sign, registerAndVerify, outDir, dryRun }) {
  const plan = planFlip({ artifact, gateEvidence });
  if (!plan.proceed) {
    return { flipped: false, reason: plan.reason, verdict: plan.verdict };
  }

  const artifactBytes = readFileSync(artifactPath);
  const digestHex = Buffer.from(await subtle.digest('SHA-256', artifactBytes)).toString('hex');

  const sigResult = sign({ message: Buffer.from(digestHex, 'utf8') });
  const sigsumResult = registerAndVerify({ digestHex, outDir });

  const historyEntry = {
    status: artifact.status,
    attestation_basis: artifact.attestation_basis,
    date: new Date().toISOString(),
    reason: 'Sigsum-witnessed countersignature registered — the witnessed log entry proves the challenge window ran its course',
    actor: 'fv-sigsum-upgrade-flip.mjs',
    sigsum_leaf_index: sigsumResult.record.inclusion_proof.leaf_index,
    sigsum_tree_size: sigsumResult.record.tree_head.size,
    sigsum_log_url: sigsumResult.record.log_url,
    sigsum_record_file: basename(sigsumResult.recordPath),
    ssh_signature_present: Boolean(sigResult.armoredText),
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
    sigsumRecordPath: sigsumResult.recordPath,
    verifyJson: sigsumResult.verifyJson,
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
    console.error('usage: fv-sigsum-upgrade-flip.mjs flip --artifact <artifact.json> --gate-input <evidence.json> --policy-key <k> --allowed-signers <f> --principal <n> --sigsum-key <k> [--sigsum-token-key <k> --sigsum-domain <d>] [--out-dir <dir>] [--dry-run]');
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

  if (!artifactPath || !gateInputPath || !policyKeyPath || !allowedSignersPath || !principal || !sigsumKeyPath) {
    console.error('missing required flag(s) — see usage');
    process.exitCode = 2;
    return;
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const gateEvidence = JSON.parse(readFileSync(gateInputPath, 'utf8'));
  const allowedSignersText = readFileSync(allowedSignersPath, 'utf8');
  const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'register-sigsum.mjs');

  const result = await runFlip({
    artifactPath,
    artifact,
    gateEvidence,
    sign: ({ message }) => sshKeygenSign({ message, privateKeyPath: policyKeyPath, allowedSignersText, principal }),
    registerAndVerify: ({ digestHex, outDir: od }) => registerAndVerifyWithSigsum({ digestHex, sigsumKeyPath, sigsumTokenKeyPath, sigsumDomain, outDir: od, scriptPath }),
    outDir,
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.flipped ? 0 : 1;
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  main();
}
