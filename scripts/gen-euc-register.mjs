#!/usr/bin/env node
// EUC-register export generator (EUC-SITE-1, board row anchor + BANKING-OCG-BUILD-SPEC.md §5.7).
// Site-side twin of Helm's HELM-P3-E12 (helm/hub/euc-register.mjs) -- same field intent
// (name, purpose, kernel version+hash, declared inputs/outputs, control description,
// last-validated date), reshaped for one-node-per-tool_id instead of Helm's multi-node
// packs. Reads ONLY existing chaingraph.json node metadata -- no new persisted fields,
// no caller-supplied inputs, batch-generated so every run reflects current live state.
//
// Trust label / data-vintage / last-validated are derived from compute_proof_ready +
// compute_images each run (never hardcoded) so a deferred->ready proof-status flip
// (e.g. art-454..467/472/473 when PROVE-ASSURANCE-LAND-1 lands) is picked up by
// re-running this script, not by hand-editing an entry.
//
// ── PRUNE AUTHORITY (GENERATOR-STATUS-FILTER-1, 2026-08-23) ─────────────────
// Tim's ruling of 2026-08-23, already applied to gen-registry-kernel-resolve.mjs
// by GENERATOR-PRUNES-ORPHANS-1, verbatim: "the generator prunes what it owns —
// a single-writer's scope includes deleting artifacts for nodes that leave
// service, consistent with the okf deletion fix and its deletion-cap guard."
//
// WHY IT HAD TO CHANGE HERE TOO. This generator EMITS live-only (main() filters
// status === "live") but never DELETED, so a node that left service stranded its
// entry file forever. Its own --check then reported that file as "stale entries
// (node no longer live)" — a gate calling stale exactly what its writer refuses
// to remove. Measured cost: PR #1477's single deprecation flip left art-99's
// entry behind, main went RED for 15 hours, and it took a hand-written PR
// (#1486) to delete one file. Worse, the drift was UNREPAIRABLE BY MAIN'S
// WRITER, which is the premise the advisory-on-PR downgrade rests on — see
// scripts/check-regen-repairable.mjs, a whole gate that exists because of this
// one missing delete.
//
// WHAT THIS GENERATOR OWNS: exactly two filename shapes directly inside
// chaingraph/register/ — <tool_id>.register.json (one per live node) and
// index.json. Prune authority stops at that shape and at the directory
// boundary: no recursion, no subdirectories, no other extension. Any other
// *.json name is reported UNRECOGNIZED and never deleted; a human decides.
//
// ⛔ SCOPE — CURRENT-STATE PROJECTIONS ONLY (PR #1494). chaingraph/register/ is
//    a projection of the CURRENT live set, which is why it may be pruned.
//    `registry/lineage` and `registry/errata` are APPEND-ONLY history and MUST
//    NEVER be filtered or pruned by this or any generator. This script does not
//    read, write or even resolve those paths.
//
// ONE DEFINITION OF STALE: --check and --write both classify the output
// directory through the same classifyRegisterDir() call, so the set --check
// reports is byte-for-byte the set --write deletes.
//
// Usage:
//   node scripts/gen-euc-register.mjs                      # write + prune
//   node scripts/gen-euc-register.mjs --confirm-prune=<n>  # above the cap
//   node scripts/gen-euc-register.mjs --check
//
// Exit codes: 0 ok · 1 --check found problems · 4 write REFUSED the prune (cap).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isNonLive } from "./_node-status.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CHAINGRAPH = JSON.parse(readFileSync(join(ROOT, "chaingraph", "chaingraph.json"), "utf8"));
const OUT_DIR = join(ROOT, "chaingraph", "register");
const CHECK = process.argv.includes("--check");

/**
 * The per-node filename shape this generator writes, and therefore the only one
 * it may delete. index.json is handled separately and is never pruned.
 */
export const OWNED_ENTRY_NAME = /^[a-z0-9][a-z0-9._-]*\.register\.json$/;

