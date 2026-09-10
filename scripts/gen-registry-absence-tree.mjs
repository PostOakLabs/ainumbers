#!/usr/bin/env node
// scripts/gen-registry-absence-tree.mjs — REGISTRY-ABSENCE-TREE-BUILD-1.
// The NEGATIVE half of F2 (kernel-digest resolution): a sorted-key binary Merkle
// tree over the registry/kernel/ key set, proving ABSENCE of a kernel_digest
// with ICS23 non-existence proofs under the pinned `ainumbers-simple-v1`
// ProofSpec (REGISTRY-TILES-BUILD-SPEC.md §4, transcribed — do not re-pick).
//
// ⛔ A 404 IS NOT A PROOF OF ABSENCE (design §3.2) — and neither is this file
// alone. The tree root plus the key count it covers is committed as an entry in
// the lineage log (§4.4's one-line binding), so absence is proven against a
// root that itself sits in an anchored, consistency-checkable history (the
// lineage log's own head is Sigsum-anchored at every publish, spec §2.1) —
// ⛔ never against a root this generator merely asserts today.
//
// ── DERIVATION, NEVER HAND-AUTHORING (Tim's 2026-08-17 ruling) ───────────────
// Every input is read, every output recomputed: keys come from the published
// registry/kernel/*.json records (the landed, gate-verified F2 positive half —
// REGISTRY-RESOLVE-STATIC-1), each file's filename hex must equal its own
// `kernel_digest` field, values are re-canonicalized through the estate's ONE
// canonicalizer (chaingraph/kernels/_hash.mjs cgCanon). Nothing is hand-listed;
// a hand-maintained key set is permanently discarded, not a fallback.
//
// ── NO SECOND MERKLE IMPLEMENTATION (SPEC §20.1) ─────────────────────────────
// Every hash call goes through chaingraph/kernels/c2sp-tlog-verify.mjs's
// hashLeafNode / hashInteriorNode / sha256 / concatBytes. The dense-tree root
// is additionally cross-checked against gen-registry-lineage.mjs's mth() (the
// RFC 6962 recursive split the lineage log itself uses) — two derivations of
// the same root must agree or nothing is written. Proof CONSTRUCTION (audit
// paths, neighbour bracketing) is new here and calls only those primitives,
// exactly like gen-registry-lineage.mjs's subproof() allowance. Verification
// is the landed ics23-verify.mjs with its fourth frozen preset
// AINUMBERS_SIMPLE_SPEC — never a local re-verification.
//
// ── ABSENCE IS NOT A PASS (SO #34c) — twice ──────────────────────────────────
// 1. A tree with fewer than 2 keys cannot produce a valid non-existence proof;
//    buildAbsenceTree() REFUSES to build one. An empty or single-leaf key set
//    is a distinct FAILING state, never "absence proven".
// 2. --check treats a missing artifact, a stale artifact, and a missing or
//    mismatched lineage binding each as DISTINCT FAILING states — never green.
//
// ── SINGLE WRITER (SO #35) ───────────────────────────────────────────────────
// This generator owns exactly ONE fixed-path file: registry/absence/tree.json
// (pure function of registry/kernel/*, no wall-clock field, network-free, so
// two consecutive runs are byte-identical). It is registered in
// scripts/derived-artifacts.mjs COVERED as `registry-absence-tree` — the
// main-side regen owns freshness from the first commit, and PRs must NOT
// regenerate it to satisfy a freshness warning.
//
// The lineage log itself is a DIFFERENT artifact with a DIFFERENT writer:
// scripts/gen-registry-lineage.mjs (EXCLUDED from COVERED — unbounded tile
// paths + Sigsum budget; publishing stays a manual/generated run). This
// generator's only connection to it: the binding record ({tree_root,
// key_count}) is appended to chaingraph/kernels/registry-lineage-records.json
// (the lineage generator's read-only INPUT) by the separate row tooling
// scripts/append-absence-lineage-record.mjs — kept OUT of this file
// deliberately, so this regen script's statically measured write set is
// exactly the one artifact its COVERED entry declares (SO #47). When a future
// node registration grows the key set, --check's lineage-binding section goes
// red BY DESIGN until that two-command append+publish runs — the remedy is
// printed with the failure (same philosophy as the node-registration gap
// gate: a registry surface that silently stops matching its anchor is the
// drift this lane exists to make visible).
//
// ── SITEMAP (spec §5.3, SO #19) ──────────────────────────────────────────────
// registry/absence/tree.json is machine-fetched data feeding proof
// construction, not a human-readable page; it is DELIBERATELY EXCLUDED from
// sitemap.xml and scripts/published-dirs.json. Recorded here, once, so it
// reads as a decision to any future row touching published-dirs.json.
//
// ── ADDITIVE-ONLY (spec §2.4) ────────────────────────────────────────────────
// This surface informs trust in the registry; it is never a verification
// dependency of any receipt. Zero network calls anywhere in this file's call
// graph — every byte comes from the local tree.
//
// Zero-dep (CONTRACT.md): Node builtins + WebCrypto only.
//
// Usage:
//   node scripts/gen-registry-absence-tree.mjs --write   # regenerate tree.json
//   node scripts/gen-registry-absence-tree.mjs --check   # freshness + lineage binding (preflight)
//   node scripts/append-absence-lineage-record.mjs       # append the derived lineage record (row tooling)
//
// Exit codes: 0 ok · 1 --check failure (each failure class prints its remedy) · 2 usage.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashLeafNode, hashInteriorNode, sha256, concatBytes, parseSignedNote, bytesToHex, hexToBytes, bytesEqual,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';
import { mth, readEntryBundles } from './gen-registry-lineage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KEY_DIR = resolve(REPO, 'registry', 'kernel');
const OUT_DIR = resolve(REPO, 'registry', 'absence');
const OUT_PATH = resolve(OUT_DIR, 'tree.json');
const LINEAGE_DIR = resolve(REPO, 'registry', 'lineage');
const LINEAGE_CHECKPOINT = resolve(LINEAGE_DIR, 'checkpoint');

