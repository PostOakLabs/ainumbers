#!/usr/bin/env node
// errata-sign.mjs — FV-ERRATA-BUILD-2
//
// Signs errata.json (JCS-canonical bytes, RFC 8785, via the shared cgCanon
// in chaingraph/kernels/_hash.mjs) with the CI policy SSHSIG key under
// namespace fv-policy-sign@ainumbers.co (helm/hub/extsig.mjs,
// FV-SSHSIG-POLICY-KEY-1). Independently implemented here rather than
// imported, because the CI policy key + its GitHub Actions secret live in
// the ainumbers-helm repo's CI — cross-repo fence, same reasoning as
// scripts/fv-sigsum-upgrade-flip.mjs's sshKeygenSign. This repo only needs
// the SAME wire mechanism (`ssh-keygen -Y sign`/`verify`), not that repo's
// code.
//
// The private key never lives in this repo. `sign` takes a
// --private-key-path pointing at a local, out-of-band-provisioned key file
// (never committed, never printed). Verify-after-sign is mandatory: a
// signer that produces a well-formed-but-non-verifying blob must fail
// loudly here, not downstream (same discipline as helm/hub/ci-sign.mjs).
//
// Usage:
//   node scripts/errata-sign.mjs sign --errata errata.json \
//     --private-key-path <path> --allowed-signers <path> \
//     --principal ci-policy-key@ainumbers.co [--out errata.json.sig]
//   node scripts/errata-sign.mjs verify --errata errata.json \
//     --sig errata.json.sig --allowed-signers <path> \
//     --principal ci-policy-key@ainumbers.co
//   node scripts/errata-sign.mjs selftest   # real ssh-keygen round trip,
//                                            # throwaway key, no production
//                                            # secret involved

import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cgCanon, assertIJson } from '../chaingraph/kernels/_hash.mjs';

export const CI_POLICY_SSHSIG_NAMESPACE = 'fv-policy-sign@ainumbers.co';

// JCS-canonical bytes of the whole errata.json object (RFC 8785, via the
// shared cgCanon — same canonicalizer the OCG artifact hash path uses,
// reused here for a plain file signature, not an execution_hash).
export function canonicalErrataBytes(errataObj) {
  assertIJson(errataObj);
  return Buffer.from(JSON.stringify(cgCanon(errataObj)), 'utf8');
}

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

export function sshKeygenSign({ message, privateKeyPath, namespace = CI_POLICY_SSHSIG_NAMESPACE }) {
  const workDir = mkdtempSync(join(tmpdir(), 'errata-sign-'));
  const messagePath = join(workDir, 'message');
  const sigPath = `${messagePath}.sig`;
  try {
    writeFileSync(messagePath, message);
    const result = spawnSync('ssh-keygen', ['-Y', 'sign', '-f', privateKeyPath, '-n', namespace, messagePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`errata-sign: ssh-keygen -Y sign exited ${result.status}: ${result.stderr?.toString('utf8') ?? ''}`);
    }
    return readFileSync(sigPath, 'utf8');
  } finally {
    try { unlinkSync(messagePath); } catch {}
    try { unlinkSync(sigPath); } catch {}
  }
}

