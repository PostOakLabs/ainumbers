#!/usr/bin/env node
// prune-recompute-quarantine.mjs — REGEN-QUARANTINE-PRUNE-1: the main-side derived
// regen's quarantine PRUNE step (COVERED entry 'recompute-quarantine-prune', LAST in
// scripts/derived-artifacts.mjs's COVERED array so it runs AFTER every other regen
// step, on the regenerated tree).
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Both 2026-11-23 quarantine causes (art-350, art-713) say "DELETE this entry in
// the follow-up that lands the re-spliced monolith". The re-splice happens only on
// main (derived-artifacts-regen.yml), so no PR could ever do it, and each stale
// entry redded main's §18 gate ("quarantined, but its receipt REPRODUCES now")
// until a hand heal row landed (runs 45250735999, 45270542853). This step closes
// that gap mechanically: after the regen pass has re-spliced the monolith, it
// deletes exactly the quarantine entries whose receipts now reproduce, in the SAME
// bot commit — a re-prove can no longer turn main red one regen later.
//
// ── WHAT IT IS NOT (the ratchet's own law, restated from the quarantine file) ─
// ⛔ Not a threshold, not a classifier, never a widening. Counts only go DOWN:
//   this step can only REMOVE named entries the §18 gate itself reports as cured
//   ("quarantined, but its receipt REPRODUCES now"). It never adds an entry, never
//   edits a cause, never re-orders, and never touches any other key of the file.
//   A non-reproducing entry stays exactly as written. The decision of WHAT
//   reproduces stays entirely with scripts/check-recompute-equality.mjs — this
//   step re-runs that gate as its own process and acts only on its --json report,
//   so the two can never drift apart about a node's state.
//
// ── FAIL-CLOSED (SO #34c: a missing result is never a green one) ─────────────
// If the check cannot run, crashes, or prints anything that is not a well-formed
// report, this step exits 1 and writes NOTHING. A corrupt quarantine file (the
// DERIVED-SET-SELFTEST-1 probe byte shape) crashes the child's JSON.parse — that
// is machinery breakage and stops the regen pass loudly, exactly like a generator
// that cannot parse its input.
//
// Modes:
//   node scripts/prune-recompute-quarantine.mjs           prune (regen write mode):
//                                                         remove cured entries, write only when at least one goes
//   node scripts/prune-recompute-quarantine.mjs --check   freshness gate (COVERED `gate`; advisory on PRs via
//                                                         the generic downgrade, blocking on main): exit 0 iff a
//                                                         prune run would be a no-op (fixpoint holds)
//
// The child's exit code is deliberately NOT required to be 0: a report whose
// cured list is non-empty exits 1 (the ratchet fails until the entry is deleted)
// and that is exactly the report this step acts on. Only an UNREADABLE report is
// machinery failure.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
// Both inputs resolve module-relative (the same convention as the gate itself), so
// the regen pass, the DERIVED-SET-SELFTEST-1 scratch worktree and this CLI always
// operate on the tree the running copy lives in — never on process.cwd().
const CHECK_PATH = resolve(HERE, 'check-recompute-equality.mjs');
const QUARANTINE_PATH = resolve(HERE, 'recompute-equality-quarantine.json');

/**
 * Pure planner — decide which quarantine entries a well-formed §18 report says are
 * cured. "Cured" is the union of the report's `cured` (main/queue contexts report
 * every cured entry there) and `advisoryCured` (a PR context moves the entries this
 * PR did not cause there): a reproducing receipt is a reproducing receipt in every
 * context, and the prune that lands with the re-splicing regen owns all of them.
 * Anything malformed fails closed: { ok: false, reason }, no ids, no defaults.
 */
export function planPrune(report) {
  const bad = (reason) => ({ ok: false, remove: [], reason });
  if (!report || typeof report !== 'object' || Array.isArray(report)) return bad('report is not an object');
  // Shape witnesses: a real report carries every one of these arrays. Their
  // presence is the proof the child actually ran the gate to completion, not
  // that it printed some JSON-shaped error.
  for (const key of ['failures', 'cured', 'excused', 'matched', 'staleQuarantineEntries', 'advisoryCured']) {
    if (!Array.isArray(report[key])) return bad(`report.${key} is not an array — not a well-formed §18 --json report`);
  }
  const ids = [];
  const seen = new Set();
  for (const key of ['cured', 'advisoryCured']) {
    for (const item of report[key]) {
      if (!item || typeof item !== 'object' || typeof item.tool_id !== 'string' || !item.tool_id) {
        return bad(`report.${key} carries an entry without a string tool_id — refusing to guess`);
      }
      if (!seen.has(item.tool_id)) { seen.add(item.tool_id); ids.push(item.tool_id); }
    }
  }
  return { ok: true, remove: ids };
}