export const PROOFSPEC_NAME = 'ainumbers-simple-v1';
export const ABSENCE_ANCHOR_TYPE = 'ainumbers-absence-tree-v1';

const HEX64 = /^[0-9a-f]{64}$/;

function compareKeys(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// ---------------------------------------------------------------------------
// Key set — read from the landed F2 records, validate, sort by RAW BYTE value.
// ---------------------------------------------------------------------------

export function loadKeySet(keyDir = KEY_DIR) {
  if (!existsSync(keyDir)) {
    throw new Error(`gen-registry-absence-tree: ${keyDir} does not exist — the F2 key set has never been generated. Run: node scripts/gen-registry-kernel-resolve.mjs --write`);
  }
  const entries = [];
  for (const name of readdirSync(keyDir)) {
    if (!name.endsWith('.json')) continue;
    const hex = name.slice(0, -'.json'.length);
    if (!HEX64.test(hex)) {
      throw new Error(`gen-registry-absence-tree: registry/kernel/${name} is not a <64hex>.json record — the key set is derived strictly from the landed F2 record files, and this name is not one (a human decides what it is; this generator never deletes anything)`);
    }
    const record = JSON.parse(readFileSync(resolve(keyDir, name), 'utf8'));
    if (record.kernel_digest !== `sha256:${hex}`) {
      throw new Error(`gen-registry-absence-tree: registry/kernel/${name} content-address violation — kernel_digest field (${record.kernel_digest}) does not match the filename. The key set is unusable until the F2 generator rewrites it.`);
    }
    if (typeof record.kernel_digest !== 'string' || !record.kernel_digest.startsWith('sha256:')) {
      throw new Error(`gen-registry-absence-tree: registry/kernel/${name} has no sha256: kernel_digest`);
    }
    entries.push({ hex, keyBytes: hexToBytes(hex), record });
  }
  entries.sort((a, b) => compareKeys(a.keyBytes, b.keyBytes));
  for (let i = 1; i < entries.length; i++) {
    if (compareKeys(entries[i - 1].keyBytes, entries[i].keyBytes) === 0) {
      throw new Error(`gen-registry-absence-tree: duplicate kernel_digest key ${entries[i].hex} in the sorted key set`);
    }
  }
  return entries;
}

// The leaf VALUE is the RFC 8785/JCS-canonical bytes of the resolution record,
// through the estate's one canonicalizer — never the file's on-disk bytes (SO
// #34: recompute from the record content, never trust a byte a previous
// process wrote).
export function valueBytesFor(record) {
  return new TextEncoder().encode(JSON.stringify(cgCanon(record)));
}

// leaf = SHA-256(0x00 ‖ key(32) ‖ SHA-256(value)) — BUILD-SPEC §4.2's node hash,
// assembled ONLY from the shared module's primitives:
// hashLeafNode(data) = SHA-256(0x00 ‖ data), so data = key(32) ‖ SHA-256(value).
export async function leafHashFor(entry) {
  const valueHash = await sha256(valueBytesFor(entry.record));
  return hashLeafNode(concatBytes([entry.keyBytes, valueHash]));
}

// ---------------------------------------------------------------------------
// RFC 6962 dense tree: level 0 = sorted leaf hashes; each level pairs
// neighbours and carries an odd trailing node up UNCHANGED (complete-left).
// The root is cross-checked against mth() from gen-registry-lineage.mjs — the
// recursive largest-power-of-two split — two independent derivations that must
// agree before anything is built or written.
// ---------------------------------------------------------------------------

export async function buildLevels(leafHashes) {
  const levels = [leafHashes];
  let cur = leafHashes;
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(i + 1 < cur.length ? await hashInteriorNode(cur[i], cur[i + 1]) : cur[i]);
    }
    levels.push(next);
    cur = next;
  }
  return levels;
}

