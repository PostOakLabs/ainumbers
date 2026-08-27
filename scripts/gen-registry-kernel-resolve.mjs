#!/usr/bin/env node
// scripts/gen-registry-kernel-resolve.mjs — REGISTRY-RESOLVE-STATIC-1.
//
// Positive-half-only kernel_digest -> spec_digest resolution, per
// research/REGISTRY-TILES-DESIGN-1.md §3.2 + §4 + §5.1 (the design — not
// redesigned here). Writes one plain, content-addressed record per in-scope
// kernel to registry/kernel/<hex kernel_digest>.json.
//
// WHY THIS IS SAFE WITHOUT ANY PROOF MACHINERY (§3.2): the file is keyed by
// the hash of the thing it describes. A consumer who already holds
// kernel_digest can hash the kernel bytes themselves and compare — a wrong
// answer is detectable with no signature, root, checkpoint or proof. A 404 is
// NOT evidence of anything (a deploy gap, a CDN miss, a typo are
// indistinguishable from "never registered") — this generator/gate makes no
// absence claim anywhere, and nothing it writes may be read as one.
//
// INDEPENDENT DERIVATION (SO #34): kernel_digest and spec_digest are BOTH
// recomputed here from the kernel source bytes and chaingraph/standard/SPEC.md
// bytes respectively, on every run. Neither is ever read from a field an
// earlier process wrote (e.g. an existing compute_images sha256-source entry
// is never consulted).
//
// CANONICALIZATION: record bytes are produced through the shared cgCanon()
// path in chaingraph/kernels/_hash.mjs — the one correct canonicalization in
// this estate. This is NOT an execution_hash preimage (there is no
// policy_parameters/output_payload pair here); cgCanon is reused only for its
// key-sort + minimal-whitespace JSON shape, so every generator in the estate
// keeps producing byte-identical records for byte-identical inputs.
//
// SCOPE (mirrors chaingraph/kernels/gen-kernel-identity.mjs's population):
// status "live", gpu:false, kernel registered in chaingraph/kernels/index.mjs,
// and a .kernel.mjs file present on disk.
//
// ── PRUNE AUTHORITY (GENERATOR-PRUNES-ORPHANS-1) ────────────────────────────
// Tim's ruling, 2026-08-23, verbatim: "the generator prunes what it owns — a
// single-writer's scope includes deleting artifacts for nodes that leave
// service, consistent with the okf deletion fix and its deletion-cap guard."
//
// WHY IT HAD TO CHANGE: --write used to create and refresh and never delete,
// so every node that left service and every kernel whose bytes moved stranded
// a record here forever. On 2026-08-23 exactly one such orphan (art-99's
// record, after #1477 retired the node) failed --check on every session's
// pre-push while CI stayed green, because the gate was preflight-only then.
// The same class blocked main the previous day through generate-okf.mjs.
//
// WHAT THIS GENERATOR OWNS: exactly one filename shape, directly inside
// registry/kernel/ — <64 lowercase hex>.json, one per unique in-scope
// kernel_digest. That is the only thing it has ever written, so it is the only
// thing it may delete. Prune authority stops at that shape and at the
// directory boundary: no recursion, no subdirectories, no other extension, no
// other name. A .json file in there under any other name is reported as
// UNRECOGNIZED and is never deleted — a human decides. A non-.json entry is
// neither reported nor touched, exactly as before this change.
//
// ONE DEFINITION OF ORPHAN: --check and --write both classify the output
// directory through the same classifyOutputDir() call, so the set --check
// reports is byte-for-byte the set --write deletes. Two definitions is how a
// remedy line starts naming a command that cannot fix the failure it is
// printed under — which is the defect #1480 had to work around by hand.
//
// Usage:
//   node scripts/gen-registry-kernel-resolve.mjs --write
//   node scripts/gen-registry-kernel-resolve.mjs --write --confirm-prune=<n>
//   node scripts/gen-registry-kernel-resolve.mjs --check
//
// Exit codes: 0 ok · 1 --check found problems · 2 usage · 3 input structurally
// unusable · 4 --write REFUSED the prune (deletion cap).

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from '../chaingraph/kernels/_buildid.mjs';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const CGPATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const SPEC_PATH = resolve(REPO, 'chaingraph', 'standard', 'SPEC.md');
const OUT_DIR = resolve(REPO, 'registry', 'kernel');

