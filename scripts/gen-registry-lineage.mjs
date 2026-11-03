#!/usr/bin/env node
// scripts/gen-registry-lineage.mjs — F3 anchor-lineage log, published as C2SP
// tlog-tiles-addressed static files under registry/lineage/.
// Landed per REGISTRY-LINEAGE-TILES-BUILD-1 (REGISTRY-TILES-BUILD-SPEC.md §3.2,
// §3.3, §5, §6). Generated, gate-verified, additive — no liveness duty, per
// Tim's 2026-08-17 ruling (an artefact this generator cannot produce and
// gate-verify end-to-end is not shipped; the row checks off BLOCKED instead).
//
// ── WHAT THIS FILE DOES ──────────────────────────────────────────────────────
// 1. Reads chaingraph/kernels/registry-lineage-records.json (INPUT, hand-
//    appended by an operator/future row — NEVER written by this generator,
//    same read-only relationship this lane has with chaingraph.json, §5.2/5.3).
// 2. Each record becomes one leaf: RFC 8785/JCS canonical bytes (via
//    chaingraph/kernels/_hash.mjs's jcsStringify — the ONE canonicalizer, never
//    hand-rolled) hashed with hashLeafNode from the shared C2SP module.
// 3. Builds the RFC 6962 dense tree over those leaf hashes and the C2SP
//    tlog-tiles tile/partial-tile/entry-bundle layout (§3.3) in memory.
// 4. Recomputes the PREVIOUS root from tile bytes ALREADY ON DISK (never from
//    a field this run itself would write) and verifies the new tree extends
//    it via verifyConsistency (§2.3, SO #34) — aborts, writes nothing, on
//    failure.
// 5. Formats + signs the checkpoint (Ed25519, log-operator key held OUTSIDE
//    this repo — env REGISTRY_LINEAGE_LOG_KEY when set [LINEAGE-PUBLISH-IN-
//    REGEN-1 route A: the repository Actions secret of the same name], else
//    the operator desk's workspace-root research/registry-lineage-log-key.priv.jwk.json).
// 6. Submits the checkpoint bytes to Sigsum via `register-sigsum.mjs register`
//    (spawned, never duplicated) and stores the returned record. ⛔ If this
//    step FAILS, NOTHING is written to disk — an unanchored head is a
//    strictly weaker claim than what this lane promises (§2.1). EXCEPTION
//    (LINEAGE-SIGSUM-TOLERANCE-2380-1, [7F-V459](a)/[7F-V460]): the Sigsum
//    submit/token keys STAY OFFLINE (desk-only files, never repo or Actions
//    secrets), so when they are ABSENT the submission is not attempted — the
//    run signs with the log key, writes everything, and records
//    `sigsum: pending` instead of failing. A key pair that is PRESENT but
//    whose submit fails remains fail-closed.
// 7. Only once every step above has succeeded does it write tiles + entry
//    bundles + checkpoint + Sigsum record to registry/lineage/.
//
// `--check` mode (wired into scripts/preflight.mjs) does NONE of the above —
// it re-derives the leaf hashes from the tile/entry bytes ALREADY PUBLISHED on
// disk, recomputes the root, and confirms it matches the currently published,
// signature-verified checkpoint. A single flipped byte in any published tile
// or entry bundle changes the recomputed root and turns this red (SO #34,
// verified by mutation — never by code review alone).
//
// ⛔ No second Merkle implementation (SPEC §20.1): every hash call below goes
// through chaingraph/kernels/c2sp-tlog-verify.mjs's hashLeafNode/
// hashInteriorNode/sha256/verifyConsistency/formatCheckpoint/parseSignedNote.
// The SUBPROOF/PROOF consistency-PROOF *construction* below is new (the
// shared module ships the verifier only) but calls only those primitives —
// proof construction, not a new hash algorithm (REGISTRY-LINEAGE-TILES-
// BUILD-1's explicit allowance).
//
// ⛔ Sitemap: registry/lineage/** is machine-fetched binary tile data, not a
// human-readable page, and is DELIBERATELY EXCLUDED from sitemap.xml (spec
// §5.3, SO #19). `registry` is NOT added to scripts/published-dirs.json.
// This decision is recorded here, once, so it reads as a decision to any
// future row that touches published-dirs.json or regen-sitemap.mjs.
//
// ⛔ No pruning, ever (§3.3): a full tile's bytes never change once written
// (block hashes are stable-forever positions in the RFC 6962 history-tree
// structure); a partial tile is superseded by a NEW file at a NEW `.p/<W>`
// path as the group fills in, and the old `.p/<W>` file is left untouched —
// never deleted, never overwritten with different bytes for the same path.
//
// Zero-dep (CONTRACT.md): Node builtins + WebCrypto only.
//
// Usage:
//   node scripts/gen-registry-lineage.mjs            # generate + publish + Sigsum-anchor
//   node scripts/gen-registry-lineage.mjs --check     # read-only recompute-and-verify (preflight)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { webcrypto } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashLeafNode, hashInteriorNode, sha256,
  verifyConsistency, formatCheckpoint, parseSignedNote,
  bytesToHex, hexToBytes, bytesToBase64, concatBytes, bytesEqual,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';
import { jcsStringify } from '../chaingraph/kernels/_hash.mjs';

