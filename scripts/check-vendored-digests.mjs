#!/usr/bin/env node
// check-vendored-digests.mjs — VENDOR-DIGEST-GATE-1 (ESTATE-ATTACK-SURFACE SC-3, top-5 #5).
//
// Pins the vendored crypto bytes that decide whether forged proofs, cosignatures and zkVM seals
// VERIFY — the noble bn254/ed25519/secp256k1 bundles plus the inlined noble blocks (ML-DSA-65,
// SLH-DSA) inside chaingraph/kernels/_proof.mjs — to the sha256 table in
// chaingraph/kernels/VENDORED.md. SO #34 discipline: the digest is RECOMPUTED from the in-tree
// bytes (never read out of the artifact under test); any mismatch is RED naming the file.
//
// LAYERING vs the worker's check-vendor-fresh.mjs (mcp-apps-poc, worker CI): that gate asserts
// worker-vendored-bytes == SITE bytes — worker-vs-site EQUALITY whose baseline is this tree, so it
// ASSUMES the site side and cannot detect a site-side swap (a swap re-greens it on re-vendor, and
// generate.mjs would have propagated the swapped bytes to the live worker). THIS gate anchors the
// site side that one assumes: site bytes ≡ pinned sha256. Together: pinned(site) ∧ worker==site ⇒
// worker ≡ pinned. Same pattern as anchor-suite's VENDORED.md + check-vendor-freshness.mjs pair,
// replicated for the site repo per the row.
//
// DIGEST-CHANGE PROTOCOL (see VENDORED.md's header for the full text): an intentional upgrade
// edits the table IN THE SAME PR as the bytes, quoting the new upstream pin — the gate makes swaps
// visible, never impossible.
//
// ABSENCE IS NOT A PASS (SO #34c): a required artifact with no table row, a missing file, a
// missing/empty table, and a phantom row pointing at nothing are each a DISTINCT red state.
// Scope is enumerated LIVE: every chaingraph/kernels/_noble-*.bundle.mjs on disk must carry a row
// (a NEW noble bundle with no row reds here), plus the fixed _proof.mjs row. Single non-recursive
// directory read only (SO #52).
//
// Paired fixture proof: scripts/check-vendored-digests.test.mjs — proves this comparator fires on
// a 1-byte perturbation of the REAL bundle bytes (RED control, quoted in the gate row's PR), the
// absence states, and the discovered-scope enumeration.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE_REL = 'chaingraph/kernels/VENDORED.md';
const TABLE_PATH = join(REPO, TABLE_REL);
const KERNELS_REL = 'chaingraph/kernels';
// The whole-file pin for the inlined noble blocks (ML-DSA-65 + SLH-DSA) — fixed scope member.
const FIXED_REQUIRED = [`${KERNELS_REL}/_proof.mjs`];

// Digest of the exact in-tree bytes. The repo pins eol=lf repo-wide (.gitattributes), so raw-byte
// hashing is stable across Windows checkouts and Linux CI — no normalization, by design: the pin
// is over the bytes that ship, not a logical view of them.
export const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

