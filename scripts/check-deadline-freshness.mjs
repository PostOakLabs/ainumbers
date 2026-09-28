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

// ADVISORY early warning (FRESHNESS-REVERIFY-1). An entry that will cross
// STALE_THRESHOLD_DAYS within this many days is PRINTED and nothing else: the
// gate's exit code is untouched by it, and the 120-day threshold above is
// unchanged. WHY it exists: on 2026-09-28 fourteen entries shared verified_on
// 2026-07-24 and were all due to turn preflight (and the deploy workflow) red
// on the same day, 2026-11-22, with no prior signal of any kind. A warning that
// fires a month out turns a cliff into a queue-able row.
const EXPIRY_WARNING_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The deadline wall carries its own hand-maintained copy of this data (a
// `var REG_DEADLINES = [...]` literal, commented "mirrors data/reg-deadlines.json").
// Nothing compared the two until this gate did, and they HAD already drifted:
// pillar-two-gir's jurisdiction read "OECD / Global" on the page against
// "OECD / Global (model rule; local implementation varies by country)" in the JSON.
const PAGE_PATH = resolve(REPO, 'deadline-wall.html');
const PAGE_MARKER = 'var REG_DEADLINES = ';

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

// ── PAGE PARITY (FRESHNESS-REVERIFY-1) ───────────────────────────────────────────────────────────
// Extract the page's REG_DEADLINES array literal and compare it to the JSON entry for entry. The
// literal is pure JSON (one object per line, no trailing comma, no JS-only syntax), so JSON.parse
// is the whole parser — deliberately NOT a regex field-scrape, which would miss added/removed keys.
// Key order is normalised before comparison: the two copies are the same DATA, not the same bytes.
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canon(value[k])]));
  }
  return value;
}

function readPageEntries() {
  let html;
  try {
    html = readFileSync(PAGE_PATH, 'utf8');
  } catch (err) {
    return { error: `deadline-wall.html unreadable: ${err.message}` };
  }
  const markerAt = html.indexOf(PAGE_MARKER);
  if (markerAt === -1) return { error: `no "${PAGE_MARKER}" block in deadline-wall.html (was the page rewritten?)` };
  const arrayAt = html.indexOf('[', markerAt);
  const endAt = html.indexOf('\n];', arrayAt);
  if (arrayAt === -1 || endAt === -1) return { error: 'REG_DEADLINES block found but its array literal is unterminated (expected a line reading "];")' };
  try {
    return { entries: JSON.parse(html.slice(arrayAt, endAt + 2)) };
  } catch (err) {
    return { error: `REG_DEADLINES array is not parseable JSON: ${err.message}` };
  }
}

const page = readPageEntries();
const parityDiffs = [];
if (!page.error) {
  const jsonById = new Map(entries.map((e) => [e.id, e]));
  const pageById = new Map(page.entries.map((e) => [e.id, e]));
  for (const id of jsonById.keys()) {
    if (!pageById.has(id)) parityDiffs.push(`${id} — present in data/reg-deadlines.json, MISSING from deadline-wall.html`);
  }
  for (const id of pageById.keys()) {
    if (!jsonById.has(id)) parityDiffs.push(`${id} — present in deadline-wall.html, MISSING from data/reg-deadlines.json`);
  }
  for (const [id, jsonEntry] of jsonById) {
    const pageEntry = pageById.get(id);
    if (!pageEntry) continue;
    for (const field of new Set([...Object.keys(jsonEntry), ...Object.keys(pageEntry)])) {
      const a = JSON.stringify(canon(jsonEntry[field]));
      const b = JSON.stringify(canon(pageEntry[field]));
      if (a !== b) parityDiffs.push(`${id}.${field} — JSON ${a ?? '(absent)'} vs page ${b ?? '(absent)'}`);
    }
  }
  const jsonOrder = entries.map((e) => e.id).join(',');
  const pageOrder = page.entries.map((e) => e.id).join(',');
  if (!parityDiffs.length && jsonOrder !== pageOrder) parityDiffs.push('entry ORDER differs between data/reg-deadlines.json and deadline-wall.html');
}

const now = new Date();

const stale = [];
const expiringSoon = [];
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
  } else if (ageDays > STALE_THRESHOLD_DAYS - EXPIRY_WARNING_DAYS) {
    expiringSoon.push({
      id: entry.id,
      verified_on: verifiedOn,
      age: ageDays,
      expires_on: new Date(verifiedDate.getTime() + (STALE_THRESHOLD_DAYS + 1) * MS_PER_DAY).toISOString().slice(0, 10),
      days_left: STALE_THRESHOLD_DAYS - ageDays,
    });
  }
}

// Advisory, never fatal: printed in both modes, changes no exit code.
if (expiringSoon.length) {
  console.log(`⚠ advisory — ${expiringSoon.length} of ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} cross the ${STALE_THRESHOLD_DAYS}-day threshold within ${EXPIRY_WARNING_DAYS} days:`);
  for (const e of expiringSoon.sort((a, b) => a.days_left - b.days_left)) {
    console.log(`  • ${e.id} — verified ${e.verified_on}, ${e.age}d old, reds this gate on ${e.expires_on} (${e.days_left}d left)`);
  }
  console.log('  This is a warning only. Re-verify against source_url and update verified_on before that date.');
}

if (SUMMARY) {
  console.log(`deadline freshness — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, ${stale.length} stale, ${expiringSoon.length} expiring within ${EXPIRY_WARNING_DAYS}d, ${page.error ? 'page parity UNCHECKED' : parityDiffs.length + ' page-parity difference(s)'} (threshold ${STALE_THRESHOLD_DAYS}d)`);
  process.exit(0);
}

if (page.error || parityDiffs.length) {
  console.error(`✗ deadline-wall page-parity check FAILED — deadline-wall.html's REG_DEADLINES copy does not match data/reg-deadlines.json:`);
  if (page.error) console.error(`  • ${page.error}`);
  for (const d of parityDiffs) console.error(`  • ${d}`);
  console.error('\nFix: apply the same change to BOTH copies — data/reg-deadlines.json and the REG_DEADLINES block in deadline-wall.html.');
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
}

// Both failures are reported before either exits, so one run tells you everything that is wrong.
if (stale.length || page.error || parityDiffs.length) process.exit(1);

console.log(`✓ deadline-freshness gate clean — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, all verified within ${STALE_THRESHOLD_DAYS} days; deadline-wall.html's copy matches the JSON entry for entry.`);
