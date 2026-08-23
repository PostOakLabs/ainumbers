#!/usr/bin/env node
/**
 * scripts/gen-euc-register.test.mjs — prune controls for gen-euc-register.mjs
 * (GENERATOR-STATUS-FILTER-1).
 *
 * Mirrors scripts/gen-registry-kernel-resolve.test.mjs's six controls, because
 * the prune mechanism is deliberately the SAME mechanism (same cap, same REFUSED
 * shape, same --confirm-prune escape hatch). ⛔ Do not fork either half.
 *
 * SO #40(b) — the RED is control 1: before this change, the write path had no
 * delete at all, so `--check`'s own "stale entries (node no longer live)"
 * message named a condition its own generator could not clear. That is the exact
 * unrepairable-drift shape that redded main for 15 hours after PR #1477 and that
 * scripts/check-regen-repairable.mjs exists to detect.
 *
 * Everything runs against a scratch directory. ⛔ Nothing here touches the live
 * chaingraph/register/, and ⛔ nothing here goes near registry/lineage or
 * registry/errata, which are append-only and are never pruned by anything.
 *
 * Run: node scripts/gen-euc-register.test.mjs
 */

import { mkdtempSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyRegisterDir, prunePlan, parseConfirmPrune, pruneStale,
  OWNED_ENTRY_NAME, DELETION_CAP,
} from './gen-euc-register.mjs';

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
function heading(n, s) { console.log(`\n[${n}] ${s}`); }

const DIR = mkdtempSync(join(tmpdir(), 'euc-'));
function plant(names) {
  for (const n of readdirSync(DIR)) rmSync(join(DIR, n), { force: true });
  for (const n of names) writeFileSync(join(DIR, n), '{}\n');
}
const silent = () => {};

console.log('▶ gen-euc-register prune controls (GENERATOR-STATUS-FILTER-1)');