const subtle = webcrypto.subtle;

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// A worktree's own parent is `.wt/<name>`, not the workspace root — resolve
// the workspace root via the shared git-common-dir (always the main `repo/.git`,
// even from a worktree) so internal-artifact paths under `research/` land
// correctly regardless of which worktree this script runs from.
// env: gitEnv() is load-bearing here specifically: an inherited GIT_DIR would make
// --git-common-dir report the OUTER repo's common dir, and WORKSPACE_ROOT is derived from it — so
// every internal-artifact path under research/ would be resolved against the wrong workspace.
const GIT_COMMON_DIR = resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO, env: gitEnv(), encoding: 'utf8' }).trim());
const WORKSPACE_ROOT = resolve(GIT_COMMON_DIR, '../..');
const RECORDS_PATH = resolve(REPO, 'chaingraph/kernels/registry-lineage-records.json');
const REGISTRY_DIR = resolve(REPO, 'registry/lineage');
const CHECKPOINT_PATH = join(REGISTRY_DIR, 'checkpoint');
const SIGSUM_RECORD_PATH = join(REGISTRY_DIR, 'checkpoint.sigsum-record.json');
const LOG_PRIVATE_KEY_PATH = resolve(WORKSPACE_ROOT, 'research/registry-lineage-log-key.priv.jwk.json');
const SIGSUM_SUBMIT_KEY_PATH = resolve(WORKSPACE_ROOT, 'research/sigsum-key.priv.jwk.json');
// Domain-bound submit token (SIGSUM-BUDGET-COUNTER-1 / SO #8 fix, verified live
// 2026-08-20): without this, add-leaf falls into seasalp's shared "unknown
// domain" bucket and 429s. The token key's public half is published as the
// DNS TXT record at _sigsum_v1.ainumbers.co.
const SIGSUM_TOKEN_KEY_PATH = resolve(WORKSPACE_ROOT, 'research/sigsum-token-key.priv.jwk.json');
const SIGSUM_DOMAIN = 'ainumbers.co';
const REGISTER_SIGSUM_SCRIPT = resolve(REPO, 'scripts/register-sigsum.mjs');

const ORIGIN = 'ainumbers.co/registry/lineage';
const LOG_NAME = ORIGIN; // note-signature identifier, same string as the checkpoint origin
const LOG_PUBLIC_KEY_HEX = 'fe5eb9f2560469be7ff76e45fc695459db739a86117b659622cfc92513de13fa';
const TILE_WIDTH = 256; // C2SP tlog-tiles: 256 hashes / 8192 bytes per full tile

// ---------------------------------------------------------------------------
// RFC 6962 MTH — recursive split at the largest power of two below the range
// size (§4.1's pinned pseudocode). Operates on a flat hash array via lo/hi
// bounds so no sub-arrays are copied. This is the SAME split rule the shared
// module's verifyConsistency relies on; only the hash primitives (hashLeafNode/
// hashInteriorNode) are imported, never reimplemented.
// ---------------------------------------------------------------------------
export async function mth(hashes, lo, hi) {
  if (hi - lo === 1) return hashes[lo];
  let k = 1;
  while (k * 2 < hi - lo) k *= 2;
  return hashInteriorNode(await mth(hashes, lo, lo + k), await mth(hashes, lo + k, hi));
}

