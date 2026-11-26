#!/usr/bin/env node
// vintage-horizon.mjs: the scheduled horizon report (VINTAGE-HORIZON-1).
//
// Reads the vintage table (data/vintages.json) and a clock value, and lists every
// fact that is about to go stale with no successor entered:
//   - EXPIRING:  the latest vintage's effective_to is within 90 days of the clock
//   - OVERDUE:   the latest vintage's successor_expected_by has arrived
// A fact with a later vintage already entered is never listed. A vintage with a
// null effective_to and a null successor_expected_by has no scheduled end and is
// ignored.
//
// No network: the table and the clock are the only inputs. It does not fetch a
// regulator's site and it does not decide whether a kernel should support a new
// year. It reports that a value is missing.
//
// Usage:
//   node scripts/vintage-horizon.mjs [--now YYYY-MM-DD] [--table <path>] [--json]
//                                    [--github-output <path>]
// Exit: 0 clean, 1 at least one fact listed, 2 table unreadable or malformed
// (absence of the table is never a green).

import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HORIZON_DAYS = 90;
const DAY_MS = 86400000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toMs = (d) => Date.parse(d + 'T00:00:00Z');

function checkDate(label, v, { nullable }) {
  if (v === null || v === undefined) {
    if (nullable) return null;
    throw new Error(label + ' is required');
  }
  if (typeof v !== 'string' || !ISO_DATE.test(v) || Number.isNaN(toMs(v))) {
    throw new Error(label + ' must be YYYY-MM-DD, got ' + JSON.stringify(v));
  }
  return v;
}

// Pure core: (table object, clock string) -> findings. Throws on a malformed table.
export function horizonReport(table, now) {
  checkDate('--now', now, { nullable: false });
  if (!table || !Array.isArray(table.vintages)) {
    throw new Error('table carries no "vintages" array');
  }
  const byFact = new Map();
  table.vintages.forEach((v, i) => {
    const where = 'vintages[' + i + ']';
    if (!v || typeof v.fact !== 'string' || !v.fact) throw new Error(where + '.fact is required');
    const rec = {
      fact: v.fact,
      vintage: String(v.vintage),
      effective_from: checkDate(where + '.effective_from', v.effective_from, { nullable: false }),
      effective_to: checkDate(where + '.effective_to', v.effective_to, { nullable: true }),
      successor_expected_by: checkDate(where + '.successor_expected_by', v.successor_expected_by, { nullable: true }),
    };
    if (!byFact.has(rec.fact)) byFact.set(rec.fact, []);
    byFact.get(rec.fact).push(rec);
  });

  const nowMs = toMs(now);
  const findings = [];
  for (const [fact, list] of [...byFact].sort((a, b) => a[0].localeCompare(b[0]))) {
    // The latest vintage is the one that starts last; a later entry for the same
    // vintage (a correction) shares its dates and does not change the verdict.
    const latest = list.reduce((a, b) => (toMs(b.effective_from) >= toMs(a.effective_from) ? b : a));
    const reasons = [];
    if (latest.effective_to !== null) {
      const daysLeft = Math.round((toMs(latest.effective_to) - nowMs) / DAY_MS);
      if (daysLeft <= HORIZON_DAYS) {
        reasons.push({
          kind: 'EXPIRING',
          detail: daysLeft < 0
            ? 'vintage ' + latest.vintage + ' ended ' + latest.effective_to + ' (' + (-daysLeft) + ' days ago)'
            : 'vintage ' + latest.vintage + ' ends ' + latest.effective_to + ' (' + daysLeft + ' days left)',
        });
      }
    }
    if (latest.successor_expected_by !== null && toMs(latest.successor_expected_by) <= nowMs) {
      reasons.push({
        kind: 'OVERDUE',
        detail: 'successor was expected by ' + latest.successor_expected_by + ' and none is entered',
      });
    }
    if (reasons.length) {
      findings.push({
        fact,
        latest_vintage: latest.vintage,
        effective_to: latest.effective_to,
        successor_expected_by: latest.successor_expected_by,
        reasons,
      });
    }
  }
  return { now, horizon_days: HORIZON_DAYS, facts: byFact.size, findings };
}

export function formatReport(rep) {
  const lines = [];
  lines.push('Vintage horizon as of ' + rep.now + ': ' + rep.findings.length + ' of ' + rep.facts + ' fact(s) need a successor vintage.');
  for (const f of rep.findings) {
    lines.push('- ' + f.fact + ' (latest vintage ' + f.latest_vintage + '): ' + f.reasons.map((r) => r.kind + ', ' + r.detail).join('; '));
  }
  if (rep.findings.length) {
    lines.push('');
    lines.push('Enter the next vintage in data/vintages.json from a pinned source. A new year never edits a sealed kernel through this report.');
  }
  return lines.join('\n');
}

function opt(argv, name) {
  const i = argv.indexOf('--' + name);
  return i === -1 ? undefined : argv[i + 1];
}

function main(argv) {
  const here = dirname(fileURLToPath(import.meta.url));
  const tablePath = resolve(opt(argv, 'table') || resolve(here, '..', 'data', 'vintages.json'));
  const now = opt(argv, 'now') || new Date().toISOString().slice(0, 10);
  let rep;
  try {
    rep = horizonReport(JSON.parse(readFileSync(tablePath, 'utf8')), now);
  } catch (e) {
    console.error('vintage-horizon: cannot read ' + tablePath + ': ' + e.message);
    return 2;
  }
  console.log(argv.includes('--json') ? JSON.stringify(rep, null, 2) : formatReport(rep));
  const out = opt(argv, 'github-output');
  if (out) {
    const first = rep.findings.length
      ? rep.findings.length + ' fact(s) with no successor vintage: ' + rep.findings.map((f) => f.fact).slice(0, 5).join(', ') + (rep.findings.length > 5 ? ', ...' : '')
      : 'none';
    appendFileSync(out, 'state=' + (rep.findings.length ? 'red' : 'green') + '\nfailure_line=' + first + '\n');
  }
  return rep.findings.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