// design note §5.1, carried verbatim (not a paraphrase) into every record's note field.
export const NEVER_LIVE_DEPENDENCY_NOTE =
  'This file and its Sigsum anchor inform *trust* in a spec version, not the *validity* of any composed FV+zk artifact. A receipt issued against a spec digest verifies cryptographically offline, in full, whether or not this feed is ever fetched, whether or not it is reachable, and regardless of its content. Checking this feed is optional due diligence by the reader, never a verification step.';

/**
 * The ONE filename shape this generator writes, and therefore the only one it
 * may delete. `${hex}.json` where hex is a 64-char lowercase sha256 hex — see
 * buildRecords() below, which is the sole producer of these names.
 */
export const OWNED_RECORD_NAME = /^[0-9a-f]{64}\.json$/;

/**
 * DELETION CAP — above this many orphans in one run, --write REFUSES: it
 * deletes nothing, writes nothing, and exits 4.
 *
 * WHY 10, chosen from measured events rather than taste:
 *
 *  • THE REAL EVENTS PASS. The two deletions this whole rule exists for were
 *    1 file (art-99's kernel-resolve record, PR #1480, 2026-08-23) and 2 files
 *    (art-99's OKF pages, PR #1479, 2026-08-22). 10 clears both with 5x
 *    headroom — neither would ever have needed a human, which is the point.
 *
 *  • WHAT ONE EVENT COSTS HERE. This generator strands exactly ONE record per
 *    kernel that leaves the in-scope set or whose source bytes move. Since it
 *    went live (#1385, 2026-08-18) the largest number of *.kernel.mjs files
 *    modified by any single commit on main is 1, and nodes have left service
 *    one at a time. Ten is an order of magnitude above the observed ceiling.
 *
 *  • WHAT IT MUST CATCH. The failure mode is the whole-set drop: 616 records
 *    live here today. A walk that returns nothing, an inverted scope filter, a
 *    chaingraph.json read that yields no nodes — each deletes hundreds. Caught
 *    by nearly two orders of magnitude.
 *
 *  • NOT LOWER. A cap of 2 or 3 fires on an ordinary multi-node retirement,
 *    and a guard that fires on routine work is a guard sessions learn to
 *    bypass. A row touching more than 10 sealed kernels in one push is already
 *    barred by SO #36's same-row re-prove requirement, so >10 orphans means
 *    something upstream went wrong, not that a legitimate wave landed.
 *
 *  • ONE NUMBER, ONE MECHANISM. board/queued/REGEN-MASS-DELETE-REFUSE-1 guards
 *    the same hazard at the regen workflow's staging step. It takes this same
 *    cap of 10 and this same REFUSED shape (distinct non-success signal, count
 *    and paths named, actionable remedy). Do not fork either half.
 *
 * ESCAPE HATCH: --confirm-prune=<n> where n EXACTLY equals the orphan count.
 * It cannot be set once and forgotten, because the count moves; supplying it
 * proves the operator read the list the refusal printed.
 */
export const DELETION_CAP = 10;

/**
 * Split the output directory into the three classes this generator recognises,
 * from a plain list of directory entry names. Pure — no filesystem, no order
 * dependence — so the self-test can drive every branch without a real tree.
 *
 *   owned        — <64hex>.json files this generator writes; the wanted ones
 *   orphans      — owned-shape files no in-scope kernel produces any more
 *   unrecognized — other *.json entries; NOT ours, never deleted, reported
 *
 * Anything that is not *.json is invisible here, exactly as it was before
 * prune existed: this generator has never had an opinion about it.
 */
