#!/usr/bin/env node
// check-deadline-freshness.mjs — deadline-wall freshness gate (SI-DEADLINE-FRESH-1).
//
// WHY: `data/reg-deadlines.json` entries each carry their own `verified_on` stamp,
// and `deadline-wall.html` renders it to the reader (SO #0 option 2/3 — the reader
// performs the freshness check, or reads a dated observation). But nothing asserts
// that stamp is still recent — an entry could go stale for months with no signal.
// This gate derives staleness FROM the entry's own `verified_on` field (never a
// hand-maintained "last checked" ledger) and reds out past a threshold. Per SO #0
// (SURVIVES-THE-MAINTAINER, "no recurring human duty may ship"): this REPLACES the
// standing-quarterly-reverify chore START-INFRA-BUILD-SPEC.md §8 originally
// mandated — the gate reports staleness, it does not promise anyone will act by
// a date. Zero-dependency, node: builtins only (site repo is zero-dep).
//
// Usage:
//   node scripts/check-deadline-freshness.mjs             strict (CI): exit 1 on any stale entry
//   node scripts/check-deadline-freshness.mjs --summary    counts only, exit 0

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDenominatorOrExit } from './denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DATA_PATH = resolve(REPO, 'data/reg-deadlines.json');

const SUMMARY = process.argv.includes('--summary');

// The chore this gate replaces was a standing QUARTERLY re-verify. 120 days is a
// quarter (~91 days) plus slack, so a slightly-late check doesn't red the build on
// day 92 — but a genuinely stale entry (no source re-check across a full quarter
// and change) does. Named constant per row's requirement — never a magic number.
const STALE_THRESHOLD_DAYS = 120;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

// ── DENOMINATOR SENTINEL (DENOMINATOR-SENTINEL-1 / F-05) ─────────────────────────────────────────
// `data.entries ?? []` was the hole: a MISSING ledger file throws here (readFileSync), which fails
// closed and is fine — but an EMPTIED or RENAMED `entries` key inside a present file degraded silently
// to zero entries, and the gate closed with "✓ deadline-freshness gate clean — 0 entries, all verified
// within 120 days." Every entry vacuously fresh, nothing checked, exit 0.
//
// Asserted before --summary as well as before the strict path: the ledger being non-empty is a
// precondition of this gate having anything to say in EITHER mode, not a property of the verdict.
const entries = Array.isArray(data.entries) ? data.entries : [];
assertDenominatorOrExit(entries.length, 1, {
  label: 'check-deadline-freshness',
  unit: 'dated deadline entr(y|ies)',
  scope: `data/reg-deadlines.json → .entries[]${Array.isArray(data.entries) ? '' : ' (absent or not an array — present keys: ' + Object.keys(data).join(', ') + ')'}`,
  remedy: 'the entries[] array was emptied, renamed or replaced — restore it: git checkout origin/main -- data/reg-deadlines.json',
});

const now = new Date();

const stale = [];
for (const entry of entries) {
  const verifiedOn = entry.verified_on;
  if (!verifiedOn) {
    stale.push({ id: entry.id, verified_on: verifiedOn ?? '(missing)', age: null, reason: 'no verified_on field' });
    continue;
  }
  const verifiedDate = new Date(`${verifiedOn}T00:00:00Z`);
  if (Number.isNaN(verifiedDate.getTime())) {
    stale.push({ id: entry.id, verified_on: verifiedOn, age: null, reason: 'unparseable verified_on date' });
    continue;
  }
  const ageDays = Math.floor((now.getTime() - verifiedDate.getTime()) / MS_PER_DAY);
  if (ageDays > STALE_THRESHOLD_DAYS) {
    stale.push({ id: entry.id, verified_on: verifiedOn, age: ageDays, reason: null });
  }
}

if (SUMMARY) {
  console.log(`deadline freshness — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, ${stale.length} stale (threshold ${STALE_THRESHOLD_DAYS}d)`);
  process.exit(0);
}

if (stale.length) {
  console.error(`✗ deadline-freshness gate FAILED — ${stale.length} of ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in data/reg-deadlines.json past the ${STALE_THRESHOLD_DAYS}-day freshness threshold:`);
  for (const s of stale) {
    if (s.reason) {
      console.error(`  • ${s.id} — ${s.reason} (verified_on="${s.verified_on}")`);
    } else {
      console.error(`  • ${s.id} — last verified ${s.verified_on}, ${s.age} days ago (threshold ${STALE_THRESHOLD_DAYS})`);
    }
  }
  console.error('\nFix: re-check the entry against its source_url and update verified_on (and date/recurrence if changed).');
  process.exit(1);
}

console.log(`✓ deadline-freshness gate clean — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, all verified within ${STALE_THRESHOLD_DAYS} days.`);