export function largestPow2LessThan(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

// RFC 6962 §2.1.2 SUBPROOF/PROOF construction (verifier-consuming form) —
// standard algorithm (CT reference client / golang.org/x/mod/sumdb/tlog.ProveTree),
// operating over lo/hi bounds into the flat NEW leaf-hash array. Calls only
// mth() (itself calling only the two shared hash primitives) — proof
// CONSTRUCTION, not a new hash algorithm; see header comment.
export async function subproof(m, D, lo, hi, haveRootHash) {
  const n = hi - lo;
  if (m === n) return haveRootHash ? [] : [await mth(D, lo, hi)];
  const k = largestPow2LessThan(n);
  if (m <= k) {
    const left = await subproof(m, D, lo, lo + k, haveRootHash);
    return [...left, await mth(D, lo + k, hi)];
  }
  const right = await subproof(m - k, D, lo + k, hi, false);
  return [...right, await mth(D, lo, lo + k)];
}

export async function buildConsistencyProof(oldSize, newLeafHashes) {
  if (oldSize === 0) return []; // genesis: no proof exists; generate() checks the root instead
  return subproof(oldSize, newLeafHashes, 0, newLeafHashes.length, true);
}

// ---------------------------------------------------------------------------
// C2SP tlog-tiles path encoding (§3.3): <N> is zero-padded 3-digit decimal
// groups, ALL BUT THE LAST prefixed literal "x". Index 1234067 -> x001/x234/067;
// index 0 -> 000; index 5 -> 005.
// ---------------------------------------------------------------------------
export function encodeTileIndexParts(N) {
  let s = String(N);
  while (s.length % 3 !== 0) s = '0' + s;
  const groups = [];
  for (let i = 0; i < s.length; i += 3) groups.push(s.slice(i, i + 3));
  return groups.map((g, i) => (i < groups.length - 1 ? `x${g}` : g));
}

export function fullTilePath(baseDir, N) {
  return join(baseDir, ...encodeTileIndexParts(N));
}

export function partialTilePath(baseDir, N, W) {
  const parts = encodeTileIndexParts(N);
  const last = parts.pop();
  return join(baseDir, ...parts, `${last}.p`, String(W));
}

// ---------------------------------------------------------------------------
// Tiling: split a flat array (of 32-byte hashes, or raw byte-array entries)
// of length `count` into full groups of TILE_WIDTH plus at most one partial
// trailing group. Returns [{ N, start, len, isPartial }]. Empty tiles are
// never emitted (a `count` that is an exact multiple of TILE_WIDTH produces
// no partial group at all) — §3.3's "empty tiles MUST NOT be served".
// ---------------------------------------------------------------------------
export function tileGroups(count) {
  const groups = [];
  const full = Math.floor(count / TILE_WIDTH);
  for (let N = 0; N < full; N++) groups.push({ N, start: N * TILE_WIDTH, len: TILE_WIDTH, isPartial: false });
  const rem = count % TILE_WIDTH;
  if (rem > 0) groups.push({ N: full, start: full * TILE_WIDTH, len: rem, isPartial: true });
  return groups;
}

export function u16be(n) {
  if (n > 0xffff) throw new Error(`entry length ${n} exceeds uint16`);
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

// ---------------------------------------------------------------------------
// Level construction: level 0 = leaf hashes. Level L (L>=1) block hash for
// index i = MTH over the aligned, power-of-two-width range of level-(L-1)
// block hashes [i*256, (i+1)*256) — valid because 256=2^8 is itself a power
// of two, so this always splits evenly (no incomplete-subtree ambiguity),
// and because a complete, aligned power-of-two subtree's hash is STABLE
// forever in the RFC 6962 history-tree structure regardless of how much the
// tree later grows (the well-known fact underlying CT/tlog append-only
// trees and consistency proofs). A level is only built while a FULL group of
// 256 lower-level entries exists; a level with fewer than 256 entries is
// still published (as a single partial tile) but has no further level above it.
// ---------------------------------------------------------------------------
export async function computeLevels(leafHashes) {
  const levels = [leafHashes];
  let cur = leafHashes;
  while (cur.length > 0) {
    const nextCount = Math.floor(cur.length / TILE_WIDTH);
    if (nextCount === 0) break;
    const next = [];
    for (let i = 0; i < nextCount; i++) next.push(await mth(cur, i * TILE_WIDTH, i * TILE_WIDTH + TILE_WIDTH));
    levels.push(next);
    cur = next;
  }
  return levels;
}

export function levelTileFiles(registryDir, level, arr) {
  const files = [];
  for (const g of tileGroups(arr.length)) {
    const bytes = concatBytes(arr.slice(g.start, g.start + g.len));
    const path = g.isPartial ? partialTilePath(join(registryDir, 'tile', String(level)), g.N, g.len)
                              : fullTilePath(join(registryDir, 'tile', String(level)), g.N);
    files.push([path, bytes]);
  }
  return files;
}

export function entriesBundleFiles(registryDir, entryByteArrays) {
  const files = [];
  for (const g of tileGroups(entryByteArrays.length)) {
    const parts = [];
    for (let i = g.start; i < g.start + g.len; i++) {
      parts.push(u16be(entryByteArrays[i].length), entryByteArrays[i]);
    }
    const bytes = concatBytes(parts);
    const path = g.isPartial ? partialTilePath(join(registryDir, 'tile', 'entries'), g.N, g.len)
                              : fullTilePath(join(registryDir, 'tile', 'entries'), g.N);
    files.push([path, bytes]);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Read-back: reconstruct the level-0 leaf-hash array for a given `size` from
// already-published tile files on disk. Used BOTH by the write path (to
// recompute the previous root before publishing, §2.3) and by --check (to
// recompute the CURRENT published root and catch a mutated byte, SO #34).
// Throws if any expected file is missing or short — absence is a distinct
// FAILING state (SO #34c), never treated as zero leaves found.
// ---------------------------------------------------------------------------
export function readLevel0LeafHashes(registryDir, size) {
  const hashes = [];
  for (const g of tileGroups(size)) {
    const path = g.isPartial ? partialTilePath(join(registryDir, 'tile', '0'), g.N, g.len)
                              : fullTilePath(join(registryDir, 'tile', '0'), g.N);
    const buf = readFileSync(path);
    if (buf.length !== g.len * 32) throw new Error(`level-0 tile ${path}: expected ${g.len * 32} bytes, got ${buf.length}`);
    for (let i = 0; i < g.len; i++) hashes.push(new Uint8Array(buf.subarray(i * 32, (i + 1) * 32)));
  }
  return hashes;
}

// Reads every entries bundle for `size` leaves and returns the raw entry byte
// arrays in leaf order — used by --check to cross-verify each entry hashes to
// its corresponding level-0 tile hash (spec §3.3's entry-bundle invariant).
export function readEntryBundles(registryDir, size) {
  const entries = [];
  for (const g of tileGroups(size)) {
    const path = g.isPartial ? partialTilePath(join(registryDir, 'tile', 'entries'), g.N, g.len)
                              : fullTilePath(join(registryDir, 'tile', 'entries'), g.N);
    const buf = readFileSync(path);
    let off = 0;
    for (let i = 0; i < g.len; i++) {
      if (off + 2 > buf.length) throw new Error(`entries bundle ${path}: truncated length prefix at entry ${i}`);
      const len = (buf[off] << 8) | buf[off + 1];
      off += 2;
      if (off + len > buf.length) throw new Error(`entries bundle ${path}: truncated entry ${i} (declared ${len} bytes)`);
      entries.push(new Uint8Array(buf.subarray(off, off + len)));
      off += len;
    }
    if (off !== buf.length) throw new Error(`entries bundle ${path}: ${buf.length - off} trailing byte(s) after last entry`);
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Checkpoint signing (signed-note.md framing, tlog-checkpoint.md body).
// keyHint = SHA-256(name + "\n" + algorithmByte(0x01) + rawPubKeyBytes)[0:4]
// (golang.org/x/mod/sumdb/note's keyHash construction, cited in the row spec).
// ---------------------------------------------------------------------------
export async function signCheckpointBody(bodyText, privateKey, pubKeyBytes, name) {
  const bodyBytes = new TextEncoder().encode(bodyText);
  const sigBytes = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, bodyBytes));
  const nameLine = new TextEncoder().encode(`${name}\n`);
  const keyHintFull = await sha256(nameLine, new Uint8Array([0x01]), pubKeyBytes);
  const keyHint = keyHintFull.slice(0, 4);
  const payload = concatBytes([keyHint, sigBytes]);
  return `— ${name} ${bytesToBase64(payload)}`; // U+2014 EM DASH, per signed-note.md
}

export async function verifyCheckpointSignature(noteText, cosig, pubKeyBytes, name) {
  const nameLine = new TextEncoder().encode(`${name}\n`);
  const keyHintFull = await sha256(nameLine, new Uint8Array([0x01]), pubKeyBytes);
  const expectedHint = bytesToHex(keyHintFull.slice(0, 4));
  if (cosig.keyIdHex !== expectedHint) return false;
  const pubKey = await subtle.importKey('raw', pubKeyBytes, { name: 'Ed25519' }, true, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, pubKey, cosig.sigBytes, new TextEncoder().encode(noteText));
}

// ---------------------------------------------------------------------------
// Input loading + leaf-byte canonicalization.
// ---------------------------------------------------------------------------
export function loadRecords() {
  const parsed = JSON.parse(readFileSync(RECORDS_PATH, 'utf8'));
  if (!Array.isArray(parsed.records)) throw new Error(`${RECORDS_PATH}: expected a top-level "records" array`);
  return parsed.records;
}

export function canonicalEntryBytes(record) {
  return new TextEncoder().encode(jcsStringify((record)));
}

// ---------------------------------------------------------------------------
// Log-operator key SOURCE (LINEAGE-PUBLISH-IN-REGEN-1, route A per Tim's
// 2026-10-08 ruling "Route A: key into Actions secret"): on CI the key arrives
// as the repository Actions secret REGISTRY_LINEAGE_LOG_KEY (via env); at the
// operator desk it stays the on-disk workspace path. The SIGNING path below is
// byte-identical either way — only the key bytes' ORIGIN changes. Precedence is
// deliberate: an explicit opts.logPrivateKeyPath (the test harness's scratch
// keys) still wins over the env var, so an inherited REGISTRY_LINEAGE_LOG_KEY
// can never make a test sign with the real operator key; env wins over the
// default file path. An empty/whitespace env var counts as NOT SET (a workflow
// mapping `env: X: ${{ secrets.X }}` to an unavailable secret resolves to ''),
// which falls back to the file path and fails loudly there — fail-closed, same
// as every other missing-input shape.
// ⛔ The env var's VALUE is secret: the error below names the secret NAME only
// and never echoes bytes; nothing else in this file may print it either.
// ---------------------------------------------------------------------------
export function loadLogPrivateKeyJwk(pathOverride) {
  if (pathOverride) return JSON.parse(readFileSync(pathOverride, 'utf8'));
  const envKey = process.env.REGISTRY_LINEAGE_LOG_KEY;
  if (envKey !== undefined && envKey.trim() !== '') {
    try {
      return JSON.parse(envKey);
    } catch (e) {
      throw new Error('REGISTRY_LINEAGE_LOG_KEY (env) is set but does not parse as a JWK — refusing to sign. The secret NAME is printed here, never its value.');
    }
  }
  return JSON.parse(readFileSync(LOG_PRIVATE_KEY_PATH, 'utf8'));
}

// Reads the existing record at `recordPath` and returns it ONLY when it is a
// fully-formed Sigsum anchor — the shape gen-trust-signals' sigsumSignal
// requires (anchor_type c2sp-tlog-proof-v1, integer inclusion_proof.leaf_index,
// Array witness_cosignatures[]). Any pending record, malformed JSON, or
// missing file returns null so the caller falls through to the pending flow.
// This is a shape test only: it never verifies the anchor's hash against the
// new checkpoint (—check is the verifier; the hold exists to keep a real
// anchor from being DEMOTED, not to attest a new tree).
function readFullyFormedAnchor(recordPath) {
  if (!existsSync(recordPath)) return null;
  let record = null;
  try {
    record = JSON.parse(readFileSync(recordPath, 'utf8'));
  } catch {
    return null;
  }
  if (!record || record.anchor_type !== 'c2sp-tlog-proof-v1') return null;
  if (!Number.isInteger(record?.inclusion_proof?.leaf_index)) return null;
  if (!Array.isArray(record?.witness_cosignatures)) return null;
  return record;
}

// ---------------------------------------------------------------------------
// Sigsum submission — spawns the EXISTING register-sigsum.mjs `register`
// command (never duplicated), mirroring scripts/fv-sigsum-upgrade-flip.mjs's
// invocation shape. Throws on any non-zero exit; the caller must not write
// anything to disk if this throws (§2.1: publish nothing if this step fails).
// ---------------------------------------------------------------------------
function submitCheckpointToSigsum(checkpointBytes) {
  return (async () => {
    const hashHex = bytesToHex(await sha256(checkpointBytes));
    const outPath = resolve(WORKSPACE_ROOT, `research/registry-lineage-sigsum-record-${Date.now()}.json`);
    const args = [
      REGISTER_SIGSUM_SCRIPT, 'register', '--hash', `sha256:${hashHex}`, '--key', SIGSUM_SUBMIT_KEY_PATH, '--out', outPath,
      '--token-key', SIGSUM_TOKEN_KEY_PATH, '--domain', SIGSUM_DOMAIN,
    ];
    console.log(`▶ submitting checkpoint (sha256:${hashHex}) to Sigsum via register-sigsum.mjs …`);
    let stdout;
    try {
      stdout = execFileSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    } catch (e) {
      throw new Error(`Sigsum registration FAILED — publishing nothing (§2.1, BUILD-SPEC §6 step 5):\n${e.stdout || ''}${e.stderr || e.message}`);
    }
    console.log(stdout.trim());
    const record = JSON.parse(readFileSync(outPath, 'utf8'));
    return record;
  })();
}

// ---------------------------------------------------------------------------
// Full generate + publish + anchor.
// ---------------------------------------------------------------------------
export async function generate(opts = {}) {
  const registryDir = opts.registryDir || REGISTRY_DIR;
  const checkpointPath = opts.checkpointPath || join(registryDir, 'checkpoint');
  const sigsumRecordPath = opts.sigsumRecordPath || join(registryDir, 'checkpoint.sigsum-record.json');
  const records = opts.records || loadRecords();

  const entryByteArrays = records.map(canonicalEntryBytes);
  const leafHashes = await Promise.all(entryByteArrays.map((b) => hashLeafNode(b)));
  const size = leafHashes.length;
  if (size === 0) {
    console.log('registry-lineage-records.json has zero records — nothing to publish (not an error, but also not a publish).');
    return;
  }
  const newRoot = await mth(leafHashes, 0, size);

  // ── §2.3 consistency gate: recompute the OLD root from tile bytes ALREADY
  // ON DISK (never from a field this run would write), then verify the new
  // tree extends it. Runs BEFORE any write. ──────────────────────────────
  let oldSize = 0;
  if (existsSync(checkpointPath)) {
    const oldCheckpointText = readFileSync(checkpointPath, 'utf8');
    const oldParsed = parseSignedNote(oldCheckpointText);
    if (oldParsed.origin !== ORIGIN) throw new Error(`existing checkpoint origin "${oldParsed.origin}" != "${ORIGIN}" — refusing to proceed`);
    oldSize = oldParsed.size;
    if (oldSize > 0) {
      const oldLeafHashes = readLevel0LeafHashes(registryDir, oldSize);
      const recomputedOldRoot = await mth(oldLeafHashes, 0, oldSize);
      if (!bytesEqual(recomputedOldRoot, oldParsed.rootHash)) {
        throw new Error(
          `CONSISTENCY GATE FAILED (pre-existing corruption): the root recomputed from currently-published ` +
          `tile bytes (${bytesToHex(recomputedOldRoot)}) does not match the currently-published checkpoint's ` +
          `own root (${bytesToHex(oldParsed.rootHash)}) at size ${oldSize}. Refusing to publish on top of an ` +
          `already-inconsistent tree. Investigate before re-running.`
        );
      }
    }
  }

  if (size < oldSize) throw new Error(`new record count (${size}) is SMALLER than the previously published size (${oldSize}) — append-only violated, refusing to publish.`);

  // No new records since the last publish: the already-recomputed-and-verified
  // on-disk tree is unchanged, so there is nothing to re-anchor. Skip BEFORE any
  // network call — re-submitting an identical checkpoint to Sigsum on every
  // invocation would burn add-leaf budget for zero new data on every regen run
  // (derived-artifacts.mjs's own idempotency contract: a second pass with no
  // new input must be a true no-op, network calls included).
  if (size === oldSize) {
    console.log(`registry-lineage: ${size} record(s), unchanged since last publish (size ${oldSize}) — nothing to anchor, skipping.`);
    return;
  }

  const oldRoot = oldSize > 0 ? await mth(readLevel0LeafHashes(registryDir, oldSize), 0, oldSize) : new Uint8Array(32);
  const proof = await buildConsistencyProof(oldSize, leafHashes);
  // RFC 9162 §2.1.4.2 defines no consistency proof from an empty tree, and the
  // shared verifier rejects oldSize 0 (C2SP-TLOG-VERIFY-HEAL-1). At genesis the
  // gate instead asserts the new root IS the RFC 9162 root of the new leaves.
  const consistent = oldSize > 0
    ? await verifyConsistency({ oldSize, newSize: size, oldRoot, newRoot, proof })
    : bytesEqual(newRoot, await mth(leafHashes, 0, size));
  if (!consistent) {
    throw new Error(
      `CONSISTENCY GATE FAILED (§2.3, SO #34): the new tree (size ${size}, root ${bytesToHex(newRoot)}) does ` +
      `NOT verifiably extend the previously published tree (size ${oldSize}, root ${bytesToHex(oldRoot)}). ` +
      `Refusing to publish — do not regenerate harder, investigate the record ordering/canonicalization.`
    );
  }
  console.log(`✓ consistency gate: new tree (size ${size}) verifiably extends old tree (size ${oldSize}).`);

  // ── Build tiles + entry bundles in memory ────────────────────────────────
  const levels = await computeLevels(leafHashes);
  const filesToWrite = [];
  for (let L = 0; L < levels.length; L++) filesToWrite.push(...levelTileFiles(registryDir, L, levels[L]));
  filesToWrite.push(...entriesBundleFiles(registryDir, entryByteArrays));

  // ── Checkpoint: format, sign, self-parse round-trip BEFORE anchoring ─────
  const checkpointBody = formatCheckpoint(ORIGIN, size, newRoot);
  const logJwk = loadLogPrivateKeyJwk(opts.logPrivateKeyPath); // env REGISTRY_LINEAGE_LOG_KEY first, file path otherwise (LINEAGE-PUBLISH-IN-REGEN-1)
  const logPrivateKey = await subtle.importKey('jwk', logJwk, { name: 'Ed25519' }, true, ['sign']);
  const logPublicKeyBytes = hexToBytes(opts.logPublicKeyHex || LOG_PUBLIC_KEY_HEX);
  const sigLine = await signCheckpointBody(checkpointBody, logPrivateKey, logPublicKeyBytes, LOG_NAME);
  const checkpointText = `${checkpointBody}\n${sigLine}\n`;
  const checkpointBytes = new TextEncoder().encode(checkpointText);

  const parsed = parseSignedNote(checkpointText);
  if (parsed.origin !== ORIGIN || parsed.size !== size || !bytesEqual(parsed.rootHash, newRoot)) {
    throw new Error('checkpoint self-parse round-trip MISMATCH — refusing to anchor or publish a checkpoint that does not parse back correctly.');
  }
  const cosig = parsed.cosignatures.find((c) => c.name === LOG_NAME);
  if (!cosig) throw new Error('checkpoint self-parse: no cosignature line found for our own log name.');
  const sigOk = await verifyCheckpointSignature(parsed.noteText, cosig, logPublicKeyBytes, LOG_NAME);
  if (!sigOk) throw new Error('checkpoint self-parse: our own Ed25519 signature failed to verify against our own public key — refusing to publish.');
  console.log('✓ checkpoint self-parse round-trip via parseSignedNote: origin/size/root/signature all confirmed.');

  // ── Sigsum anchoring — MANDATORY unless the Sigsum keys are absent (the
  // keys STAY OFFLINE per [7F-V459](a)/[7F-V460]: the submit key and the
  // domain-bound token key are desk-only, never repo or Actions secrets), or
  // a test harness supplies a stub. Key-absent is the SIGSUM-PENDING flow,
  // NOT a failure: the checkpoint is still signed by the log key (whose own
  // absence still fails closed — the withheld-LOG-key proof is unchanged),
  // tiles + checkpoint + a `sigsum: pending` record are still written, and
  // --check accepts the pending record. A PRESENT key pair whose submit
  // fails is unchanged fail-closed (§2.1): publish nothing on a failed
  // submit that was actually attempted. ──────────────────────────────────
  const submitToSigsum = opts.submitToSigsum || submitCheckpointToSigsum;
  let sigsumRecord;
  const sigsumSubmitKeyPath = opts.sigsumSubmitKeyPath || SIGSUM_SUBMIT_KEY_PATH;
  const sigsumTokenKeyPath = opts.sigsumTokenKeyPath || SIGSUM_TOKEN_KEY_PATH;
  if (opts.submitToSigsum) {
    sigsumRecord = await opts.submitToSigsum(checkpointBytes);
  } else if (existsSync(sigsumSubmitKeyPath) && existsSync(sigsumTokenKeyPath)) {
    sigsumRecord = await submitToSigsum(checkpointBytes);
  } else {
    // HOLD THE LAST FULLY-FORMED ANCHOR (MAIN-REGEN-SIGSUM-ANCHOR-HEAL-1).
    // The keys are ALWAYS absent on the main-side regen runner, so before this
    // hold, every non-skipped publish overwrote a real c2sp-tlog-proof-v1
    // anchor (inclusion_proof.leaf_index + witness_cosignatures[]) with a
    // field-less `sigsum-pending-v1` record — and the same run's
    // gen-trust-signals pass then threw fail-closed on exactly that shape
    // (red since run 38491123351). The record's own note already stated the
    // law ("Never re-stamp an already-anchored checkpoint"); this is that law
    // enforced in code: if the on-disk record is a fully-formed anchor, keep
    // it instead of demoting it to pending. Never synthesized data is written
    // here — the held bytes are the previously published anchor, verbatim.
    const held = readFullyFormedAnchor(sigsumRecordPath);
    if (held) {
      sigsumRecord = held;
      console.log(`⚠ Sigsum keys absent — HOLDING the last fully-formed anchor (leaf_index=${held.inclusion_proof.leaf_index}, cosigners=${held.witness_cosignatures.length}); not demoting it to pending.`);
    } else {
      const anchoredHashHex = bytesToHex(await sha256(checkpointBytes));
      sigsumRecord = {
        anchor_type: 'sigsum-pending-v1',
        status: 'pending',
        anchored_hash: `sha256:${anchoredHashHex}`,
        note: 'Sigsum submit/token keys absent (keys stay offline; LINEAGE-SIGSUM-TOLERANCE-2380-1): checkpoint signed by the log key and published with sigsum pending registration. Never re-stamp an already-anchored checkpoint — the pending record is replaced only by a real register-sigsum.mjs record on a run where the keys are present. An existing fully-formed anchor is HELD, never overwritten by this pending state.',
      };
      console.log(`⚠ Sigsum keys absent — publishing with sigsum: pending (checkpoint sha256:${anchoredHashHex}); registration deferred, not failed.`);
    }
  }

  // ── Only now: write everything to disk. ──────────────────────────────────
  for (const [path, bytes] of filesToWrite) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(bytes));
  }
  writeFileSync(checkpointPath, checkpointText);
  writeFileSync(sigsumRecordPath, JSON.stringify(sigsumRecord, null, 2));

  console.log(`\n✅ published registry/lineage: size=${size} root=${bytesToHex(newRoot)}`);
  if (sigsumRecord.status === 'pending') {
    console.log('   Sigsum: PENDING (keys absent — checkpoint published, registration deferred).');
  } else {
    console.log(`   Sigsum leaf_index=${sigsumRecord.inclusion_proof.leaf_index} tree_size=${sigsumRecord.tree_head.size}`);
  }
  console.log(`   ${filesToWrite.length + 2} file(s) written under ${registryDir}`);
}

// ---------------------------------------------------------------------------
// LINEAGE-PR-SIDE-RETIRE-1 (2026-10-22): the PR-side advisory split for the
// lineage gates. Main's regen (derived-artifacts-regen.yml) has been the LIVE
// writer of registry/lineage/** since 2026-10-14 (bot commits 543db5b2,
// 6070463a, 9746b4e9, 4be6747a, 00a596ba, d876fe52, each one record + one
// tile), so a node PR no longer carries its own append — the PR-side append
// made every node PR serial and conflicting on files only main should write
// (measured 2026-10-22: lineage-carrying PRs merge at a median 4.6h vs 1.2h
// for the rest). On a pull_request whose diff touches NOTHING under the three
// scopes below, a --check failure is ADVISORY (reported, never red) — the
// PROVE-BASELINE-SINGLE-WRITER-1 disposition pattern copied, not reinvented:
// warn + exit 0 in-script, keyed on isMainContext(). On main, on merge_group
// with the assembled DERIVED_ROOT, on any other/undeterminable context, and
// on any diff that DOES touch those files, --check stays BLOCKING exactly as
// before (fail closed, mirroring isMainContext()'s whitelist-of-PR-proofs
// shape). The unwired-gates.yml absence-tree leg of the split lives in the
// workflow (a scope step + the sanctioned run-gate.mjs wrapper); this
// in-script disposition is the preflight leg (scripts-verify.yml runs
// preflight on pull_request). Self-test: gen-registry-lineage.test.mjs.
// ---------------------------------------------------------------------------
export const LINEAGE_SCOPE_PREFIXES = [
  'registry/lineage/',
  'registry/absence/',
  'chaingraph/kernels/registry-lineage-records.json',
];

/** True when any touched path is a lineage-scope file (SO #34: recomputed
 *  from the diff itself, never from a field the artifact under test carries). */
export function diffTouchesLineageScope(files) {
  for (const f of files ?? []) {
    if (!f) continue;
    if (LINEAGE_SCOPE_PREFIXES.some((p) => f === p || f.startsWith(p))) return true;
  }
  return false;
}

/** The PR-side disposition, pure so the self-test drives it directly.
 *  advisory iff a PR context was affirmatively proven AND the diff is clean
 *  of every lineage scope; everything else blocks. */
export function lineageAdvisoryOnPr({ mainContext, touched }) {
  if (mainContext) {
    return { advisory: false, reason: 'main context (push:main, merge_group with DERIVED_ROOT, or undeterminable) — blocking exactly as before' };
  }
  if (diffTouchesLineageScope(touched)) {
    return { advisory: false, reason: 'this diff touches a lineage file (registry/lineage/**, registry/absence/** or chaingraph/kernels/registry-lineage-records.json) — blocking exactly as before' };
  }
  return {
    advisory: true,
    reason: "pull_request context and the diff touches no lineage file; node PRs no longer carry the append — main's regen (derived-artifacts-regen.yml, live since 2026-10-14) appends after merge",
  };
}

/** The touched-path union preflight.mjs already uses (working tree ∪ staged ∪
 *  committed-vs-merge-base(origin/main, HEAD)). null = undeterminable → the
 *  caller fails CLOSED (treats the diff as touching). */
function gitTouchedPathsForScope() {
  const out = new Set();
  const add = (s) => { for (const f of String(s).split('\n')) { const t = f.trim(); if (t) out.add(t); } };
  const run = (args) => execFileSync('git', args, { cwd: REPO, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  try {
    add(run(['diff', '--name-only', 'HEAD']));
    add(run(['diff', '--name-only', '--cached']));
  } catch {
    return null;
  }
  try {
    const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { cwd: REPO, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    add(run(['diff', '--name-only', base, 'HEAD']));
  } catch { /* no origin/main ref — working-tree/staged diff above is what we have (preflight.mjs's own fallback shape) */ }
  return [...out];
}

/** C3 (LINEAGE-PR-SIDE-RETIRE-1): anchor-lag WARNING — never red. A held
 *  anchor (or a pending record's anchored_hash) that no longer equals the
 *  sha256 of the CURRENT checkpoint went stale silently after every bot
 *  publish; this surfaces it as ONE warning line so a desk stamp is owed.
 *  null = anchored (silent) / nothing comparable. */
export async function anchorLagWarning(record, checkpointText) {
  const m = typeof record?.anchored_hash === 'string' ? record.anchored_hash.match(/^sha256:([0-9a-fA-F]{64})$/) : null;
  if (!m) return null;
  const current = bytesToHex(await sha256(Buffer.from(checkpointText, 'utf8')));
  if (m[1].toLowerCase() === current) return null;
  return `⚠ held anchor is stale; a desk stamp is owed (LINEAGE-PR-SIDE-RETIRE-1 C3): anchored_hash sha256:${m[1].toLowerCase()} != sha256(registry/lineage/checkpoint) sha256:${current}. The desk stamps once per checkpoint (register-sigsum.mjs); never re-stamp, never red.`;
}

/** --check with the LINEAGE-PR-SIDE-RETIRE-1 disposition: run check(); on
 *  failure, advisory-exit (0, one warning line naming why) ONLY on an
 *  affirmatively-proven PR context whose diff is clean of every lineage
 *  scope. The check's full output always prints either way. */
export async function checkAndDispose(opts = {}) {
  const r = await check({ ...opts, noExit: true });
  if (r.ok) return { exitCode: 0, advisory: false };
  const mainContext = opts.mainContext !== undefined
    ? opts.mainContext
    : (await import('./derived-artifacts.mjs')).isMainContext();
  const touched = opts.touched !== undefined ? opts.touched : gitTouchedPathsForScope();
  const d = touched === null
    ? { advisory: false, reason: 'touched-path set undeterminable — fail closed, blocking' }
    : lineageAdvisoryOnPr({ mainContext, touched });
  if (d.advisory) {
    console.log(`⚠ ADVISORY — gen-registry-lineage --check (LINEAGE-PR-SIDE-RETIRE-1): ${d.reason}. Underlying --check failure (reported, never red): ${r.message}`);
    return { exitCode: 0, advisory: true, reason: d.reason };
  }
  return { exitCode: 1, advisory: false, reason: d.reason };
}

// ---------------------------------------------------------------------------
// --check: read-only recompute-and-verify. No writes, no Sigsum call.
// Wired into scripts/preflight.mjs. Absence of a checkpoint is a distinct
// FAILING state (SO #34c) — never treated as a vacuous pass.
// Returns { ok, message } instead of calling process.exit when opts.noExit is
// set — used by the test harness to check a temp registry dir in-process.
// ---------------------------------------------------------------------------
export async function check(opts = {}) {
  const registryDir = opts.registryDir || REGISTRY_DIR;
  const checkpointPath = opts.checkpointPath || join(registryDir, 'checkpoint');
  const logPublicKeyHex = opts.logPublicKeyHex || LOG_PUBLIC_KEY_HEX;
  const fail = (msg) => {
    console.error(`✗ gen-registry-lineage --check: ${msg}`);
    if (opts.noExit) return { ok: false, message: msg };
    process.exit(1);
  };

  if (!existsSync(checkpointPath)) return fail(`no checkpoint published at ${checkpointPath}. Absence is a FAILING state (SO #34c), not a pass.`);
  const checkpointText = readFileSync(checkpointPath, 'utf8');
  const parsed = parseSignedNote(checkpointText);
  if (parsed.origin !== ORIGIN) return fail(`checkpoint origin "${parsed.origin}" != expected "${ORIGIN}".`);
  const logPublicKeyBytes = hexToBytes(logPublicKeyHex);
  const cosig = parsed.cosignatures.find((c) => c.name === LOG_NAME);
  if (!cosig) return fail(`no cosignature line for "${LOG_NAME}" found in the published checkpoint.`);
  const sigOk = await verifyCheckpointSignature(parsed.noteText, cosig, logPublicKeyBytes, LOG_NAME);
  if (!sigOk) return fail(`the published checkpoint's Ed25519 signature does NOT verify against the pinned log public key ${logPublicKeyHex}.`);

  let leafHashes, entryBytes;
  try {
    leafHashes = readLevel0LeafHashes(registryDir, parsed.size);
    entryBytes = readEntryBundles(registryDir, parsed.size);
  } catch (e) {
    return fail(`failed to read published tile/entry bytes for size ${parsed.size}: ${e.message}`);
  }

  // Cross-check: every entry bundle byte range must hash (via hashLeafNode) to
  // the corresponding level-0 tile hash at that position (§3.3's own invariant).
  for (let i = 0; i < entryBytes.length; i++) {
    const h = await hashLeafNode(entryBytes[i]);
    if (!bytesEqual(h, leafHashes[i])) {
      return fail(`entry bundle leaf ${i} does NOT hash to the corresponding level-0 tile hash. Entry/tile bytes are inconsistent.`);
    }
  }

  const recomputedRoot = parsed.size > 0 ? await mth(leafHashes, 0, parsed.size) : null;
  if (parsed.size === 0 || !recomputedRoot || !bytesEqual(recomputedRoot, parsed.rootHash)) {
    return fail(
      `root recomputed from published tile bytes ` +
      `(${recomputedRoot ? bytesToHex(recomputedRoot) : 'n/a (size 0)'}) does NOT match the published ` +
      `checkpoint's root (${bytesToHex(parsed.rootHash)}) at size ${parsed.size}. A tile or entry-bundle byte ` +
      `was mutated, dropped, or reordered since this checkpoint was published (SO #34).`
    );
  }

  // Sigsum record: `pending` is an ACCEPTED state (LINEAGE-SIGSUM-TOLERANCE-
  // 2380-1 — the Sigsum keys stay offline, so a published checkpoint may
  // legitimately await registration). Only a record that is present AND
  // neither pending nor a real anchor shape reds; absence of the record file
  // is also tolerated (older published logs predate it).
  let sigsumSuffix = '';
  if (existsSync(join(registryDir, 'checkpoint.sigsum-record.json'))) {
    let sigsumRecord = null;
    try {
      sigsumRecord = JSON.parse(readFileSync(join(registryDir, 'checkpoint.sigsum-record.json'), 'utf8'));
    } catch {
      return fail('checkpoint.sigsum-record.json exists but does not parse as JSON.');
    }
    if (sigsumRecord.status === 'pending') {
      sigsumSuffix = '; sigsum: pending (keys offline) — accepted';
      console.log('✓ sigsum: pending — registration deferred (Sigsum keys offline), checkpoint + tiles still fully verified.');
    } else if (sigsumRecord.anchor_type !== 'c2sp-tlog-proof-v1') {
      return fail(`checkpoint.sigsum-record.json has unexpected anchor_type "${sigsumRecord.anchor_type}" (neither c2sp-tlog-proof-v1 nor sigsum-pending-v1).`);
    }
    // C3 (LINEAGE-PR-SIDE-RETIRE-1): anchor-lag WARNING, never red — fires for
    // BOTH record shapes (a held fully-formed anchor, or a pending record's
    // anchored_hash) whenever it no longer equals the CURRENT checkpoint's
    // sha256, i.e. main's regen has published past the anchor a desk owes.
    const lag = await anchorLagWarning(sigsumRecord, checkpointText);
    if (lag) console.log(lag);
  }

  const okMsg = `checkpoint signature valid, ${entryBytes.length} entries cross-checked, root recomputed from published tile bytes matches the checkpoint (size=${parsed.size}, root=${bytesToHex(recomputedRoot)})${sigsumSuffix}.`;
  console.log(`✓ gen-registry-lineage --check PASSED: ${okMsg}`);
  return { ok: true, message: okMsg };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

async function main() {
  if (process.argv.includes('--check')) {
    // LINEAGE-PR-SIDE-RETIRE-1: the PR-side advisory disposition (block above)
    // wraps the failing exit; a passing check and every blocking context are
    // byte-identical to the pre-row behaviour (exit 0 / exit 1).
    const r = await checkAndDispose();
    process.exit(r.exitCode);
  }
  return generate();
}

if (isMain) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
