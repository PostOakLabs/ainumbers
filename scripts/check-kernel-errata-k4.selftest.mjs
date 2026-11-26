#!/usr/bin/env node
/**
 * Self-test for scripts/check-kernel-errata-k4.mjs: planted controls on the real art-807
 * fix pair (59a5e7cbc7^ to 59a5e7cbc7, 255 divergent probes of 896 in the measured corpus).
 *
 *   - GREEN: the three real entries pass with a non-empty sample and zero too-narrow probes.
 *   - RED (too narrow): a planted `return false` predicate on the real pair must flag every
 *     divergent probe (too_narrow === divergent, divergent > 0), which also proves the gate
 *     consulted the predicate on each divergent probe rather than passing vacuously.
 *   - COUNTED (too wide): a planted `return true` predicate is accepted - zero reds - and
 *     the too_wide count must equal the whole sample, per the spec's "accepted and counted".
 *   - RED (throwing predicate): a predicate that throws is not a pass; every divergent probe
 *     reads too_narrow and every throw is counted as an evaluation error.
 *
 * The planted predicate files are written beside the real predicates and removed in a
 * finally block (the same leave-nothing-behind rule the writer's self-test follows).
 *   node scripts/check-kernel-errata-k4.selftest.mjs
 * Node built-ins only; no network, no clock, no randomness.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, SOURCES_DIR, PREDICATES_DIR } from './lib/kernel-errata.mjs';
import { checkK4, loadSourceRecords } from './check-kernel-errata-k4.mjs';

let fails = 0;
const expect = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };

const ART807_ENTRY = JSON.parse(readFileSync(join(REPO_ROOT, SOURCES_DIR, 'KE-2026-0001.json'), 'utf8'));
const PLANTED_ID = 'KE-9999-0003';
const plantedPath = join(REPO_ROOT, PREDICATES_DIR, `${PLANTED_ID}.mjs`);
const plantedRel = `${PREDICATES_DIR}/${PLANTED_ID}.mjs`;

// GREEN: the real entries.
{
  const records = loadSourceRecords(REPO_ROOT);
  expect('precondition: three real entries present', records.length >= 3);
  const details = await checkK4(REPO_ROOT, records);
  expect('K4 green: every real entry samples a non-empty corpus', details.every((d) => d.probes > 0 && d.reds.length === 0));
  expect('K4 green: no real entry is too narrow', details.every((d) => d.too_narrow === 0 && d.eval_errors === 0));
}

// Synthetic records on the real pair with planted predicates (written, run, removed).
const synth = (predicatePath) => ({
  file: `${PLANTED_ID}.json`,
  entry: { ...structuredClone(ART807_ENTRY), id: PLANTED_ID, affected_predicate: { path: predicatePath, sha256: '0'.repeat(64) } },
});
mkdirSync(join(REPO_ROOT, PREDICATES_DIR), { recursive: true });
let narrow, wide, throwing;
try {
  writeFileSync(plantedPath, '// planted control (too narrow)\nexport function affected(policy_parameters) {\n  return false;\n}\n');
  narrow = (await checkK4(REPO_ROOT, [synth(plantedRel)]))[0];
  writeFileSync(plantedPath, '// planted control (too wide)\nexport function affected(policy_parameters) {\n  return true;\n}\n');
  wide = (await checkK4(REPO_ROOT, [synth(plantedRel)]))[0];
  writeFileSync(plantedPath, '// planted control (throws)\nexport function affected(policy_parameters) {\n  throw new Error("planted");\n}\n');
  throwing = (await checkK4(REPO_ROOT, [synth(plantedRel)]))[0];
} finally {
  rmSync(plantedPath, { force: true });
}
expect('K4 precondition: the planted corpus has divergent probes', narrow.divergent > 0);
expect('K4 red: return false is too narrow on every divergent probe', narrow.too_narrow === narrow.divergent && narrow.divergent > 0 && narrow.too_wide === 0);
expect('K4 red: the too-narrow detail carries no other red (the divergence IS the red)', narrow.reds.length === 0);
expect('K4 counted: return true is accepted and every agreeing probe counted as too wide', wide.too_narrow === 0 && wide.reds.length === 0 && wide.too_wide === wide.probes - wide.divergent && wide.too_wide > 0);
expect('K4 red: a throwing predicate is not a pass', throwing.too_narrow === throwing.divergent && throwing.divergent > 0 && throwing.eval_errors === throwing.probes);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
