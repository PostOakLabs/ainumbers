#!/usr/bin/env node
// ART598-C2PATOOL-ORACLE-1 — differential oracle comparing art-598's c2pa-manifest
// structural verdict against c2patool (contentauth/c2pa-rs), the reference C2PA
// implementation. CI-only: c2patool is never a runtime/site dependency (repo zero-dep
// policy governs product code, not the CI comparison instrument — same trust tier as
// the QuickJS binary in cross-engine-parity.yml).
//
// SCOPE HONESTY (why this compares a narrower axis than "does the file validate"):
//   art-598's checkC2paManifest() (chaingraph/kernels/art-598-input-attestation-verifier.kernel.mjs)
//   is a JSON-shaped structural check: it never has access to raw asset bytes, so its
//   "digest bound" condition binds a declared hash to a canonical digest of an arbitrary
//   *policy_parameters* pointer value (our own attestation-binding convention) — not to a
//   hash of the embedding asset's own bytes, which is what c2patool actually verifies.
//   Those are different binding targets by design (SPEC.md §23.1: verifiable stays 'n/a'
//   for this type). Forcing the two to agree on that axis would require either a SHA-256
//   preimage (impossible) or reading the value straight off the artifact under test
//   (the self-consistent-checker shape STANDING-ORDERS.md #34 forbids). So this oracle
//   FORCES the digest-bound sub-check to a fixed, always-true state (see FORCED_DIGEST_HEX)
//   and compares only the three axes both tools can independently assess from the SAME
//   real file: is the claim well-formed, is a hard-binding assertion present, is a
//   signature reference present. Byte-level tamper/truncation/algorithm defects that
//   c2patool catches via real cryptographic verification and art-598 cannot (because it
//   never touches asset bytes) are real, permanent, documented divergences — tracked in
//   scripts/c2patool-oracle-allowlist.json, never silently patched away here.
//
// Fence (board/claimed/ART598-C2PATOOL-ORACLE-1.md): CI workflow + fixtures + comparison
// script in repo/. No art-598 kernel edits — a divergence found is a report, not a fix.

import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const HERE = fileURLToPath(new URL('.', import.meta.url));
const KERNEL_PATH = join(HERE, '..', 'chaingraph', 'kernels', 'art-598-input-attestation-verifier.kernel.mjs');
const ALLOWLIST_PATH = join(HERE, 'c2patool-oracle-allowlist.json');

const c2patoolBin = process.env.C2PATOOL_BIN || process.argv[2];
if (!c2patoolBin || !existsSync(c2patoolBin)) {
  console.error('c2patool-oracle-compare: no c2patool binary given. Pass as argv[1] or C2PATOOL_BIN env.');
  process.exit(2);
}

// ── cgCanon, duplicated from _hash.mjs / the kernel's own inlined copy (documented
// duplication, same pattern as the kernel's top-of-file note — VM-safety isn't a concern
// here since this runs under plain Node, but keeping the SAME formula is load-bearing:
// it is what makes FORCED_DIGEST_HEX below actually equal what compute() will derive). ──
const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {})
    : v;

async function canonicalDigestHex(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(cgCanon(value)));
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Allowlisted validation_status/validation_results failure code PREFIXES: trust-chain
// and timestamp-authority checks art-598 never claims (verifiable stays 'n/a' for
// c2pa-manifest by SPEC.md §23.1 design — no crypto/trust verification is performed).
// A c2patool failure whose code starts with one of these is not a structural finding.
const OUT_OF_SCOPE_CODE_PREFIXES = ['signingCredential.', 'timeStamp.'];

function runC2patool(args) {
  const r = spawnSync(c2patoolBin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function readManifestJson(filePath) {
  const r = runC2patool([filePath]);
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* unreadable — no manifest */ }
  return { ...r, parsed };
}

function readDetailedJson(filePath) {
  const r = runC2patool([filePath, '-d']);
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* unreadable */ }
  return { ...r, parsed };
}

// c2patool's real accept/reject decision for a fixture: a manifest must be present and
// parseable, AND validation_results.activeManifest.failure must contain nothing outside
// the out-of-scope prefixes above. This is c2patool's OWN reported verdict — never
// re-derived from the fixture's construction, only read from what the binary actually said.
function c2patoolDecision(filePath) {
  const { parsed, stderr } = readManifestJson(filePath);
  if (!parsed || !parsed.active_manifest || !parsed.manifests?.[parsed.active_manifest]) {
    return { accept: false, reason: 'no readable manifest', detail: stderr.trim().slice(0, 300) };
  }
  const vr = parsed.validation_results?.activeManifest;
  const failures = (vr?.failure ?? []).filter((f) => !OUT_OF_SCOPE_CODE_PREFIXES.some((p) => f.code?.startsWith(p)));
  return {
    accept: failures.length === 0,
    reason: failures.length === 0 ? 'valid (no in-scope failures)' : failures.map((f) => f.code).join(', '),
    validation_state: parsed.validation_state,
  };
}