/**
 * DELETION CAP — above this many stale entries in one run, the write path
 * REFUSES: it deletes nothing and exits 4. Same number and same REFUSED shape as
 * scripts/gen-registry-kernel-resolve.mjs's DELETION_CAP (GENERATOR-PRUNES-
 * ORPHANS-1) on purpose — ONE NUMBER, ONE MECHANISM. ⛔ Do not fork either half.
 * The real event this exists for was 1 file (art-99, #1486). The failure mode it
 * must catch is the whole-set drop: 632 entries live here today, and an inverted
 * status filter or an empty chaingraph.json read would delete every one.
 *
 * ESCAPE HATCH: --confirm-prune=<n> where n EXACTLY equals the stale count, so
 * it cannot be set once and forgotten — the count moves.
 */
export const DELETION_CAP = 10;

/**
 * Split the register directory into the three classes this generator
 * recognises, from a plain list of entry names. Pure — no filesystem, no order
 * dependence — so the self-test drives every branch without a real tree.
 *
 *   owned        — <tool_id>.register.json files this generator writes
 *   stale        — owned-shape files no LIVE node produces any more
 *   unrecognized — other *.json entries (index.json excluded); never deleted
 */
export function classifyRegisterDir(names, wantedNames) {
  const wanted = wantedNames instanceof Set ? wantedNames : new Set(wantedNames);
  const owned = [], stale = [], unrecognized = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json") continue;
    if (!OWNED_ENTRY_NAME.test(name)) { unrecognized.push(name); continue; }
    owned.push(name);
    if (!wanted.has(name)) stale.push(name);
  }
  owned.sort(); stale.sort(); unrecognized.sort();
  return { owned, stale, unrecognized };
}

/**
 * Decide what the write path may do with the stale set. Pure, so the cap is
 * provable without deleting anything.
 *   { action: 'NONE' }            nothing to prune
 *   { action: 'PRUNE' }           at or below the cap, or exactly confirmed
 *   { action: 'REFUSE', reason }  above the cap, unconfirmed or miscounted
 */
export function prunePlan(staleCount, { cap = DELETION_CAP, confirm = null } = {}) {
  if (staleCount === 0) return { action: "NONE" };
  if (staleCount <= cap) return { action: "PRUNE" };
  if (confirm === null) {
    return { action: "REFUSE", reason: `${staleCount} stale entr(ies) is above the deletion cap of ${cap} and no --confirm-prune was given` };
  }
  if (confirm !== staleCount) {
    return { action: "REFUSE", reason: `--confirm-prune=${confirm} does not match the ${staleCount} stale entr(ies) actually found` };
  }
  return { action: "PRUNE" };
}