try {
  heading(1, 'THE REAL EVENT — one node leaves service, its entry is classified STALE and PRUNED');
  // The #1486 shape: art-99 flipped to "deprecated", so the live set stopped
  // producing its filename while the file kept shipping.
  const live = ['art-98-x.register.json', 'art-100-y.register.json'];
  plant([...live, 'art-99-mica-transitional-deadline-router.register.json', 'index.json']);
  const c1 = classifyRegisterDir(readdirSync(DIR), new Set(live));
  check('exactly 1 stale entry, and it is art-99', c1.stale.length === 1 && c1.stale[0].startsWith('art-99-'), c1.stale.join(','));
  check('index.json is NOT classified as stale', !c1.stale.includes('index.json'));
  check('plan is PRUNE at 1 orphan', prunePlan(c1.stale.length).action === 'PRUNE');
  const r1 = pruneStale(DIR, c1.stale, { log: silent });
  check('1 file removed', r1.removed === 1);
  check('the art-99 entry is gone', !existsSync(join(DIR, 'art-99-mica-transitional-deadline-router.register.json')));
  check('the two live entries survive untouched', live.every((f) => existsSync(join(DIR, f))));
  check('index.json survives', existsSync(join(DIR, 'index.json')));

  heading(2, 'IDEMPOTENT — a second pass has nothing left to do');
  const c2 = classifyRegisterDir(readdirSync(DIR), new Set(live));
  check('0 stale on the second pass', c2.stale.length === 0);
  check('plan is NONE', prunePlan(0).action === 'NONE');
  check('pruneStale removes nothing', pruneStale(DIR, c2.stale, { log: silent }).removed === 0);

  heading(3, `CAP RED — ${DELETION_CAP + 1} stale entries REFUSE, and delete NOTHING`);
  const many = Array.from({ length: DELETION_CAP + 1 }, (_, i) => `art-${900 + i}-z.register.json`);
  plant([...live, ...many]);
  const c3 = classifyRegisterDir(readdirSync(DIR), new Set(live));
  check(`${DELETION_CAP + 1} stale detected`, c3.stale.length === DELETION_CAP + 1, String(c3.stale.length));
  const p3 = prunePlan(c3.stale.length);
  check('plan is REFUSE', p3.action === 'REFUSE', JSON.stringify(p3));
  check('the refusal states the cap', /deletion cap of 10/.test(p3.reason || ''), p3.reason);
  const r3 = pruneStale(DIR, c3.stale, { log: silent });
  check('nothing was removed', r3.removed === 0);
  check('EVERY file still on disk — no half-applied state', readdirSync(DIR).length === live.length + many.length);

  heading(4, '--confirm-prune must match the count EXACTLY (it cannot be set once and forgotten)');
  check('wrong count still REFUSES', prunePlan(c3.stale.length, { confirm: 3 }).action === 'REFUSE');
  check('the refusal names the mismatch', /does not match/.test(prunePlan(c3.stale.length, { confirm: 3 }).reason));
  check('exact count PRUNES', prunePlan(c3.stale.length, { confirm: c3.stale.length }).action === 'PRUNE');
  check('parseConfirmPrune absent -> null', parseConfirmPrune(['node', 'x']) === null);
  check('parseConfirmPrune reads the number', parseConfirmPrune(['--confirm-prune=11']) === 11);
  check('parseConfirmPrune rejects garbage', Number.isNaN(parseConfirmPrune(['--confirm-prune=abc'])));
  const r4 = pruneStale(DIR, c3.stale, { confirm: c3.stale.length, log: silent });
  check(`confirmed prune removed all ${DELETION_CAP + 1}`, r4.removed === DELETION_CAP + 1);
  check('the live entries are still there', live.every((f) => existsSync(join(DIR, f))));

  heading(5, 'NOT MINE — a file this generator never wrote is reported, never deleted');
  plant([...live, 'notes.json', 'art-1.register.txt', 'README.md']);
  const c5 = classifyRegisterDir(readdirSync(DIR), new Set(live));
  check('notes.json is UNRECOGNIZED', c5.unrecognized.includes('notes.json'));
  check('it is NOT in stale', !c5.stale.includes('notes.json'));
  check('a non-.json file is invisible entirely', !c5.unrecognized.includes('README.md') && !c5.unrecognized.includes('art-1.register.txt'));
  check('pruneStale THROWS rather than deleting a foreign name', (() => {
    try { pruneStale(DIR, ['notes.json'], { log: silent }); return false; } catch { return true; }
  })());
  check('notes.json still exists after that refusal', existsSync(join(DIR, 'notes.json')));
  check('OWNED_ENTRY_NAME rejects index.json', !OWNED_ENTRY_NAME.test('index.json'));
  check('OWNED_ENTRY_NAME rejects a path escape', !OWNED_ENTRY_NAME.test('../evil.register.json'));

  heading(6, 'UNCHANGED — a directory in sync is left completely alone');
  plant([...live, 'index.json']);
  const before = readdirSync(DIR).sort().join(',');
  const c6 = classifyRegisterDir(readdirSync(DIR), new Set(live));
  pruneStale(DIR, c6.stale, { log: silent });
  check('0 stale', c6.stale.length === 0);
  check('directory listing byte-identical', readdirSync(DIR).sort().join(',') === before);

  heading(7, 'ONE DEFINITION — the set --check reports is the set the write path deletes');
  plant([...live, 'art-99-gone.register.json']);
  const names = readdirSync(DIR);
  const a = classifyRegisterDir(names, new Set(live)).stale;
  const b = classifyRegisterDir(names, live).stale;
  check('classifyRegisterDir is order- and container-independent', JSON.stringify(a) === JSON.stringify(b));
  check('and it is what pruneStale acts on', pruneStale(DIR, a, { log: silent }).removed === a.length);
} finally {
  rmSync(DIR, { recursive: true, force: true });
}

console.log(`\n${fail ? '❌' : '✅'} gen-euc-register prune controls: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