export async function buildAbsenceTree(entries) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error(
      `gen-registry-absence-tree: an empty or single-leaf tree cannot produce a valid non-existence proof ` +
      `(SO #34c: absence is a distinct FAILING state, never "absence proven") — refusing to build or publish ` +
      `an absence tree over ${entries ? entries.length : 'a non-array'} key(s). The absence lane requires >= 2 keys.`,
    );
  }
  const leafHashes = await Promise.all(entries.map(leafHashFor));
  const levels = await buildLevels(leafHashes);
  const root = levels[levels.length - 1][0];
  const mthRoot = await mth(leafHashes, 0, leafHashes.length);
  if (!bytesEqual(root, mthRoot)) {
    throw new Error(
      `gen-registry-absence-tree: INTERNAL — iterative dense-tree root (${bytesToHex(root)}) and the shared ` +
      `module's mth() root (${bytesToHex(mthRoot)}) disagree; this is a builder bug, not data. Nothing is built.`,
    );
  }
  return { entries, leafHashes, levels, root, count: entries.length };
}

// ---------------------------------------------------------------------------
// ICS23 proof CONSTRUCTION under ainumbers-simple-v1 (verification is ALWAYS
// ics23-verify.mjs — this module never verifies anything itself).
// Left-child step:  InnerOp { prefix: 0x01 (len 1),        suffix: sibling (len 32) }
// Right-child step: InnerOp { prefix: 0x01 ‖ sibling (33), suffix: empty (len 0) }
// exactly the two legal shapes BUILD-SPEC §4.2 derives from the pinned bounds.
// ---------------------------------------------------------------------------

export function existenceProofAt(tree, index, keyEntry) {
  const path = [];
  let pos = index;
  for (let L = 0; L < tree.levels.length - 1; L++) {
    const cur = tree.levels[L];
    if (pos % 2 === 0 && pos + 1 < cur.length) {
      path.push({ hash: 1, prefix: Uint8Array.of(0x01), suffix: cur[pos + 1] });
    } else if (pos % 2 === 1) {
      path.push({ hash: 1, prefix: concatBytes([Uint8Array.of(0x01), cur[pos - 1]]), suffix: undefined });
    }
    // else: odd-length level's promoted last node — no sibling at this level,
    // the node itself carries up unchanged; no InnerOp exists for the skip.
    pos = Math.floor(pos / 2);
  }
  return {
    key: keyEntry.keyBytes,
    value: valueBytesFor(keyEntry.record),
    leaf: { hash: 1, prehash_key: 0, prehash_value: 1, length: 0, prefix: Uint8Array.of(0x00) },
    path,
  };
}

