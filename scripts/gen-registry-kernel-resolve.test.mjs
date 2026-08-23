#!/usr/bin/env node
/**
 * gen-registry-kernel-resolve.test.mjs — the six prune controls required by
 * GENERATOR-PRUNES-ORPHANS-1 (Tim ruling 2026-08-23: "the generator prunes
 * what it owns — a single-writer's scope includes deleting artifacts for nodes
 * that leave service, consistent with the okf deletion fix and its
 * deletion-cap guard").
 *
 * ⛔ THE LOAD-BEARING CONTROLS ARE C2 (CAP RED) AND C4 (NOT-MINE). Deleting is
 * the one operation that turns a stale-artifact bug into data loss. C2 proves
 * an above-cap prune REFUSES and removes nothing; C4 proves prune authority
 * stops at the generator's own filename shape and at the output-directory
 * boundary. If either ever passes vacuously, the guard IS the vulnerability
 * (SO #34, "VERIFY A CHECKER BY MUTATION, NOT BY READING IT").
 *
 * ⛔ HERMETIC BY DESIGN — this test NEVER runs `--write`. registry/kernel is an
 * SO #35 shared derived artifact whose only writer is the main-side regen, so a
 * gate that repaired it inside somebody's PR worktree would silently make that
 * PR violate the single-writer rule. Every deletion control runs against a
 * fresh mkdtemp scratch directory (SO #55: session-private, never a fixed
 * shared temp path). The one live-tree call is `--check`, which is read-only.
 *
 * Run: node scripts/gen-registry-kernel-resolve.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyOutputDir, prunePlan, pruneOrphans, parseConfirmPrune,
  OWNED_RECORD_NAME, DELETION_CAP,
} from './gen-registry-kernel-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'gen-registry-kernel-resolve.mjs');

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push(`  ok   ${name}`); }
  catch (e) { fail++; results.push(`  FAIL ${name}\n         ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

/** A syntactically valid record name — 64 lowercase hex + .json. */
const hexName = (seed) => (seed.toString(16).padStart(2, '0').repeat(32)).slice(0, 64) + '.json';

const scratches = [];
function scratch(names) {
  const dir = mkdtempSync(join(tmpdir(), 'ain-rkr-'));
  scratches.push(dir);
  for (const n of names) writeFileSync(join(dir, n), '{}');
  return dir;
}
const onDisk = (dir) => readdirSync(dir).sort();
const silent = () => {};

// ── C1 · PRUNE GREEN — an orphan below the cap is deleted, and named ─────────
t('C1 PRUNE GREEN: one below-cap orphan is classified, deleted and named; siblings survive', () => {
  const keep1 = hexName(1), keep2 = hexName(2), gone = hexName(3);
  const dir = scratch([keep1, keep2, gone]);
  const wanted = new Set([keep1, keep2]);

  const c = classifyOutputDir(onDisk(dir), wanted);
  eq(c.orphans.length, 1, 'exactly one orphan classified');
  eq(c.orphans[0], gone, 'the orphan is the record no in-scope kernel produces');

  const named = [];
  const { removed, plan } = pruneOrphans(dir, c.orphans, { log: (m) => named.push(m) });
  eq(plan.action, 'PRUNE', 'plan is PRUNE below the cap');
  eq(removed, 1, 'exactly one file removed');
  assert(named.length === 1 && named[0].includes(gone), `the deleted file is named on stdout — got ${JSON.stringify(named)}`);
  assert(!existsSync(join(dir, gone)), 'the orphan is gone from disk');
  assert(existsSync(join(dir, keep1)) && existsSync(join(dir, keep2)), 'wanted records are untouched');

  const after = classifyOutputDir(onDisk(dir), wanted);
  eq(after.orphans.length, 0, 'a re-classification finds nothing left to prune (this is what makes --check exit 0)');
});

// ── C2 · CAP RED — the control that matters ──────────────────────────────────
t('C2 CAP RED: above the cap the plan REFUSES, nothing is deleted, and the reason names the cap', () => {
  const many = Array.from({ length: DELETION_CAP + 1 }, (_, i) => hexName(i + 10));
  const dir = scratch(many);
  const c = classifyOutputDir(onDisk(dir), new Set()); // nothing wanted -> every file is an orphan
  eq(c.orphans.length, DELETION_CAP + 1, 'every file classified as an orphan');

  const plan = prunePlan(c.orphans.length);
  eq(plan.action, 'REFUSE', 'above-cap plan is REFUSE');
  assert(plan.reason.includes(String(DELETION_CAP)), `refusal reason names the cap — got: ${plan.reason}`);

  const { removed } = pruneOrphans(dir, c.orphans, { log: silent });
  eq(removed, 0, 'a refusal deletes nothing');
  eq(onDisk(dir).length, DELETION_CAP + 1, 'every file is still on disk after the refusal — no half-applied state');
});

t('C2b CAP RED escape hatch: only the EXACT confirmed count proceeds', () => {
  const n = DELETION_CAP + 5;
  eq(prunePlan(n, { confirm: null }).action, 'REFUSE', 'unconfirmed above-cap refuses');
  eq(prunePlan(n, { confirm: n - 1 }).action, 'REFUSE', 'a wrong confirmed count refuses');
  eq(prunePlan(n, { confirm: n + 1 }).action, 'REFUSE', 'a wrong confirmed count refuses in the other direction too');
  eq(prunePlan(n, { confirm: n }).action, 'PRUNE', 'the exact count proceeds — the operator has read the list');
  eq(parseConfirmPrune(['--write', `--confirm-prune=${n}`]), n, 'the flag parses');
  eq(parseConfirmPrune(['--write']), null, 'absent flag is null, not 0');
  assert(Number.isNaN(parseConfirmPrune(['--confirm-prune=abc'])), 'a non-integer confirm is NaN, so main() can reject it');
});

