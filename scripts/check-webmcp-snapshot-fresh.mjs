#!/usr/bin/env node
/**
 * scripts/check-webmcp-snapshot-fresh.mjs: WEBMCP-SIGNED-EXPIRY-1 freshness gate.
 *
 * The signed snapshot (.well-known/webmcp-signed.json) now carries `expires`
 * (generated_at + 30 days). This gate fails on MAIN (and merge_group) when the
 * published snapshot sits inside the 7-day renewal window — or is already expired —
 * so the expiry cannot lapse silently. On pull_request it is ADVISORY (::warning,
 * exit 0): the branch cannot re-sign, because the signing key never leaves the
 * key-holding desk and is never on CI (derived-artifacts.mjs EXCLUDED entry; the
 * single writer is scripts/sign-webmcp-snapshot.mjs run locally, committed by a
 * signing row). The context split is isMainContext() — the same whitelist-of-PR-proofs
 * oracle the other derived-artifact gates use, so merge_group with an assembled
 * DERIVED_ROOT is HARD exactly like push:main.
 *
 * NOT this gate's job: signature verification (check-webmcp-signed-snapshot.mjs
 * REDs a bad signature, a malformed snapshot, an expired one, and a rolled-back
 * version — that gate is blocking in every context).
 *
 * Legacy tolerance: a snapshot without `expires` predates WEBMCP-SIGNED-EXPIRY-1;
 * it has no expiry to lapse, so this gate reports and exits 0 in every context
 * until the next local re-sign arms it. Absent snapshot: "nothing published to go
 * stale", exit 0 (same posture as the verifier's absent-is-advisory rule).
 *
 * Usage:
 *   node scripts/check-webmcp-snapshot-fresh.mjs              # freshness gate
 *   node scripts/check-webmcp-snapshot-fresh.mjs --self-test  # pure-disposition fixture proof
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainContext } from './derived-artifacts.mjs';
import { SNAPSHOT_REL, SNAPSHOT_RENEW_WINDOW_DAYS } from './lib/webmcp-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SNAP_PATH = resolve(REPO, SNAPSHOT_REL);
const DAY_MS = 86400000;

function red(msg) {
  console.error(`✗ webmcp snapshot freshness: ${msg}`);
  process.exit(1);
}

/**
 * Pure disposition of a parsed snapshot at time `now`:
 *   'absent' | 'malformed' | 'legacy' | 'ok' | 'renew' | 'expired'
 * (absent is handled by the caller before parsing; kept here so the self-test
 * exercises the whole vocabulary).
 */
export function freshnessDisposition(snap, now = Date.now()) {
  if (snap === null || snap === undefined) return 'absent';
  if (typeof snap !== 'object' || Array.isArray(snap)) return 'malformed';
  if (typeof snap.expires !== 'string') return 'legacy'; // pre-expiry snapshot: nothing to lapse yet
  const exp = Date.parse(snap.expires);
  if (Number.isNaN(exp)) return 'malformed';
  const daysLeft = (exp - now) / DAY_MS;
  if (daysLeft <= 0) return 'expired';
  if (daysLeft < SNAPSHOT_RENEW_WINDOW_DAYS) return 'renew';
  return 'ok';
}

/** Exit-code mapping: HARD only on a main/merge_group context, and only when the
 *  snapshot is inside the renewal window or already expired. */
export function gateShouldFail(disposition, mainCtx) {
  return mainCtx === true && (disposition === 'renew' || disposition === 'expired');
}

// ── --self-test: pure fixtures, no file or key IO ──
if (process.argv.slice(2).includes('--self-test')) {
  const now = Date.now();
  const iso = (offsetDays) => new Date(now + offsetDays * DAY_MS).toISOString();
  const cases = [
    ['absent snapshot', null, 'absent'],
    ['non-object snapshot', 'nope', 'malformed'],
    ['legacy snapshot (no expires)', { generated_at: iso(-40), tools: [] }, 'legacy'],
    ['malformed expires', { expires: 'not-a-time' }, 'malformed'],
    ['fresh snapshot (+30d)', { expires: iso(30) }, 'ok'],
    ['exactly at the window edge (+7d)', { expires: iso(7) }, 'ok'],
    ['inside the renewal window (+6d)', { expires: iso(6) }, 'renew'],
    ['expired (-1d)', { expires: iso(-1) }, 'expired'],
  ];
  let bad = 0;
  for (const [label, snap, want] of cases) {
    const got = freshnessDisposition(snap, now);
    if (got !== want) { console.error(`✗ self-test: ${label} → ${got}, want ${want}`); bad++; }
  }
  // Exit mapping: renew/expired fail ONLY on main; ok/legacy/malformed never fail here
  // (malformed JSON is the verifier's RED, not a staleness question).
  for (const d of ['absent', 'malformed', 'legacy', 'ok'])
    if (gateShouldFail(d, true)) { console.error(`✗ self-test: ${d} must never fail the freshness gate`); bad++; }
  for (const d of ['renew', 'expired'])
    if (gateShouldFail(d, false)) { console.error(`✗ self-test: ${d} must be advisory off main`); bad++; }
  for (const d of ['renew', 'expired'])
    if (!gateShouldFail(d, true)) { console.error(`✗ self-test: ${d} must be HARD on main`); bad++; }
  if (bad) process.exit(1);
  console.log(`✓ freshness self-test GREEN: ${cases.length} dispositions + exit mapping as specified`);
  process.exit(0);
}

// ── normal run ──
if (!existsSync(SNAP_PATH)) {
  console.log(`○ webmcp snapshot freshness: absent (${SNAPSHOT_REL} not yet signed; nothing published to go stale)`);
  process.exit(0);
}
let snap;
try { snap = JSON.parse(readFileSync(SNAP_PATH, 'utf8')); }
catch (e) { red(`${SNAPSHOT_REL} is not valid JSON (${e.message}) — check-webmcp-signed-snapshot.mjs owns this RED; failing closed here too`); }

const d = freshnessDisposition(snap);
if (d === 'malformed') red(`snapshot carries a malformed expires (${JSON.stringify(snap.expires)})`);
if (d === 'legacy') {
  console.log('○ webmcp snapshot freshness: pre-expiry snapshot (signed before WEBMCP-SIGNED-EXPIRY-1); no expiry to lapse — the next local re-sign arms this gate');
  process.exit(0);
}
const daysLeft = Math.floor((Date.parse(snap.expires) - Date.now()) / DAY_MS);
if (d === 'ok') {
  console.log(`✓ webmcp snapshot freshness: ${daysLeft} day(s) to expiry (${snap.expires}; renewal window opens at ${SNAPSHOT_RENEW_WINDOW_DAYS} days)`);
  process.exit(0);
}
const msg = d === 'expired'
  ? `snapshot EXPIRED at ${snap.expires} — re-sign now: node scripts/sign-webmcp-snapshot.mjs`
  : `snapshot expires in ${daysLeft} day(s) (${snap.expires}) — inside the ${SNAPSHOT_RENEW_WINDOW_DAYS}-day renewal window; re-sign: node scripts/sign-webmcp-snapshot.mjs`;
if (!isMainContext()) {
  console.error(`::warning title=Advisory: webmcp snapshot freshness::${msg} (advisory on a PR: the branch cannot re-sign — the key never leaves the key-holding desk)`);
  process.exit(0);
}
red(`${msg}`);