// Non-existence proof for `keyBytes`: the two adjacent existing leaves bracketing
// the insertion point (lower-bound binary search over the RAW-BYTE-sorted keys).
// Edge gaps yield null on one side (verifier enforces left-most/right-most there).
export function nonExistenceProofFor(tree, keyBytes) {
  const { entries } = tree;
  let lo = 0, hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareKeys(entries[mid].keyBytes, keyBytes) < 0) lo = mid + 1; else hi = mid;
  }
  const p = lo;
  if (p < entries.length && compareKeys(entries[p].keyBytes, keyBytes) === 0) {
    throw new Error(`gen-registry-absence-tree: key ${bytesToHex(keyBytes)} is PRESENT in the key set — a non-existence proof for a present key is not constructible`);
  }
  return {
    key: keyBytes,
    left: p > 0 ? existenceProofAt(tree, p - 1, entries[p - 1]) : null,
    right: p < entries.length ? existenceProofAt(tree, p, entries[p]) : null,
  };
}

// ---------------------------------------------------------------------------
// Artifact: the minimal generated surface a consumer needs to rebuild the tree
// and construct/verify proofs against the lineage-committed root. Pure
// function of the key set — no wall-clock, no liveness promise (spec §9.2).
// ---------------------------------------------------------------------------

export function absenceArtifact(tree) {
  return {
    proofspec: PROOFSPEC_NAME,
    key_count: tree.count,
    root: bytesToHex(tree.root),
    keys: tree.entries.map((e) => e.hex),
    leaf_value_hashes: tree.leafHashes.map((h) => bytesToHex(h)),
  };
}

export function artifactBytes(tree) {
  return JSON.stringify(absenceArtifact(tree), null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// Lineage binding (BUILD-SPEC §4.4): {tree_root, key_count} as ONE entry of the
// lineage log. The record SHAPE is defined here (absenceLineageRecord — also
// the absence artifact's own vocabulary); the guarded APPEND that writes it to
// the lineage generator's INPUT list lives in the separate row tooling
// scripts/append-absence-lineage-record.mjs, NOT in this regen script — see
// the SINGLE WRITER section above.
// ---------------------------------------------------------------------------

export function absenceLineageRecord(tree) {
  return {
    anchor_type: ABSENCE_ANCHOR_TYPE,
    source: 'registry-absence-tree',
    proofspec: PROOFSPEC_NAME,
    tree_root: `sha256:${bytesToHex(tree.root)}`,
    key_count: tree.count,
    note: 'Sorted-key ainumbers-simple-v1 absence tree over the F2 registry/kernel key set (REGISTRY-TILES-BUILD-SPEC.md §4.4): tree_root + key_count committed so absence is proven against an anchored, consistency-checkable history. Derived by scripts/append-absence-lineage-record.mjs from the recomputed tree — never hand-authored.',
  };
}

// ---------------------------------------------------------------------------
// --check: freshness (tree.json == recompute from the key set) + lineage
// binding (the lineage log's absence entry == the recomputed root). Every
// failure is a DISTINCT failing state (SO #34c) and prints its remedy.
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`✗ gen-registry-absence-tree --check: ${msg}`);
  process.exit(1);
}