// ── C3 · REAL CASE STILL PASSES — the whole point of the number ──────────────
t('C3 REAL CASE: the measured 1-file and 2-file deletion events are NOT blocked', () => {
  // 1 = art-99's kernel-resolve record (PR #1480, 2026-08-23).
  // 2 = art-99's OKF pages (PR #1479, 2026-08-22) — the event #1479 exists to let through.
  eq(prunePlan(1).action, 'PRUNE', 'the 1-file event passes unattended');
  eq(prunePlan(2).action, 'PRUNE', 'the 2-file event passes unattended');
  assert(DELETION_CAP >= 5 * 2, `the cap keeps real-event headroom — got ${DELETION_CAP}`);
});

// ── C4 · NOT-MINE UNTOUCHED — prune authority stops at the boundary ──────────
t('C4 NOT-MINE: files this generator does not own are never orphans and are never deleted', () => {
  const mine = hexName(7), orphan = hexName(8);
  const foreignJson = ['index.json', 'keep-me.json', 'README.json'];
  const foreignOther = ['notes.txt', 'desktop.ini'];
  const dir = scratch([mine, orphan, ...foreignJson, ...foreignOther]);
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'sub', hexName(9)), '{}'); // owned SHAPE, wrong depth

  const c = classifyOutputDir(onDisk(dir), new Set([mine]));
  eq(c.orphans.join(','), orphan, 'only the owned-shape, no-longer-produced file is an orphan');
  eq(c.unrecognized.join(','), ['README.json', 'index.json', 'keep-me.json'].join(','), 'other *.json entries are reported as unrecognized, not as orphans');
  for (const f of foreignOther) assert(!c.owned.includes(f) && !c.unrecognized.includes(f), `${f} is invisible to this generator, exactly as before prune existed`);

  pruneOrphans(dir, c.orphans, { log: silent });
  for (const f of [mine, ...foreignJson, ...foreignOther]) assert(existsSync(join(dir, f)), `${f} survived the prune`);
  assert(existsSync(join(dir, 'sub', hexName(9))), 'a record-shaped file one directory down is NOT reachable — no recursion');

  // MUTATION CONTROL: hand pruneOrphans a name it does not own and it must refuse
  // rather than trust its caller. If this ever stops throwing, the ownership
  // predicate has become decorative.
  let threw = false;
  try { pruneOrphans(dir, ['index.json'], { log: silent }); } catch { threw = true; }
  assert(threw, 'pruneOrphans re-asserts ownership on every name and refuses a foreign one');
  assert(existsSync(join(dir, 'index.json')), 'the foreign file survived the refused call');
});

t('C4b OWNERSHIP PREDICATE: one character off the shape is never owned', () => {
  const hex = 'a'.repeat(64);
  assert(OWNED_RECORD_NAME.test(`${hex}.json`), 'the real shape matches');
  for (const bad of [
    `${'a'.repeat(63)}.json`,          // too short
    `${'a'.repeat(65)}.json`,          // too long
    `${'A'.repeat(64)}.json`,          // uppercase hex
    `${hex}.JSON`,                     // uppercase extension
    `${hex}.json.bak`,                 // suffixed
    `sha256:${hex}.json`,              // prefixed
    `../${hex}.json`,                  // traversal out of the output directory
    `sub/${hex}.json`,                 // one level down
    `${'g'.repeat(64)}.json`,          // non-hex characters
  ]) assert(!OWNED_RECORD_NAME.test(bad), `must not be owned: ${bad}`);
});

// ── C5 · IDEMPOTENT ──────────────────────────────────────────────────────────
t('C5 IDEMPOTENT: a second prune over the same directory deletes nothing', () => {
  const keep = hexName(11), gone = hexName(12);
  const dir = scratch([keep, gone]);
  const wanted = new Set([keep]);

  const first = pruneOrphans(dir, classifyOutputDir(onDisk(dir), wanted).orphans, { log: silent });
  eq(first.removed, 1, 'first run removes the orphan');
  const second = pruneOrphans(dir, classifyOutputDir(onDisk(dir), wanted).orphans, { log: silent });
  eq(second.removed, 0, 'second run removes nothing');
  eq(second.plan.action, 'NONE', 'and reports there was nothing to do');
  eq(onDisk(dir).join(','), keep, 'the directory is stable at the wanted set');
});

// ── C6 · UNCHANGED — missing/stale behaviour is exactly as before ────────────
t('C6 UNCHANGED: owned-set membership still drives missing/stale exactly as the old *.json walk did', () => {
  const present = hexName(21), absent = hexName(22);
  const dir = scratch([present]);
  const wanted = new Set([present, absent]);
  const c = classifyOutputDir(onDisk(dir), wanted);
  assert(c.owned.includes(present), 'a present wanted record is owned, so --check compares its bytes');
  assert(!c.owned.includes(absent), 'an absent wanted record is not on disk, so --check reports it missing');
  eq(c.orphans.length, 0, 'a wanted record is never an orphan');
  eq(c.unrecognized.length, 0, 'nothing unrecognized in a clean directory');
});

t('C6b UNCHANGED (integration): --check on the live tree is read-only and still exits 0', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
  assert(/REGISTRY-RESOLVE-STATIC-1 clean/.test(out), `expected the clean line, got: ${out.trim()}`);
});

for (const dir of scratches) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* scratch */ } }

console.log('gen-registry-kernel-resolve.test.mjs — prune controls (GENERATOR-PRUNES-ORPHANS-1)');
console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed · deletion cap = ${DELETION_CAP}`);
process.exit(fail ? 1 : 0);