/**
 * Pure applier — remove exactly `removeIds` from the quarantine doc's nodes.
 * Everything else (the _comment header, observed_on/by, every surviving entry's
 * bytes, the array order) passes through untouched, and by construction the step
 * can never ADD an entry: the nodes list can only shrink. Returns
 * { doc, removedCount, removedIds }.
 */
export function applyPrune(quarantineDoc, removeIds) {
  const remove = new Set(removeIds);
  const nodes = Array.isArray(quarantineDoc?.nodes) ? quarantineDoc.nodes : [];
  const removedIds = nodes.filter((n) => n && remove.has(n.tool_id)).map((n) => n.tool_id);
  const doc = { ...quarantineDoc, nodes: nodes.filter((n) => !(n && remove.has(n.tool_id))) };
  return { doc, removedCount: removedIds.length, removedIds };
}

/** Run the §18 gate in --json mode as its own process and return { status, report, raw }.
 *  report is null unless stdout parsed and passed planPrune's shape check. */
export function runCheck({ checkPath = CHECK_PATH, repoRoot = REPO, spawn = spawnSync } = {}) {
  const r = spawn(process.execPath, [checkPath, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 600000,
    killSignal: 'SIGKILL',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!r || r.status === null) {
    return { ok: false, reason: `the §18 recompute-equality check did not run to an exit code${r && r.error ? ` (${r.error})` : ''}` };
  }
  let report;
  try { report = JSON.parse(String(r.stdout || '')); } catch {
    return { ok: false, reason: `the §18 recompute-equality check printed no parsable --json report on stdout (exit ${r.status}); stderr tail: ${(String(r.stderr || '').trim().split('\n').slice(-3).join(' | ')).slice(0, 400)}` };
  }
  const plan = planPrune(report);
  if (!plan.ok) return { ok: false, reason: plan.reason };
  return { ok: true, status: r.status, report, remove: plan.remove };
}

function readQuarantine() {
  let doc;
  try { doc = JSON.parse(readFileSync(QUARANTINE_PATH, 'utf8')); } catch (e) {
    return { ok: false, reason: `the quarantine file itself is unparseable (${e.message}) — machinery breakage, writing nothing` };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.nodes)) {
    return { ok: false, reason: 'the quarantine file has no nodes array — not a shape this step may rewrite' };
  }
  return { ok: true, doc };
}

function main() {
  const CHECK = process.argv.includes('--check');
  if (process.argv.length > 2 && process.argv.slice(2).some((a) => !['--check'].includes(a))) {
    console.error('usage: node scripts/prune-recompute-quarantine.mjs [--check]');
    process.exit(2);
  }
  const q = readQuarantine();
  if (!q.ok) { console.error(`✗ §18 quarantine prune: ${q.reason}`); process.exit(1); }
  const c = runCheck();
  if (!c.ok) { console.error(`✗ §18 quarantine prune: ${c.reason}`); process.exit(1); }
  const label = `§18 quarantine prune (--check fixpoint probe)`;
  if (CHECK) {
    if (!c.remove.length) {
      console.log(`✓ ${label}: fixpoint holds — 0 quarantined entries reproduce (${c.report.examined} receipt(s) examined in ${(c.report.elapsed_ms / 1000).toFixed(1)} s).`);
      process.exit(0);
    }
    console.error(`✗ ${label}: ${c.remove.length} quarantined entr(ies) whose receipt REPRODUCES now — the main-side regen prune deletes them in the same bot commit (the ratchet only goes down):`);
    for (const id of c.remove) console.error(`  · ${id}`);
    process.exit(1);
  }
  const { doc, removedCount, removedIds } = applyPrune(q.doc, c.remove);
  if (!removedCount) {
    console.log(`§18 quarantine prune: nothing to prune — 0 quarantined entries reproduce (${c.report.examined} receipt(s) examined); bytes untouched.`);
    if (c.report.failures.length || c.report.staleQuarantineEntries.length) {
      console.warn(`  ⚠ the §18 gate itself is still red on this tree (failures: ${c.report.failures.length}, stale entries: ${c.report.staleQuarantineEntries.length}) — that red needs its own cure; this step only ever deletes cured entries.`);
    }
    process.exit(0);
  }
  // Write ONLY when at least one entry goes (row contract), in the file's own
  // serialization (verified byte-identical round-trip: JSON.stringify(doc, null, 2) + '\n').
  writeFileSync(QUARANTINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`§18 quarantine prune: removed ${removedCount} entr(y/ies) whose receipt reproduces on the regenerated tree:`);
  for (const id of removedIds) console.log(`  − ${id}`);
  if (c.report.failures.length || c.report.staleQuarantineEntries.length) {
    console.warn(`  ⚠ the §18 gate itself is still red on this tree (failures: ${c.report.failures.length}, stale entries: ${c.report.staleQuarantineEntries.length}) — that red needs its own cure; this step only ever deletes cured entries.`);
  }
  process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