export function classifyOutputDir(names, wantedNames) {
  const wanted = wantedNames instanceof Set ? wantedNames : new Set(wantedNames);
  const owned = [], orphans = [], unrecognized = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    if (!OWNED_RECORD_NAME.test(name)) { unrecognized.push(name); continue; }
    owned.push(name);
    if (!wanted.has(name)) orphans.push(name);
  }
  owned.sort(); orphans.sort(); unrecognized.sort();
  return { owned, orphans, unrecognized };
}

/**
 * Decide what --write may do with the orphan set. Pure, so the cap is provable
 * without deleting anything.
 *   { action: 'NONE' }                      nothing to prune
 *   { action: 'PRUNE' }                     at or below the cap, or confirmed
 *   { action: 'REFUSE', reason }            above the cap, unconfirmed or
 *                                           confirmed with the wrong count
 */
export function prunePlan(orphanCount, { cap = DELETION_CAP, confirm = null } = {}) {
  if (orphanCount === 0) return { action: 'NONE' };
  if (orphanCount <= cap) return { action: 'PRUNE' };
  if (confirm === null) {
    return { action: 'REFUSE', reason: `${orphanCount} orphan(s) is above the deletion cap of ${cap} and no --confirm-prune was given` };
  }
  if (confirm !== orphanCount) {
    return { action: 'REFUSE', reason: `--confirm-prune=${confirm} does not match the ${orphanCount} orphan(s) actually found` };
  }
  return { action: 'PRUNE' };
}

