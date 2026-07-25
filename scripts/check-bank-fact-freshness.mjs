#!/usr/bin/env node
// check-bank-fact-freshness.mjs — dated-fact freshness gate (REVERIFY-BANK-1).
//
// WHY: art-428 (SEC Item 1.05 rescission-petition status) and art-427 (Fed
// Discount Window margin-table version) each carry a regulatory fact with no
// refresh owner. Per SO #0 (SURVIVES-THE-MAINTAINER), no recurring human duty
// may ship — so instead of a "REVERIFY-BY" comment addressed to a future
// person, each fact lives in data/bank-fact-freshness.json with its own
// verified_on stamp, and this gate derives staleness from that stamp alone
// (same pattern as SI-DEADLINE-FRESH-1's check-deadline-freshness.mjs over
// data/reg-deadlines.json). Deliberately NOT stored on the chaingraph node
// shard itself — that would make an ordinary doc/date-stamp refresh trip the
// CGSHARD-1 shard-freshness gate and force every re-check through a K-lane
// ASSEMBLE-LAND, which is disproportionate for metadata that never touches a
// kernel's policy_parameters/output_payload. Zero-dependency, node: builtins.
//
// Usage:
//   node scripts/check-bank-fact-freshness.mjs             strict (CI): exit 1 on any stale fact
//   node scripts/check-bank-fact-freshness.mjs --summary    counts only, exit 0

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DATA_PATH = resolve(REPO, 'data/bank-fact-freshness.json');

const SUMMARY = process.argv.includes('--summary');

// Same 120-day (quarter + slack) threshold as SI-DEADLINE-FRESH-1, independently
// named here per SO #7 — extending the INPUT SET, never editing the sibling
// gate's constant.
const STALE_THRESHOLD_DAYS = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const entries = data.entries ?? [];

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
  console.log(`bank-fact freshness — ${entries.length} fact(s), ${stale.length} stale (threshold ${STALE_THRESHOLD_DAYS}d)`);
  process.exit(0);
}

if (stale.length) {
  console.error(`✗ bank-fact-freshness gate FAILED — ${stale.length} of ${entries.length} fact(s) in data/bank-fact-freshness.json past the ${STALE_THRESHOLD_DAYS}-day freshness threshold:`);
  for (const s of stale) {
    if (s.reason) {
      console.error(`  • ${s.id} — ${s.reason} (verified_on="${s.verified_on}")`);
    } else {
      console.error(`  • ${s.id} — last verified ${s.verified_on}, ${s.age} days ago (threshold ${STALE_THRESHOLD_DAYS})`);
    }
  }
  console.error('\nFix: re-check the entry against its source_url and update verified_on (and the visible banner text if the underlying fact changed).');
  process.exit(1);
}

console.log(`✓ bank-fact-freshness gate clean — ${entries.length} fact(s), all verified within ${STALE_THRESHOLD_DAYS} days.`);