export function sshKeygenVerify({ message, armoredText, allowedSignersPath, principal, namespace = CI_POLICY_SSHSIG_NAMESPACE }) {
  const workDir = mkdtempSync(join(tmpdir(), 'errata-verify-'));
  const messagePath = join(workDir, 'message');
  const sigPath = `${messagePath}.sig`;
  try {
    writeFileSync(messagePath, message);
    writeFileSync(sigPath, armoredText);
    const result = spawnSync(
      'sh',
      ['-c', `ssh-keygen -Y verify -f "${allowedSignersPath}" -I "${principal}" -n "${namespace}" -s "${sigPath}" < "${messagePath}"`],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { ok: result.status === 0, stdout: result.stdout?.toString('utf8') ?? '', stderr: result.stderr?.toString('utf8') ?? '' };
  } finally {
    try { unlinkSync(messagePath); } catch {}
    try { unlinkSync(sigPath); } catch {}
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (cmd === 'sign') {
    const errataPath = flag(rest, 'errata', 'errata.json');
    const privateKeyPath = flag(rest, 'private-key-path');
    const allowedSignersPath = flag(rest, 'allowed-signers');
    const principal = flag(rest, 'principal', 'ci-policy-key@ainumbers.co');
    const outPath = flag(rest, 'out', `${errataPath}.sig`);
    if (!privateKeyPath || !allowedSignersPath) {
      console.error('usage: sign --errata <f> --private-key-path <k> --allowed-signers <f> [--principal <p>] [--out <f>]');
      process.exitCode = 2;
      return;
    }
    const errataObj = JSON.parse(readFileSync(errataPath, 'utf8'));
    const message = canonicalErrataBytes(errataObj);
    const armoredText = sshKeygenSign({ message, privateKeyPath });
    const verified = sshKeygenVerify({ message, armoredText, allowedSignersPath, principal });
    if (!verified.ok) {
      throw new Error(`errata-sign: freshly produced signature failed its own verify: ${verified.stdout}${verified.stderr}`);
    }
    writeFileSync(outPath, armoredText);
    console.log(`Signed ${errataPath} (${message.length} canonical bytes) -> ${outPath}`);
    console.log(verified.stdout.trim());
    return;
  }

  if (cmd === 'verify') {
    const errataPath = flag(rest, 'errata', 'errata.json');
    const sigPath = flag(rest, 'sig', `${errataPath}.sig`);
    const allowedSignersPath = flag(rest, 'allowed-signers');
    const principal = flag(rest, 'principal', 'ci-policy-key@ainumbers.co');
    if (!allowedSignersPath) {
      console.error('usage: verify --errata <f> --sig <f> --allowed-signers <f> [--principal <p>]');
      process.exitCode = 2;
      return;
    }
    if (!existsSync(sigPath)) {
      console.error(`errata-sign: no signature file at ${sigPath}`);
      process.exitCode = 1;
      return;
    }
    const errataObj = JSON.parse(readFileSync(errataPath, 'utf8'));
    const message = canonicalErrataBytes(errataObj);
    const armoredText = readFileSync(sigPath, 'utf8');
    const verified = sshKeygenVerify({ message, armoredText, allowedSignersPath, principal });
    console.log(verified.stdout.trim() || verified.stderr.trim());
    process.exitCode = verified.ok ? 0 : 1;
    return;
  }

  if (cmd === 'selftest') {
    // Real ssh-keygen sign/verify round trip against a THROWAWAY key + a
    // fixture allowed_signers file — proves the mechanism works without
    // ever touching the production ci-policy-key@ainumbers.co secret.
    const workDir = mkdtempSync(join(tmpdir(), 'errata-selftest-'));
    const keyPath = join(workDir, 'throwaway_ed25519');
    const gen = spawnSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', 'errata-selftest-throwaway', '-f', keyPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (gen.status !== 0) {
      console.error(`selftest: ssh-keygen keygen failed: ${gen.stderr?.toString('utf8') ?? ''}`);
      process.exit(1);
    }
    const pub = readFileSync(`${keyPath}.pub`, 'utf8').trim();
    const allowedSignersPath = join(workDir, 'allowed_signers');
    const principal = 'errata-selftest@ainumbers.co';
    writeFileSync(allowedSignersPath, `${principal} ${pub}\n`);

    const message = canonicalErrataBytes({ errata_version: '1.0', entries: [] });
    const armoredText = sshKeygenSign({ message, privateKeyPath: keyPath });
    const goodVerify = sshKeygenVerify({ message, armoredText, allowedSignersPath, principal });
    const tamperedVerify = sshKeygenVerify({
      message: canonicalErrataBytes({ errata_version: '1.0', entries: [{ tampered: true }] }),
      armoredText,
      allowedSignersPath,
      principal,
    });
    const wrongNamespaceVerify = sshKeygenVerify({ message, armoredText, allowedSignersPath, principal, namespace: 'helm-countersign@ainumbers.co' });

    console.log(`[sign+verify] real ssh-keygen round trip: ${goodVerify.ok ? 'PASS' : 'FAIL'}`);
    console.log(`[tamper] modified message rejected: ${!tamperedVerify.ok ? 'PASS' : 'FAIL'}`);
    console.log(`[namespace] cross-namespace verify rejected: ${!wrongNamespaceVerify.ok ? 'PASS' : 'FAIL'}`);
    const failures = (goodVerify.ok ? 0 : 1) + (tamperedVerify.ok ? 1 : 0) + (wrongNamespaceVerify.ok ? 1 : 0);
    console.log(failures === 0 ? 'selftest: ALL PASS' : `selftest: ${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  }

  console.error('usage: errata-sign.mjs <sign|verify|selftest> ...');
  process.exit(2);
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('errata-sign.mjs');
if (IS_MAIN) {
  main();
}