export async function check({ log = console.log, error = console.error } = {}) {
  let tree;
  try {
    tree = await buildAbsenceTree(loadKeySet());
  } catch (e) {
    fail(`the F2 key set cannot produce an absence tree: ${e.message}`);
  }
  const derived = artifactBytes(tree);

  if (!existsSync(OUT_PATH)) {
    fail(`no absence tree published at registry/absence/tree.json — a missing artifact is a FAILING state (SO #34c), never a vacuous pass. Run: node scripts/gen-registry-absence-tree.mjs --write`);
  }
  const onDisk = readFileSync(OUT_PATH, 'utf8');
  if (onDisk !== derived) {
    fail(`registry/absence/tree.json is STALE — on-disk bytes do not match the tree recomputed from the current ${tree.count}-key F2 set (recomputed root ${bytesToHex(tree.root)}). Run: node scripts/gen-registry-absence-tree.mjs --write`);
  }

  if (!existsSync(LINEAGE_CHECKPOINT)) {
    fail(`no lineage checkpoint published at registry/lineage/checkpoint — the absence root cannot be bound to an anchored history (BUILD-SPEC §4.4). Remedy: node scripts/append-absence-lineage-record.mjs && node scripts/gen-registry-lineage.mjs`);
  }
  let lineageSize, lineageEntries;
  try {
    lineageSize = parseSignedNote(readFileSync(LINEAGE_CHECKPOINT, 'utf8')).size;
    lineageEntries = readEntryBundles(LINEAGE_DIR, lineageSize);
  } catch (e) {
    fail(`failed to read the published lineage log (size ${lineageSize ?? '?'}): ${e.message}`);
  }
  const absenceRecords = [];
  for (let i = 0; i < lineageEntries.length; i++) {
    let rec;
    try { rec = JSON.parse(new TextDecoder().decode(lineageEntries[i])); } catch { continue; }
    if (rec && rec.anchor_type === ABSENCE_ANCHOR_TYPE) absenceRecords.push({ index: i, rec });
  }
  if (absenceRecords.length === 0) {
    fail(`the lineage log (size ${lineageSize}) contains NO ${ABSENCE_ANCHOR_TYPE} entry — absence is currently proven against nothing (SO #34c). Remedy: node scripts/append-absence-lineage-record.mjs && node scripts/gen-registry-lineage.mjs`);
  }
  const last = absenceRecords[absenceRecords.length - 1];
  const boundRoot = String(last.rec.tree_root ?? '').replace(/^sha256:/, '');
  if (boundRoot !== bytesToHex(tree.root) || last.rec.key_count !== tree.count) {
    fail(
      `LINEAGE BINDING STALE — the lineage log's latest absence-tree entry (index ${last.index}, ` +
      `tree_root ${boundRoot}, key_count ${last.rec.key_count}) does not match the tree recomputed from the ` +
      `current ${tree.count}-key F2 set (root ${bytesToHex(tree.root)}). The key set grew or moved without a ` +
      `lineage append. Remedy: node scripts/append-absence-lineage-record.mjs && node scripts/gen-registry-lineage.mjs`,
    );
  }

  log(`✓ gen-registry-absence-tree --check PASSED: ainumbers-simple-v1 tree over ${tree.count} F2 key(s), root ${bytesToHex(tree.root)}, artifact current, lineage entry index ${last.index} bound (lineage size ${lineageSize}).`);
  return { ok: true, count: tree.count, root: bytesToHex(tree.root), lineageEntryIndex: last.index };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const mode = process.argv.includes('--write') ? 'write'
    : process.argv.includes('--check') ? 'check' : null;
  if (!mode) {
    console.error('usage: gen-registry-absence-tree.mjs --write | --check');
    process.exit(2);
  }

  if (mode === 'check') return check();

  const tree = await buildAbsenceTree(loadKeySet());

  mkdirSync(OUT_DIR, { recursive: true });
  const derived = artifactBytes(tree);
  if (existsSync(OUT_PATH) && readFileSync(OUT_PATH, 'utf8') === derived) {
    console.log(`✓ gen-registry-absence-tree: registry/absence/tree.json already current — ainumbers-simple-v1 tree over ${tree.count} F2 key(s), root ${bytesToHex(tree.root)}.`);
    return;
  }
  writeFileSync(OUT_PATH, derived);
  console.log(`✓ gen-registry-absence-tree: wrote registry/absence/tree.json — ainumbers-simple-v1 tree over ${tree.count} F2 key(s), root ${bytesToHex(tree.root)}.`);
  console.log('  bind it: node scripts/append-absence-lineage-record.mjs');
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
