#!/usr/bin/env node
// scripts/mcp-activity-sync.mjs — merge Cloudflare Worker invocations into
// data/mcp-activity.json (append-only history).
//
// ⛔ SERIES SEMANTICS CHANGED 2026-09-21 (Tim, after the dashboard check): the
// chart now counts WORKER INVOCATIONS — every request the ainumbers-mcp worker
// served — not Analytics Engine tool calls. Why: the AE tools/call stream is a
// best-effort sampled write capturing roughly 1 in 4.4 of served requests
// (parallel-session dashboard verification 2026-09-19/20: archive within 2.5%
// of the dashboard's 142.46k/30d; the residual was window edges, and the AE
// stream was the series that moved). Worker invocations is the census.
//
// Data source: Cloudflare GraphQL workersInvocationsAdaptive, one query per
// day in the window, filtered to scriptName = 'ainumbers-mcp' (the worker
// behind mcp.ainumbers.co). SUM(requests) is the day's invocation count;
// SUM(errors) rides along. ⚠ INCLUDES handshakes and crawler traffic: this is
// endpoint workload, not per-tool work — the page label says invocations for
// exactly that reason. Per-tool granularity stays in the nightly archive
// (ainumbers-internal/analytics/mcp-tools-daily.jsonl) for the rankings page.
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
// secret — CLOUDFLARE_ACCOUNT_ID (exists) + CLOUDFLARE_ANALYTICS_TOKEN
// (Account > Account Analytics:Read — the same permission the nightly
// archiver's workersInvocationsAdaptive query uses). Without either, the
// script prints a notice and exits 0, leaving the committed history untouched:
// stale-but-dated beats a half-written file.
//
// Retention: workersInvocationsAdaptive keeps roughly 30 days, so
// --since-days values beyond ~30 return only what retention holds. Days with
// no returned rows are skipped, never fabricated as zeros.
//
// Aggregates only: day / invocations / errors. No tool names, no ASNs, no
// per-caller anything ever enters the committed history.
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
const WORKER = 'ainumbers-mcp';
const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function loadHistory() {
  const raw = JSON.parse(readFileSync(DATA, 'utf8'));
  if (!Array.isArray(raw.days)) throw new Error('mcp-activity.json: days is not an array');
  return raw;
}