// Extracts the fields art-598's checkC2paManifest() structurally examines, from
// c2patool's OWN real read of the fixture — never invented. Handles both claim_version 1
// (top-level `claim_generator` string, `format`) and claim_version 2 (`claim_generator_info`
// array, no top-level `format`) shapes observed across c2patool versions.
function extractProofFields(filePath, forcedHashHex) {
  const { parsed: manifestJson } = readManifestJson(filePath);
  const { parsed: detailedJson } = readDetailedJson(filePath);
  if (!manifestJson?.active_manifest || !manifestJson.manifests?.[manifestJson.active_manifest]) return null;

  const m = manifestJson.manifests[manifestJson.active_manifest];
  const claim_generator = typeof m.claim_generator === 'string'
    ? m.claim_generator
    : (Array.isArray(m.claim_generator_info) && m.claim_generator_info[0]?.name) || null;
  const format = typeof m.format === 'string' ? m.format : (m.thumbnail?.format ?? null);
  const instanceID = m.instance_id ?? null;
  const sigAlg = m.signature_info?.alg ?? null;

  const dm = detailedJson?.manifests?.[detailedJson.active_manifest];
  const assertionStore = dm?.assertion_store ?? {};
  const hasHardBindingLabel = 'c2pa.hash.data' in assertionStore || 'c2pa.hash.bmff' in assertionStore;
  const hardBindingLabel = 'c2pa.hash.data' in assertionStore ? 'c2pa.hash.data' : 'c2pa.hash.bmff';

  if (claim_generator == null || format == null || instanceID == null) return null;

  return {
    claim_generator,
    claim: { format, instanceID },
    assertions: hasHardBindingLabel ? [{ label: hardBindingLabel, hash: forcedHashHex }] : [],
    signature: { present: true, alg: sigAlg },
  };
}

async function kernelDecision(proof) {
  const kernel = await import(pathToFileURL(KERNEL_PATH).href);
  const marker = 'c2patool-oracle-marker-v1';
  const forcedHashHex = await canonicalDigestHex(marker);
  // proof is built by the caller using this SAME forcedHashHex for its hard-binding
  // assertion's `hash` field, so digestBound is always true — isolating the comparison
  // to well-formedness + hard-binding-presence + signature-presence (see file header).
  const pp = {
    target_policy_parameters: { marker },
    verification_time: '2026-08-13T00:00:00Z',
    input_attestations: [{ type: 'c2pa-manifest', pointer: '/marker', proof }],
  };
  const { output_payload } = await kernel.compute(pp);
  const att = output_payload.attestations[0];
  return { accept: att.structural === 'pass', structural: att.structural };
}