/** Parse --confirm-prune=<n>. Returns null when absent; NaN-safe. */
export function parseConfirmPrune(argv) {
  const arg = argv.find((a) => a.startsWith("--confirm-prune="));
  if (!arg) return null;
  const n = Number(arg.slice("--confirm-prune=".length));
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

/**
 * Delete exactly the named stale entries from `dir`. Refuses as a whole above
 * the cap — nothing is deleted on a refusal, so there is no half-applied state.
 * Every deleted file is named on stdout. Exported so the self-test can prove
 * PRUNE / CAP RED / NOT-MINE / IDEMPOTENT against a scratch directory instead of
 * against the live register.
 */
export function pruneStale(dir, stale, { cap = DELETION_CAP, confirm = null, log = console.log } = {}) {
  const plan = prunePlan(stale.length, { cap, confirm });
  if (plan.action !== "PRUNE") return { removed: 0, plan };
  for (const fname of stale) {
    if (!OWNED_ENTRY_NAME.test(fname) || fname === "index.json") {
      // pruneStale is exported, so the ownership predicate is re-asserted here
      // rather than trusted from the caller's list.
      throw new Error(`refusing to delete ${fname} — not an entry this generator owns`);
    }
    rmSync(join(dir, fname), { force: true });
    log(`  − removed stale chaingraph/register/${fname}`);
  }
  return { removed: stale.length, plan };
}

function latestVintage(node) {
  const dates = (node.compute_images ?? []).map((img) => img.valid_from).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

function kernelDigest(node) {
  const journalDigest = node.compute_proof?.journal?.kernel_digest;
  if (journalDigest) return journalDigest;
  const source = (node.compute_images ?? []).find((img) => img.system === "sha256-source");
  return source?.image_id ?? null;
}

// One resolution of proof status, read by BOTH the trust label and the exported
// compute_proof_ready field. A node carrying a real compute_proof but no explicit
// compute_proof_ready flag is ready: the attached receipt is the fact and the flag only
// restates it (SPEC.md §18.6 -- a live gpu:false node either carries a verifying
// compute_proof or declares "deferred" with a reason). A live gpu:true node with no
// compute_proof is a THIRD state -- verify-only, out of the §18.6 profile's scope
// entirely (SIGKERNEL-VERIFYONLY-RECLASS-1) -- never "deferred": that word is reserved
// for a gpu:false node parked in the proving queue, and a gpu:true node was never in it.
// Resolving these two through different rules is what put "PROOF READY" beside
// "zkVM proof not yet generated" on the same register card.
function proofState(node) {
  if (node.compute_proof) return "ready";
  if (node.compute_proof_ready === "deferred") return "deferred";
  if (node.gpu === true) return "verify_only";
  return "deferred";
}

function trustLabel(node) {
  const state = proofState(node);
  if (state === "ready") {
    const sys = node.compute_proof?.system ?? "risc0";
    const fmt = node.compute_proof?.receiptFormat ?? "groth16-bn254";
    return `independently verified: zkVM execution proof (${sys}/${fmt})`;
  }
  if (state === "verify_only") {
    return "verify-only: callable in chains, carries no compute-proof claim (out of the §18.6 deterministic-node profile's scope)";
  }
  const reason = node.deferred_reason ? `; ${node.deferred_reason}` : "";
  return `deferred: deterministic source published, zkVM proof not yet generated${reason}`;
}

// Site nodes are one kernel per tool_id (no multi-node workflow packs like Helm),
// so "declared outputs" = the node's own downstream feeds, and there is no separate
// terminal-node computation to do (parity note: Helm's terminalNode() has no analog here).
function buildRegisterEntry(node, generatedAt) {
  return {
    tool_id: node.tool_id,
    kernel_id: node.tool_id,
    display_name: node.display_name,
    tool_version: node.tool_version ?? null,
    mandate_type: node.mandate_type ?? null,
    purpose: node.description ?? null,
    control_description: node.description ?? null,
    declared_inputs: node.consumes ?? [],
    declared_outputs: node.feeds ?? [],
    kernel_digest: kernelDigest(node),
    trust_label: trustLabel(node),
    data_vintage: latestVintage(node),
    last_validated: latestVintage(node),
    conformance_fixtures_vendored: node.conformance_fixtures === true,
    compute_proof_ready: proofState(node),
    wave: node.wave ?? null,
    source_url: node.url ?? null,
    generated_at: generatedAt,
  };
}

// The substantive content of an entry = everything except generated_at, a wall-clock
// stamp that by construction differs on every run. Hoisted to module scope
// (GENERATOR-NOOP-STABILITY-1) because BOTH --check and the write path now compare on
// it: the gate must pass exactly when the writer would leave the file alone, and two
// separate copies of that predicate is how they drift apart.
function withoutStamp(entry) {
  const { generated_at, ...rest } = entry;
  return JSON.stringify(rest);
}

// GENERATOR-NOOP-STABILITY-1: write ONLY on a genuine content change.
// Before: every run stamped a fresh generated_at into all 609 entry files + index.json,
// so a regen rewrote 610 files whose substantive content had not moved. Because every
// row that adds a node runs the SO #28 regen chain, those 610 files collided between
// any two concurrent PRs even when their real changes were disjoint — measured by
// board/done/NODE-REG-UNBLOCK-1.md, which had to revert 606 of them by hand.
// Now: if the on-disk entry matches the freshly-derived one modulo generated_at, the
// file is left ALONE — not rewritten with identical bytes, not touched at all, so its
// mtime and its original stamp both survive. generated_at therefore comes to mean "when
// this entry's content last changed", which is a fact, rather than "when someone last
// ran a generator", which was not one.
// Consumers of generated_at: NONE. scripts/gen-euc-register-page.mjs reads index.count
// and the per-entry substantive fields; euc-register.html renders no generation stamp;
// the --check gate above excludes it deliberately; the worker (mcp-apps-poc) never reads
// chaingraph/register/ at all. Nothing regresses by holding it steady.
// index.json is the same shape of artifact as an entry file (a projection + a stamp), so
// it is built once here and reused by BOTH --check and the write path — the alternative,
// building the expected index inside the gate and the written index in main(), is the
// self-consistent-checker shape SO #34 warns about one level down.
function buildIndex(entries, generatedAt) {
  return {
    generated_at: generatedAt,
    count: entries.length,
    entries: entries.map((e) => ({
      tool_id: e.tool_id,
      display_name: e.display_name,
      wave: e.wave,
      compute_proof_ready: e.compute_proof_ready,
      trust_label: e.trust_label,
      data_vintage: e.data_vintage,
    })),
  };
}

function writeIfChanged(path, nextEntry) {
  let onDisk = null;
  try { onDisk = JSON.parse(readFileSync(path, "utf8")); } catch { /* missing/unparseable -> write fresh */ }
  if (onDisk && withoutStamp(onDisk) === withoutStamp(nextEntry)) return false;
  writeFileSync(path, JSON.stringify(nextEntry, null, 2) + "\n");
  return true;
}

/** Every *.json name currently in the register dir (missing dir -> empty list). */
function readRegisterDir() {
  try { return readdirSync(OUT_DIR); } catch { return []; }
}

function main() {
  const generatedAt = process.env.EUC_REGISTER_TIMESTAMP ?? new Date().toISOString();
  // isNonLive() from the shared lens rather than a local `status === "live"`:
  // ONE predicate now decides emission here, the sitemap, the hub and the start
  // index, so the four cannot disagree about what "left service" means.
  const liveNodes = CHAINGRAPH.nodes.filter((n) => !isNonLive(n));
  const entries = liveNodes.map((n) => buildRegisterEntry(n, generatedAt));
  const expectedNames = new Set(entries.map((e) => `${e.tool_id}.register.json`));
  const classified = classifyRegisterDir(readRegisterDir(), expectedNames);

  if (CHECK) {
    const existing = new Set(classified.owned);
    const expected = expectedNames;
    const missing = [...expected].filter((f) => !existing.has(f));
    const stale = classified.stale;
    // Filename presence is not freshness. Comparing only the file SET let 250 entries
    // sit on main carrying a trust_label, data_vintage and purpose that no longer
    // matched chaingraph.json, with this gate green the whole time. Compare content
    // too, minus generated_at (see withoutStamp() at module scope — the write path
    // compares on the very same predicate, so gate and writer cannot disagree).
    const drifted = [];
    for (const entry of entries) {
      const file = `${entry.tool_id}.register.json`;
      if (!existing.has(file)) continue;
      let onDisk;
      try {
        onDisk = JSON.parse(readFileSync(join(OUT_DIR, file), "utf8"));
      } catch {
        drifted.push(file);
        continue;
      }
      if (withoutStamp(onDisk) !== withoutStamp(entry)) drifted.push(file);
    }
    // index.json was written by this generator but never validated by this gate, so it
    // drifted invisibly: main carried count:605 against 609 live nodes, and
    // euc-register.html renders that count verbatim (gen-euc-register-page.mjs reads
    // index.count), so the published page understated the register by four entries with
    // this gate green. Same content-minus-stamp comparison as the entries above — a gate
    // has to cover everything its generator writes, or the uncovered part is the part
    // that rots (GENERATOR-NOOP-STABILITY-1).
    let indexDrifted = false;
    try {
      indexDrifted = withoutStamp(JSON.parse(readFileSync(join(OUT_DIR, "index.json"), "utf8"))) !== withoutStamp(buildIndex(entries, generatedAt));
    } catch {
      indexDrifted = true;
    }
    if (missing.length || stale.length || drifted.length || indexDrifted) {
      if (missing.length) console.error(`gen-euc-register --check: ${missing.length} missing entries, e.g. ${missing.slice(0, 5).join(", ")}`);
      // The remedy line names a command that CAN fix the failure it is printed
      // under. Before GENERATOR-STATUS-FILTER-1 there was no such command: the
      // write path had no delete, so this line could only ever be discharged by
      // hand (#1486). See prunePlan()/pruneStale() at module scope.
      if (stale.length) console.error(`gen-euc-register --check: ${stale.length} stale entries (node no longer live), e.g. ${stale.slice(0, 5).join(", ")} -- re-run \`node scripts/gen-euc-register.mjs\` to prune`);
      if (drifted.length) console.error(`gen-euc-register --check: ${drifted.length} entries drifted from chaingraph.json, e.g. ${drifted.slice(0, 5).join(", ")} -- re-run \`node scripts/gen-euc-register.mjs\``);
      if (indexDrifted) console.error("gen-euc-register --check: chaingraph/register/index.json is missing or drifted from chaingraph.json -- re-run `node scripts/gen-euc-register.mjs`");
      process.exit(1);
    }
    console.log(`gen-euc-register --check: OK, ${entries.length} entries + index.json in sync (set + content).`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // PRUNE FIRST, and REFUSE AS A WHOLE. Above the cap nothing is deleted AND
  // nothing is written, so there is no half-applied state to reason about.
  const confirmPrune = parseConfirmPrune(process.argv);
  if (Number.isNaN(confirmPrune)) {
    console.error("gen-euc-register: --confirm-prune=<n> needs a non-negative integer");
    process.exit(4);
  }
  const plan = prunePlan(classified.stale.length, { confirm: confirmPrune });
  if (plan.action === "REFUSE") {
    console.error(`gen-euc-register: REFUSED — ${plan.reason}. Nothing was written and nothing was deleted.`);
    console.error(`  stale entries (${classified.stale.length}):`);
    for (const f of classified.stale) console.error(`    chaingraph/register/${f}`);
    console.error("  If that list is correct, re-run with:");
    console.error(`    node scripts/gen-euc-register.mjs --confirm-prune=${classified.stale.length}`);
    process.exit(4);
  }
  const { removed } = pruneStale(OUT_DIR, classified.stale, { confirm: confirmPrune });

  let written = 0;
  for (const entry of entries) {
    if (writeIfChanged(join(OUT_DIR, `${entry.tool_id}.register.json`), entry)) written++;
  }
  const indexWritten = writeIfChanged(join(OUT_DIR, "index.json"), buildIndex(entries, generatedAt));
  console.log(`gen-euc-register: ${entries.length} entries derived; wrote ${written} changed entry file(s)${indexWritten ? " + index.json" : ""}, removed ${removed} stale entr(ies), left ${entries.length - written} unchanged file(s) untouched.`);
  if (classified.unrecognized.length) {
    console.log(`  note: ${classified.unrecognized.length} file(s) in chaingraph/register/ are not entries this generator owns and were left untouched: ${classified.unrecognized.slice(0, 5).join(", ")}${classified.unrecognized.length > 5 ? ", …" : ""}`);
  }
}

// Guarded so the self-test can import the pure prune helpers above without this
// script running main() against the live register directory as a side effect.
if (resolve(process.argv[1] || "") === resolve(fileURLToPath(import.meta.url))) main();