// GraphQL workersInvocationsAdaptive for one UTC day. Query shape is the
// nightly archiver's own (ainumbers-internal/scripts/cf_stats_pull.py
// WORKERS_Q) — proven against this dataset — with the worker filter applied
// client-side. Returns { calls, errors } for the worker, or null when the day
// has no rows (outside retention, or the worker did not run).
async function invocationsForDay(account, token, day) {
  const query = `query($account: String!, $start: Time!, $end: Time!) {
    viewer { accounts(filter: {accountTag: $account}) {
      workersInvocationsAdaptive(limit: 200, filter: {datetime_geq: $start, datetime_leq: $end}) {
        sum { requests errors }
        dimensions { scriptName }
      }
    } }
  }`;
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { account, start: `${day}T00:00:00Z`, end: `${day}T23:59:59Z` },
    }),
  });
  if (!res.ok) throw new Error(`graphql API HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors && body.errors.length) {
    const msg = body.errors.map((e) => e.message || JSON.stringify(e)).join('; ');
    throw new Error(`graphql API error: ${msg}`);
  }
  const groups = body?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  let calls = 0;
  let errors = 0;
  let seen = false;
  for (const g of groups) {
    if (g?.dimensions?.scriptName !== WORKER) continue;
    seen = true;
    calls += g.sum.requests || 0;
    errors += g.sum.errors || 0;
  }
  return seen ? { calls, errors } : null;
}

function main(argv) {
  const sinceIdx = argv.indexOf('--since-days');
  const sinceDays = sinceIdx !== -1 ? Math.max(1, parseInt(argv[sinceIdx + 1], 10) || 120) : 120;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  const hist = loadHistory();

  // --from-archive <file.jsonl> (2026-09-21, Tim's ruling: worker invocations, from the archive).
  // The operator's own nightly archiver already records this exact series, one JSON line per
  // worker per day: {"date","requests","errors","subrequests","zone"}. It reaches back past the
  // ~30-day GraphQL retention, so it is the ONLY source for the full history, and it needs no
  // token on the operator's machine. Only three aggregate fields of ONE worker's rows ever leave
  // that file: date, requests, errors. Same merge rules as the live path (keyed by date, re-runs
  // converge, nothing deleted). A malformed line is skipped and counted, never guessed at.
  const archIdx = argv.indexOf('--from-archive');
  if (archIdx !== -1) {
    const file = argv[archIdx + 1];
    if (!file) { console.log('mcp-activity-sync: --from-archive needs a file path — leaving history untouched.'); return 0; }
    const byDay = new Map(hist.days.map((d) => [d[0], d]));
    let merged = 0, bad = 0;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { bad++; continue; }
      if (r.zone !== 'ainumbers-mcp') continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(+r.requests)) { bad++; continue; }
      byDay.set(r.date, [r.date, Math.max(0, Math.round(+r.requests)), Math.max(0, Math.round(+r.errors) || 0)]);
      merged++;
    }
    if (!merged) { console.log(`mcp-activity-sync: archive held no ainumbers-mcp rows (${bad} malformed) — leaving history untouched.`); return 0; }
    hist.days = [...byDay.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-MAX_DAYS);
    hist.generated = todayUTC();
    hist.backfilled_through = hist.days[hist.days.length - 1][0];
    hist._note = 'Worker invocations (requests served) for the ainumbers-mcp worker, per day, from the operator\'s nightly Cloudflare analytics archive (same series as the dashboard\'s Worker Invocations). Append-only; same-date rows converge. Includes connection handshakes and crawler traffic: endpoint workload, not per-tool work.';
    writeFileSync(DATA, JSON.stringify(hist, null, 2) + '\n');
    console.log(`mcp-activity-sync: merged ${merged} archive day(s) (${bad} malformed skipped), history now ${hist.days.length} day(s), through ${hist.backfilled_through}.`);
    return 0;
  }

  if (!account || !token) {
    console.log('mcp-activity-sync: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_ANALYTICS_TOKEN unset — leaving history untouched.');
    return 0;
  }
  const end = new Date();
  const days = [];
  for (let i = sinceDays - 1; i >= 0; i--) {
    days.push(new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  const tokenLen = String(token).length;
  console.log(`mcp-activity-sync: pulling worker invocations for ${days.length} day(s) ending ${days[days.length - 1]} (token present, ${tokenLen} chars).`);
  const byDay = new Map(hist.days.map((d) => [d[0], d]));
  let fetched = 0;
  let idx = 0;
  function step() {
    if (idx >= days.length) return Promise.resolve();
    const day = days[idx];
    return invocationsForDay(account, token, day).then((r) => {
      if (r) {
        byDay.set(day, [day, r.calls, r.errors]);
        fetched++;
      } else {
        console.log(`  ${day}: no invocations data — skipped.`);
      }
      idx++;
      return step();
    }).catch((e) => {
      console.log(`  ${day}: query failed (${String(e.message).slice(0, 120)}) — day skipped.`);
      idx++;
      return step();
    });
  }
  return step().then(() => {
    hist.days = [...byDay.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-MAX_DAYS);
    hist.generated = todayUTC();
    hist.backfilled_through = hist.days.length ? hist.days[hist.days.length - 1][0] : hist.backfilled_through;
    hist._note = 'Worker invocations (requests served) for the ainumbers-mcp worker, from the Cloudflare GraphQL workersInvocationsAdaptive dataset. Append-only; same-date rows converge. Includes connection handshakes and crawler traffic — endpoint workload, not per-tool work.';
    writeFileSync(DATA, JSON.stringify(hist, null, 2) + '\n');
    console.log(`mcp-activity-sync: merged ${fetched} day(s) with data, history now ${hist.days.length} day(s), generated ${hist.generated}.`);
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