// Parse the VENDORED.md pin table: rows of | `path` | … | `sha256hex` | — first backticked
// token is the repo-relative path, the trailing backticked 64-hex is the pinned digest.
// (Same row shape as anchor-suite's VENDORED.md, so both tables stay machine-identical.)
export function parseRecorded(md) {
  const map = new Map();
  const rowRe = /^\|\s*`([^`]+)`\s*\|.*\|\s*`([0-9a-f]{64})`\s*\|\s*$/gm;
  let m;
  while ((m = rowRe.exec(md))) map.set(m[1].trim(), m[2].trim());
  return map;
}

// Live scope enumeration: every _noble-*.bundle.mjs actually on disk (so a newly vendored noble
// bundle REQUIRES a row) + the fixed _proof.mjs member. `listDir` is injectable for the fixture
// proof. Sorted for deterministic output.
export function requiredArtifacts(listDir = (d) => readdirSync(join(REPO, d))) {
  const bundles = listDir(KERNELS_REL)
    .filter((f) => f.startsWith('_noble-') && f.endsWith('.bundle.mjs'))
    .map((f) => `${KERNELS_REL}/${f}`);
  return [...new Set([...bundles, ...FIXED_REQUIRED])].sort();
}

/**
 * Pure comparator — the heart of the gate, exported for the fixture proof. Never reads the digest
 * it validates out of the artifact under test: `readBytes` yields the on-disk bytes (or throws),
 * and the recomputed digest is compared against the table's pin.
 * Returns an array of findings: { path, state, detail } with state one of
 * MATCH / DRIFT / NO_ROW / NO_FILE / NO_TABLE / BAD_ROW_DIGEST.
 */
export function verifyTable({ tableMd, tableMissing = false, required, readBytes }) {
  const findings = [];
  if (tableMissing) {
    return required.map((path) => ({
      path, state: 'NO_TABLE',
      detail: `${TABLE_REL} is missing/empty — every pin below is therefore UNVERIFIED (absence is not a pass, SO #34c)`,
    }));
  }
  const recorded = parseRecorded(tableMd);

  // 1. Scope direction: every required artifact must have a live, matching row.
  for (const path of required) {
    const pinned = recorded.get(path);
    if (!pinned) {
      findings.push({ path, state: 'NO_ROW', detail: `no sha256 row in ${TABLE_REL} — a vendored crypto artifact with no pin is UNGATED (absence is not a pass, SO #34c)` });
      continue;
    }
    let bytes;
    try { bytes = readBytes(path); }
    catch {
      findings.push({ path, state: 'NO_FILE', detail: `pinned in ${TABLE_REL} but MISSING on disk` });
      continue;
    }
    const got = sha256Hex(bytes);
    findings.push(got === pinned
      ? { path, state: 'MATCH', detail: `recomputed sha256 ${got} == pinned` }
      : { path, state: 'DRIFT', detail: `DRIFT: on-disk ${got.slice(0, 16)}… ≠ pinned ${pinned.slice(0, 16)}… (${TABLE_REL}) — swapped or edited crypto bytes; if intentional, update the table in THIS PR with the new upstream pin (VENDORED.md protocol)` });
  }

  // 2. Table direction: a row pointing at nothing (stale pin left after a file was
  // deleted/renamed) is its own red — the table must never describe files that do not exist.
  for (const [path, pinned] of recorded) {
    if (required.includes(path)) continue;
    try { readBytes(path); }
    catch {
      findings.push({ path, state: 'NO_FILE', detail: `row in ${TABLE_REL} pins sha256 ${pinned.slice(0, 16)}… but the file does not exist on disk (phantom row — delete the row in the same PR as the file)` });
    }
  }
  return findings;
}

// ── Live run ────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const tableMissing = !existsSync(TABLE_PATH);
  const tableMd = tableMissing ? '' : readFileSync(TABLE_PATH, 'utf8');
  const required = requiredArtifacts();
  const readBytes = (p) => readFileSync(join(REPO, p));

  const findings = verifyTable({ tableMd, tableMissing, required, readBytes });

  console.log(`— VENDOR-DIGEST-GATE-1: vendored crypto bytes ≡ ${TABLE_REL} pins (${required.length} artifact(s)) —\n`);
  let failures = 0;
  for (const f of findings) {
    const okLine = f.state === 'MATCH';
    if (!okLine) failures++;
    console.log(`${okLine ? 'PASS' : 'FAIL'}  ${f.path} — ${okLine ? 'sha256 matches pin' : f.detail}`);
  }

  // Comparator liveness self-check (anchor-suite pattern): a 1-byte perturbation of a REAL
  // pinned artifact MUST change the digest, or the comparator above is decorative.
  const samplePath = required.find((p) => p.endsWith('.bundle.mjs')) ?? required[0];
  const sample = readBytes(samplePath);
  const flipped = Buffer.from(sample); // copy, same length
  flipped[Math.floor(flipped.length / 2)] ^= 0x01; // exactly one byte, in place
  const live = sha256Hex(sample) !== sha256Hex(flipped);
  console.log(`${live ? 'PASS' : 'FAIL'}  comparator liveness — a 1-byte perturbation of ${samplePath} changes the sha256`);
  if (!live) failures++;

  console.log(`\n${failures === 0 ? '✅ ALL VENDORED CRYPTO BYTES MATCH PINS' : `❌ ${failures} vendored-crypto finding(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}