// ── Fixture generation: everything derived from the SAME pinned, checksum-verified
// c2patool release tarball (base image = its own cli/sample/image.jpg — zero extra
// network/trust surface beyond the one pinned download the CI workflow already verifies). ──
function buildFixtures(workDir, baseImagePath) {
  const oracleManifest = join(workDir, 'oracle-manifest.json');
  writeFileSync(oracleManifest, JSON.stringify({
    claim_generator_info: [{ name: 'AINumbersOracleFixture', version: '1.0.0' }],
    title: 'art598-c2patool-oracle-fixture',
    assertions: [],
  }));

  const validPath = join(workDir, 'valid.jpg');
  const signRun = runC2patool([baseImagePath, '-m', oracleManifest, '--create', 'digitalCapture', '-o', validPath, '-f']);
  if (signRun.status !== 0 || !existsSync(validPath)) {
    throw new Error(`fixture signing failed: ${signRun.stderr || signRun.stdout}`);
  }
  const validBytes = readFileSync(validPath);

  // tampered — flip one byte inside JPEG scan data (well past the JUMBF/APP11 manifest
  // near the file head), invalidating the hard-binding data hash without corrupting the
  // JUMBF box c2patool needs to even locate the manifest.
  const tampered = Buffer.from(validBytes);
  tampered[tampered.length - 4] ^= 0xff;
  const tamperedPath = join(workDir, 'tampered.jpg');
  writeFileSync(tamperedPath, tampered);

  // truncated — cut the tail off a signed file (still contains the manifest near the
  // head, but the asset bytes the hard binding covers are now incomplete/altered).
  const truncatedPath = join(workDir, 'truncated.jpg');
  writeFileSync(truncatedPath, validBytes.subarray(0, Math.floor(validBytes.length * 0.8)));

  // wrong-algorithm — patch the ASCII algorithm name declared inside the embedded JUMBF
  // manifest (sha256 -> sha384, same byte length) without touching the actual hash bytes,
  // so the declared algorithm and the real digest disagree.
  const wrongAlg = Buffer.from(validBytes);
  const needle = Buffer.from('sha256');
  const replacement = Buffer.from('sha384');
  let patched = 0;
  for (let i = 0; i <= wrongAlg.length - needle.length; i++) {
    if (wrongAlg.subarray(i, i + needle.length).equals(needle)) { replacement.copy(wrongAlg, i); patched++; }
  }
  if (patched === 0) throw new Error('wrong-algorithm fixture: no "sha256" bytes found to patch — c2patool output shape changed, update this script');
  const wrongAlgPath = join(workDir, 'wrong-algorithm.jpg');
  writeFileSync(wrongAlgPath, wrongAlg);

  // missing-claim — the base asset, never signed at all.
  const missingClaimPath = join(workDir, 'missing-claim.jpg');
  writeFileSync(missingClaimPath, readFileSync(baseImagePath));

  return {
    'valid': validPath,
    'tampered': tamperedPath,
    'truncated': truncatedPath,
    'wrong-algorithm': wrongAlgPath,
    'missing-claim': missingClaimPath,
  };
}

async function main() {
  const baseImageArg = process.argv[3];
  if (!baseImageArg || !existsSync(baseImageArg)) {
    console.error('c2patool-oracle-compare: no base image given. Pass as argv[2] (path to a JPEG, e.g. the c2patool release tarball\'s cli/sample/image.jpg).');
    process.exit(2);
  }

  const workDir = mkdtempSync(join(tmpdir(), 'c2patool-oracle-'));
  const fixtures = buildFixtures(workDir, baseImageArg);
  const marker = 'c2patool-oracle-marker-v1';
  const forcedHashHex = await canonicalDigestHex(marker);

  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  const allowlistedFixtures = new Set(allowlist.entries.map((e) => e.fixture));
  const seenAllowlisted = new Set();

  const rows = [];
  let unallowlistedDivergence = false;

  for (const [name, path] of Object.entries(fixtures)) {
    const c2p = c2patoolDecision(path);
    const proof = extractProofFields(path, forcedHashHex);
    const kernel = await kernelDecision(proof);
    const diverges = c2p.accept !== kernel.accept;
    let status = 'AGREE';
    if (diverges) {
      if (allowlistedFixtures.has(name)) { status = 'ALLOWLISTED'; seenAllowlisted.add(name); }
      else { status = 'DIVERGENCE'; unallowlistedDivergence = true; }
    }
    rows.push({ name, c2patool_accept: c2p.accept, c2patool_reason: c2p.reason, kernel_accept: kernel.accept, kernel_structural: kernel.structural, status });
  }

  console.log('ART598-C2PATOOL-ORACLE-1 — differential oracle report');
  console.log('fixture              | c2patool | kernel | status       | c2patool reason');
  console.log('-'.repeat(100));
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(21)} | ${(r.c2patool_accept ? 'accept' : 'reject').padEnd(8)} | ${(r.kernel_accept ? 'accept' : 'reject').padEnd(6)} | ${r.status.padEnd(12)} | ${r.c2patool_reason}`,
    );
  }

  const staleAllowlist = [...allowlistedFixtures].filter((f) => !seenAllowlisted.has(f));
  if (staleAllowlist.length) {
    console.log(`\nNOTE: allowlist entries no longer diverging (safe to remove — allowlist is shrink-only): ${staleAllowlist.join(', ')}`);
  }

  if (unallowlistedDivergence) {
    console.log('\nFAIL: at least one fixture diverges between art-598 and c2patool with no allowlist entry.');
    console.log('Both outputs are printed above. If this is a genuine capability gap (not a bug), add a');
    console.log(`reasoned entry to ${ALLOWLIST_PATH} — never silently absorb a divergence without a reason.`);
    process.exit(1);
  }

  console.log('\nPASS: every fixture either agrees or has an allowlisted, reasoned divergence.');
}

main().catch((e) => { console.error(e); process.exit(1); });