/** Parse --confirm-prune=<n>. Returns null when absent; NaN-safe. */
export function parseConfirmPrune(argv) {
  const arg = argv.find((a) => a.startsWith('--confirm-prune='));
  if (!arg) return null;
  const n = Number(arg.slice('--confirm-prune='.length));
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

export function canonicalRecordBytes(record) {
  return JSON.stringify(cgCanon(record));
}

/**
 * Delete exactly the named orphans from `dir`. Refuses as a whole above the
 * cap — nothing is deleted on a refusal, so there is no half-applied state.
 * Every deleted file is named on stdout. Exported so the self-test can prove
 * PRUNE / CAP RED / NOT-MINE / IDEMPOTENT against a scratch directory instead
 * of against the live registry.
 */
export function pruneOrphans(dir, orphans, { cap = DELETION_CAP, confirm = null, log = console.log } = {}) {
  const plan = prunePlan(orphans.length, { cap, confirm });
  if (plan.action !== 'PRUNE') return { removed: 0, plan };
  for (const fname of orphans) {
    if (!OWNED_RECORD_NAME.test(fname)) {
      // Belt and braces: pruneOrphans is exported, so the ownership predicate
      // is re-asserted here rather than trusted from the caller's list.
      throw new Error(`refusing to delete ${fname} — not a record this generator owns`);
    }
    rmSync(resolve(dir, fname), { force: true });
    log(`  − removed orphan registry/kernel/${fname}`);
  }
  return { removed: orphans.length, plan };
}

async function main() {
  const mode = process.argv.includes('--write') ? 'write'
    : process.argv.includes('--check') ? 'check' : null;
  if (!mode) { console.error('usage: gen-registry-kernel-resolve.mjs --write [--confirm-prune=<n>] | --check'); process.exit(2); }

  const confirmPrune = parseConfirmPrune(process.argv);
  if (Number.isNaN(confirmPrune)) { console.error('✗ --confirm-prune=<n> needs a non-negative integer'); process.exit(2); }

  const idxSrc = readFileSync(resolve(KDIR, 'index.mjs'), 'utf8');
  const kBlock = idxSrc.slice(idxSrc.indexOf('KERNELS = {'));
  const registeredIds = new Set([...kBlock.matchAll(/['"]([a-z0-9][a-z0-9._-]+)['"]\s*:/gi)].map((m) => m[1]));

  const cg = JSON.parse(readFileSync(CGPATH, 'utf8'));
  if (!cg.spec_version) { console.error('✗ chaingraph.json has no spec_version'); process.exit(3); }
  const specVersion = cg.spec_version;

  const inScope = (cg.nodes ?? []).filter(
    (n) => n.status === 'live' && n.gpu === false && registeredIds.has(n.tool_id)
      && existsSync(resolve(KDIR, n.tool_id + '.kernel.mjs')),
  );
  if (inScope.length === 0) { console.error('✗ 0 in-scope kernels found — refusing to treat that as a valid empty regen (SO #34c: absence is not a pass)'); process.exit(3); }

  async function buildRecords() {
    const specDigest = await sourceDigest(readFileSync(SPEC_PATH, 'utf8'));
    const byFile = new Map(); // filename -> { record, tool_ids: [] }
    for (const n of inScope) {
      const src = readFileSync(resolve(KDIR, n.tool_id + '.kernel.mjs'), 'utf8');
      const kernelDigest = await sourceDigest(src); // sha256:<hex>, independently recomputed
      const hex = kernelDigest.slice('sha256:'.length);
      const record = {
        kernel_digest: kernelDigest,
        spec_version: specVersion,
        spec_digest: specDigest,
        note: NEVER_LIVE_DEPENDENCY_NOTE,
      };
      const fname = `${hex}.json`;
      const existing = byFile.get(fname);
      if (existing) {
        // Two registered kernels sharing byte-identical source hash to the same
        // spec/spec_digest produce the same record by construction — fine, same file.
        if (canonicalRecordBytes(existing.record) !== canonicalRecordBytes(record)) {
          throw new Error(`kernel_digest collision with differing record content: ${n.tool_id} vs ${existing.tool_ids.join(',')} both map to ${fname}`);
        }
        existing.tool_ids.push(n.tool_id);
      } else {
        byFile.set(fname, { record, tool_ids: [n.tool_id] });
      }
    }
    return byFile;
  }

  const byFile = await buildRecords();
  const wanted = new Set(byFile.keys());

  if (mode === 'check') {
    const problems = [];
    if (!existsSync(OUT_DIR)) {
      console.error(`✗ REGISTRY-RESOLVE-STATIC-1 FAILED — ${OUT_DIR} does not exist. Run: node scripts/gen-registry-kernel-resolve.mjs --write`);
      process.exit(1);
    }
    const { owned, orphans, unrecognized } = classifyOutputDir(readdirSync(OUT_DIR), wanted);
    const onDisk = new Set(owned);
    let regenerable = 0;
    for (const fname of wanted) {
      if (!onDisk.has(fname)) { problems.push(`missing ${fname}`); regenerable++; continue; }
      const actual = readFileSync(resolve(OUT_DIR, fname), 'utf8');
      const want = canonicalRecordBytes(byFile.get(fname).record);
      if (actual !== want) { problems.push(`stale ${fname} (on-disk content does not match recomputed record)`); regenerable++; }
    }
    for (const fname of orphans) {
      problems.push(`orphan ${fname} (no longer produced by any in-scope kernel — SO #34c: a leftover file is not evidence of anything, it is a bug)`);
    }
    for (const fname of unrecognized) {
      problems.push(`unrecognized ${fname} (not a <64hex>.json record — this generator did not write it and will never delete it)`);
    }
    if (problems.length) {
      console.error(`✗ REGISTRY-RESOLVE-STATIC-1 kernel-resolve coverage FAILED — ${problems.length} problem(s):`);
      for (const p of problems.slice(0, 25)) console.error('  • ' + p);
      if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
      // REMEDY BY PROBLEM CLASS. A remedy that does not resolve the failure it
      // is printed under is worse than no remedy: it reads as a flaky gate and
      // pushes sessions toward --no-verify. Since GENERATOR-PRUNES-ORPHANS-1,
      // `--write` both regenerates AND prunes, so it is the truthful answer for
      // the first two classes — but only the first two.
      console.error('');
      if (regenerable > 0) {
        console.error(`Missing/stale (${regenerable}) — regenerate: node scripts/gen-registry-kernel-resolve.mjs --write`);
      }
      if (orphans.length > 0) {
        console.error(`Orphans (${orphans.length}) — records this generator owns and no longer produces. \`--write\` deletes exactly these:`);
        for (const f of orphans.slice(0, 25)) console.error(`  registry/kernel/${f}`);
        if (orphans.length > 25) console.error(`  … and ${orphans.length - 25} more`);
        if (orphans.length > DELETION_CAP) {
          console.error(`  ⛔ ${orphans.length} is above the deletion cap of ${DELETION_CAP} — plain \`--write\` will REFUSE and delete nothing.`);
          console.error(`     Read the list above; if every one of them is meant to go, confirm the exact count:`);
          console.error(`       node scripts/gen-registry-kernel-resolve.mjs --write --confirm-prune=${orphans.length}`);
        } else {
          console.error(`  Run: node scripts/gen-registry-kernel-resolve.mjs --write`);
        }
        console.error('An orphan means a kernel left the in-scope set, e.g. a node going non-live.');
      }
      if (unrecognized.length > 0) {
        console.error(`Unrecognized (${unrecognized.length}) — NOT written by this generator, so it never deletes them. A human decides:`);
        for (const f of unrecognized.slice(0, 25)) console.error(`  registry/kernel/${f}`);
        if (unrecognized.length > 25) console.error(`  … and ${unrecognized.length - 25} more`);
      }
      process.exit(1);
    }
    console.log(`✓ REGISTRY-RESOLVE-STATIC-1 clean — ${wanted.size} record(s) for ${inScope.length} in-scope kernel(s), all current.`);
    process.exit(0);
  }

  // --- WRITE -------------------------------------------------------------
  mkdirSync(OUT_DIR, { recursive: true });

  // PRUNE FIRST, AND AS A WHOLE. The cap is evaluated before a single byte is
  // written, so a REFUSED run leaves the tree exactly as it found it — no
  // half-applied state to reason about afterwards.
  const { orphans, unrecognized } = classifyOutputDir(readdirSync(OUT_DIR), wanted);
  const plan = prunePlan(orphans.length, { confirm: confirmPrune });
  if (plan.action === 'REFUSE') {
    console.error(`✗ REGISTRY-RESOLVE-STATIC-1 --write REFUSED — ${plan.reason}.`);
    console.error('  NOTHING was deleted and NOTHING was written. The tree is unchanged.');
    for (const f of orphans.slice(0, 25)) console.error(`  would delete registry/kernel/${f}`);
    if (orphans.length > 25) console.error(`  … and ${orphans.length - 25} more`);
    console.error('');
    console.error(`A cap breach means one of two things. Either the in-scope walk broke — inspect this`);
    console.error(`generator and chaingraph.json before deleting anything — or ${orphans.length} kernels genuinely left`);
    console.error(`service in one push. If you have read the list above and every one of them is meant to`);
    console.error(`go, re-run confirming the exact count:`);
    console.error(`  node scripts/gen-registry-kernel-resolve.mjs --write --confirm-prune=${orphans.length}`);
    process.exit(4);
  }

  const { removed } = pruneOrphans(OUT_DIR, orphans, { confirm: confirmPrune });

  let written = 0, unchanged = 0;
  for (const [fname, { record }] of byFile) {
    const path = resolve(OUT_DIR, fname);
    const want = canonicalRecordBytes(record);
    if (existsSync(path) && readFileSync(path, 'utf8') === want) { unchanged++; continue; }
    writeFileSync(path, want);
    written++;
  }
  console.log(`✓ REGISTRY-RESOLVE-STATIC-1 wrote ${written} record(s), removed ${removed} orphan(s), ${unchanged} already current, for ${inScope.length} in-scope kernel(s) (${byFile.size} unique file(s)). Run --check to verify.`);
  if (unrecognized.length) {
    console.log(`  note: ${unrecognized.length} file(s) in registry/kernel/ are not records this generator owns and were left untouched: ${unrecognized.slice(0, 5).join(', ')}${unrecognized.length > 5 ? ', …' : ''}`);
  }
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) await main();
