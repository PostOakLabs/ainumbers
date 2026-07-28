#!/usr/bin/env node
// check-standards-drift.mjs — standards drift watcher (STDWATCH-1, OKF-V02-STANDARDS-WATCH-BUILD-SPEC.md §5).
//
// WHY: pinning a standard closes BREAKAGE risk but hides AWARENESS risk — we stay
// correct against a frozen target while the world moves on (§5.0). This script
// re-fetches each watched standard's bytes, compares against the recorded
// `pinned_digest`, and on drift opens a GitHub issue naming old/new digest so a
// human makes the adopt/ignore call. It never fixes anything itself.
//
// Invariants (§5.3 — the reason this stays zero-cost, never re-litigate):
//   1. NEVER a deploy gate. Runs only from the weekly standards-watch.yml cron.
//   2. Network failure / 404 / 5xx → log and exit 0. Never red on upstream flakiness.
//   3. On drift → open one GitHub issue per drifted entry, exit 0. NEVER auto-bump
//      pinned_digest — the pin exists so a human reads the diff.
//   4. No `verified_on` re-stamp field, no re-run duty. Drift is derived from
//      upstream bytes; silence means nothing moved (SO #0 discharge for this row).
//
// Zero-dependency: node: builtins + global fetch only (site repo is zero-dep).
//
// Usage:
//   node scripts/check-standards-drift.mjs             fetch, diff, open issues on drift
//   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo  →  required only to open issues;
//     missing/absent → drift is still logged to stdout, issue-open step is skipped.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DATA_PATH = resolve(REPO, 'data/standards-watch.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // "owner/repo", set by Actions

async function fetchDigest(url) {
  const res = await fetch(url);
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  return { ok: true, digest };
}

async function openDriftIssue(entry, newDigest) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.log(`  (no GITHUB_TOKEN/GITHUB_REPOSITORY — skipping issue-open for "${entry.name}")`);
    return;
  }
  const title = `Standards drift: ${entry.name} moved under our pin`;
  const body = [
    `**Standard:** ${entry.name}`,
    `**URL:** ${entry.url}`,
    `**Adopted version:** ${entry.adopted_version}`,
    '',
    `**Old (pinned) digest:** \`${entry.pinned_digest}\``,
    `**New (fetched) digest:** \`${newDigest}\``,
    '',
    'The pin was left untouched — this issue only reports drift. A human reads the diff',
    'and decides whether to adopt the new bytes (update `pinned_digest` and, if the',
    'adopted version changed, `adopted_version`) or leave the pin as-is.',
    '',
    `_Opened automatically by \`scripts/check-standards-drift.mjs\` from the weekly cron._`,
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'standards-watch',
    },
    body: JSON.stringify({ title, body, labels: ['standards-drift'] }),
  });
  if (!res.ok) {
    console.log(`  ✗ failed to open issue for "${entry.name}": HTTP ${res.status}`);
    return;
  }
  const json = await res.json();
  console.log(`  ✓ opened issue #${json.number} for "${entry.name}"`);
}

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const entries = data.entries ?? [];

let drifted = 0;
let skipped = 0;

for (const entry of entries) {
  console.log(`checking "${entry.name}" — ${entry.url}`);
  let result;
  try {
    result = await fetchDigest(entry.url);
  } catch (err) {
    result = { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  if (!result.ok) {
    console.log(`  (network failure: ${result.reason} — skipping, not a failure)`);
    skipped++;
    continue;
  }
  if (result.digest === entry.pinned_digest) {
    console.log('  ✓ unchanged');
    continue;
  }
  console.log(`  ⚠ DRIFT — pinned ${entry.pinned_digest}, now ${result.digest}`);
  drifted++;
  await openDriftIssue(entry, result.digest);
}

console.log(`\nstandards-drift — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, ${drifted} drifted, ${skipped} skipped (network)`);
// Invariant #2: never fail this job on drift or on upstream flakiness — exit
// naturally (no process.exit(1) path exists in this script) rather than
// forcing process.exit(0), which races undici's fetch dispatcher teardown.
