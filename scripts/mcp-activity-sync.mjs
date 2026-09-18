#!/usr/bin/env node
// scripts/mcp-activity-sync.mjs — merge Cloudflare Analytics Engine daily MCP
// tool-call counts into data/mcp-activity.json (append-only history).
//
// Data source: Workers Analytics Engine dataset `mcp_tool_calls`, written
// best-effort by mcp-apps-poc/worker.mjs for every tools/call (blobs:
// [toolName, asn, ok|error, 'ainumbers-mcp'], doubles: [latencyMs, chainDepth]).
// initialize handshakes are excluded here: the chart shows tool activity.
//
// ⛔ MANUAL, OPERATOR-RUN, NEVER SCHEDULED. No workflow invokes this script and
// none ever should: a main-side writer of the homepage was excluded on SO #35
// (single-writer derived artifacts) and the drafted mcp-activity-stats.yml is
// RETIRED by decision, not deferred (MCP-ACTIVITY-EMBED-GEN-1, 2026-09-17).
// This script writes ONLY data/mcp-activity.json. It never touches index.html:
// the sentinel embed belongs to the regen (COVERED id `mcp-activity-embed`,
// scripts/mcp-activity-embed.mjs), which runs on main after merge.
//
// Operator runbook (three steps, weekly or on demand):
//   1. node ./scripts/mcp-activity-sync.mjs --since-days 120   (on the Omen)
//   2. commit data/mcp-activity.json ONLY, ordinary PR, label per the usual path
//   3. main's regen re-embeds the sentinel; the panel updates on the next deploy
// The sentinel's `generated` date states staleness on the page, so a skipped
// week is visible rather than silent.
//
// Auth: read from the OPERATOR'S OWN ENV, never a repo secret and never a CI
// secret — CLOUDFLARE_ACCOUNT_ID (exists) + CLOUDFLARE_ANALYTICS_TOKEN (created
// by Tim with Analytics read). Without either, the script prints a notice and
// exits 0, leaving the committed history untouched: stale-but-dated beats a
// half-written file.
//
// Aggregates only: day / calls / errors. No tool names, no ASNs, no per-caller
// anything ever enters the committed history (see the dataset blobs above).
//
// Merge rules: keyed by date; same-date rows overwritten (re-runs converge);
// nothing ever deleted; sorted ascending; capped at 540 most-recent days;
// `generated` = today (UTC); `backfilled_through` = newest day present.
// Zero-dep: node: builtins only.
//
// Usage: node scripts/mcp-activity-sync.mjs [--since-days N]  (default 120)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = join(ROOT, 'data', 'mcp-activity.json');
const MAX_DAYS = 540;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function loadHistory() {
  const raw = JSON.parse(readFileSync(DATA, 'utf8'));
  if (!Array.isArray(raw.days)) throw new Error('mcp-activity.json: days is not an array');
  return raw;
}

// The Analytics Engine SQL API shape has drifted before; accept the documented
// {data:[...]} envelope plus {result:[...]} / bare-array fallbacks, rows as
// objects ({day, calls, errors}) or arrays ([day, calls, errors]).
function normalizeRows(payload) {
  const arr = Array.isArray(payload)
    ? payload
    : payload && (Array.isArray(payload.data) ? payload.data
      : Array.isArray(payload.result) ? payload.result : null);
  if (!arr) throw new Error('unrecognized analytics response envelope');
  const out = [];
  for (const r of arr) {
    const day = Array.isArray(r) ? r[0] : (r.day || r.date || r.d);
    const calls = Array.isArray(r) ? r[1] : (r.calls ?? r.count ?? r.c);
    const errors = Array.isArray(r) ? (r[2] || 0) : (r.errors ?? 0);
    if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(+calls)) {
      out.push([day, Math.max(0, Math.round(+calls)), Math.max(0, Math.round(+errors) || 0)]);
    }
  }
  return out;
}

async function fetchDaily(account, token, sinceDays) {
  const query = `SELECT toDate(timestamp) AS day, count() AS calls, ` +
    `countIf(blob3 = 'error') AS errors FROM mcp_tool_calls ` +
    `WHERE timestamp > now() - INTERVAL '${sinceDays}' DAY AND blob1 != 'initialize' ` +
    `GROUP BY day ORDER BY day`;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  );
  if (!res.ok) throw new Error(`analytics API HTTP ${res.status}`);
  const body = await res.json();
  if (body && body.success === false) {
    const msg = (body.errors || []).map((e) => e.message || JSON.stringify(e)).join('; ');
    throw new Error(`analytics API error: ${msg || 'unknown'}`);
  }
  return normalizeRows(body);
}

function main(argv) {
  const sinceIdx = argv.indexOf('--since-days');
  const sinceDays = sinceIdx !== -1 ? Math.max(1, parseInt(argv[sinceIdx + 1], 10) || 120) : 120;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  const hist = loadHistory();
  if (!account || !token) {
    console.log('mcp-activity-sync: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_ANALYTICS_TOKEN unset — leaving history untouched.');
    return 0;
  }
  return fetchDaily(account, token, sinceDays).then((rows) => {
    const byDay = new Map(hist.days.map((d) => [d[0], d]));
    for (const r of rows) byDay.set(r[0], r);
    hist.days = [...byDay.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-MAX_DAYS);
    hist.generated = todayUTC();
    hist.backfilled_through = hist.days.length ? hist.days[hist.days.length - 1][0] : hist.backfilled_through;
    writeFileSync(DATA, JSON.stringify(hist, null, 2) + '\n');
    console.log(`mcp-activity-sync: merged ${rows.length} fetched day(s), history now ${hist.days.length} day(s), generated ${hist.generated}.`);
    return 0;
  }).catch((e) => {
    // Never fail the workflow on a stats-fetch problem: stale-but-dated beats red.
    console.log(`mcp-activity-sync: fetch skipped (${e.message}) — leaving history untouched.`);
    return 0;
  });
}

const code = await Promise.resolve(main(process.argv.slice(2))).catch((e) => {
  console.log(`mcp-activity-sync: fetch skipped (${e.message}) — leaving history untouched.`);
  return 0;
});
process.exit(code);
