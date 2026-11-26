#!/usr/bin/env node
// gen-vintage-calendar.mjs — renders chaingraph/vintage-calendar.html from the
// vintage table (data/vintages.json), VINTAGE-CALENDAR-1.
//
// The page is the public answer to "what changes on 1 January": every fact in
// the table, its current value and unit, the pinned source document with the
// day it was retrieved, the dates the value is in force, and what is known
// about the successor. Source retrieval dates resolve through the clause
// snapshot registry (the same registry the V4 gate checks the table against),
// so the page invents no provenance of its own.
//
// PURE FUNCTION, NO WALL CLOCK. The page carries dates only, never
// clock-relative prose ("overdue", "days left"): which value is stale is the
// scheduled horizon report's answer (scripts/vintage-horizon.mjs), not this
// page's. A page that recomputed "days left" every day would red its own
// freshness gate daily; a pure one is byte-stable between table edits, which
// is what makes --check a usable gate.
//
// Counts render through the count-sentinel mechanism: the hero stat digits are
// data-count / comment sentinels keyed to vintage.facts / vintage.entries /
// vintage.sources, registered in scripts/counts.mjs deriveCounts() so the
// sentinel keys exist in the counts engine and a parity test can pin them.
// The page is deliberately NOT added to verify-counts.mjs's scan list in its
// birth row: a file declared in the 'counts' COVERED entry is classified
// count-sentinel by scripts/check-main-only-paths.mjs, which refuses a PR that
// ADDS such a page. A successor row may move the page under the counts entry
// (scan list + artifacts + writes, one diff) with zero markup churn; until
// then this generator's own --check freshness gate pins every byte, sentinel
// digits included.
//
// Modes:
//   node scripts/gen-vintage-calendar.mjs             # write (no-op if current)
//   node scripts/gen-vintage-calendar.mjs --check     # byte-compare, exit 1 on drift
//   node scripts/gen-vintage-calendar.mjs --self-test # RED+GREEN controls, no writes
//
// Reader-facing copy rules (CONTRACT §1.4): no em-dashes, no build codes, no
// row ids in the rendered page. renderGuard() enforces the mechanical ones at
// render time so a future copy edit cannot ship them.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNav, buildFooter, CHROME_CSS } from '../chaingraph/_page-chrome.mjs';
import { loadRegistryUnion } from '../chaingraph/standard/clause-snapshot-store.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TABLE_REL = join('data', 'vintages.json');
const REGISTRY_REL = join('chaingraph', 'standard', 'clause-snapshot-registry.json');
const OUT_REL = join('chaingraph', 'vintage-calendar.html');
const CHECK = process.argv.includes('--check');
const SELF_TEST = process.argv.includes('--self-test');

// The three hero counts. Kept in one place: the counts engine (scripts/counts.mjs)
// derives the same keys from the same table, and the self-test pins the parity.
export const VINTAGE_COUNT_KEYS = ['vintage.facts', 'vintage.entries', 'vintage.sources'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Comma-grouped integer rendering; a non-integer number falls through to String. */
export function formatValue(v) {
  if (typeof v === 'number' && Number.isInteger(v)) {
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return String(v ?? '');
}

/** Minimal structural validation; throws with the entry index on anything odd. */
export function loadTable(table) {
  if (!table || !Array.isArray(table.vintages)) {
    throw new Error('vintage table carries no "vintages" array');
  }
  table.vintages.forEach((e, i) => {
    const where = `vintages[${i}]`;
    for (const k of ['fact', 'vintage', 'value', 'unit', 'effective_from', 'effective_to', 'source', 'successor_expected_by', 'entered_at']) {
      if (!(k in e)) throw new Error(`${where} is missing "${k}"`);
    }
    if (!e.source || typeof e.source.clause_digest !== 'string') {
      throw new Error(`${where}.source.clause_digest is required`);
    }
  });
  return table;
}

/**
 * The entry whose value is current for each fact: latest effective_from wins,
 * and a later array index wins a tie (a correction entry shares its dates with
 * the entry it corrects and must be the value shown). Same tie rule the
 * horizon report uses, stated there as "the latest vintage is the one that
 * starts last".
 */
export function currentByFact(entries) {
  const byFact = new Map();
  entries.forEach((e, i) => {
    const prev = byFact.get(e.fact);
    if (!prev || Date.parse(e.effective_from) >= Date.parse(prev.entry.effective_from)) {
      byFact.set(e.fact, { entry: e, index: i });
    }
  });
  return byFact;
}

/**
 * digest -> retrieved_at, read from the clause snapshot registry. A table
 * digest with no registry entry is a V4 red by definition; rendering would
 * invent a retrieval date, so it refuses instead.
 */
export function retrievalDates(registryEntries, tableEntries) {
  const byDigest = new Map(registryEntries.map((r) => [r.digest, r.retrieved_at]));
  for (const e of tableEntries) {
    if (!byDigest.has(e.source.clause_digest)) {
      throw new Error(`clause digest ${e.source.clause_digest} (fact ${e.fact}) is not in the clause snapshot registry; refusing to render an unattributed value`);
    }
  }
  return byDigest;
}

/** Mechanical copy guards over the RENDERED page's prose regions, same scope
 *  check-copy-hallmarks.mjs scans: script/style/pre/code and HTML comments are
 *  code or chrome (the canonical CHROME_CSS carries comment dashes of its own),
 *  everything left is reader-facing text. */
export function renderGuard(html) {
  const prose = html
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<(pre|code)>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  if (prose.includes('—')) throw new Error('renderGuard: rendered page carries an em-dash');
  if (/VINTAGE-[A-Z]/.test(prose)) throw new Error('renderGuard: rendered page carries a row id');
  if (/W-\w\b/.test(prose) || /Wave \d/.test(prose)) throw new Error('renderGuard: rendered page carries a build code');
  return html;
}

function factRows(entries, retrieval) {
  const cur = currentByFact(entries);
  const facts = [...cur.keys()].sort((a, b) => a.localeCompare(b));
  return facts.map((fact) => {
    const { entry } = cur.get(fact);
    const retrieved = retrieval.get(entry.source.clause_digest);
    const successor = entry.successor_expected_by === null
      ? 'none scheduled'
      : `next value expected by ${esc(entry.successor_expected_by)}`;
    const inForce = entry.effective_to === null
      ? `from ${esc(entry.effective_from)}, no scheduled end`
      : `from ${esc(entry.effective_from)} through ${esc(entry.effective_to)}`;
    return `
        <tr>
          <td><code>${esc(fact)}</code></td>
          <td>${esc(entry.vintage)}</td>
          <td class="num">${esc(formatValue(entry.value))}</td>
          <td>${esc(entry.unit)}</td>
          <td>${esc(inForce)}</td>
          <td>${esc(entry.source.scheme)}: ${esc(entry.source.id)}, retrieved ${esc(retrieved)}</td>
          <td>${successor}</td>
        </tr>`;
  }).join('');
}

function historyRows(entries, retrieval) {
  const sorted = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.fact.localeCompare(b.e.fact)
      || Date.parse(a.e.effective_from) - Date.parse(b.e.effective_from)
      || a.i - b.i);
  return sorted.map(({ e }) => `
        <tr>
          <td><code>${esc(e.fact)}</code></td>
          <td>${esc(e.vintage)}</td>
          <td class="num">${esc(formatValue(e.value))}</td>
          <td>${esc(e.unit)}</td>
          <td>${esc(e.effective_from)} to ${esc(e.effective_to === null ? 'open' : e.effective_to)}</td>
          <td>${esc(e.source.id)}, retrieved ${esc(retrieval.get(e.source.clause_digest))}</td>
          <td>${esc(e.entered_at)} by ${esc(e.entered_by)}</td>
        </tr>`).join('');
}

export function renderPage(table, registryEntries) {
  const entries = loadTable(table).vintages;
  const retrieval = retrievalDates(registryEntries, entries);
  const facts = currentByFact(entries);
  const sources = new Set(entries.map((e) => e.source.clause_digest));
  const nav = buildNav('Vintage Calendar');
  const footer = buildFooter({ root: '../', cg: '' });

  const counts = vintageCounts(entries);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Vintage Calendar | AINumbers.co</title>
<meta name="description" content="Every dated fact in the vintage table: its current value and unit, the pinned source with the day it was retrieved, the dates the value is in force, and what is known about the successor. A data reference, not legal advice.">
<meta name="robots" content="index, follow">
<meta name="author" content="AINumbers.co">
<meta name="ain:category" content="learn">
<link rel="canonical" href="https://ainumbers.co/chaingraph/vintage-calendar.html">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Vintage Calendar | AINumbers.co">
<meta property="og:description" content="Every dated fact in the vintage table: its current value, its pinned source, the day it stops being true, and what is known about the successor.">
<meta property="og:url" content="https://ainumbers.co/chaingraph/vintage-calendar.html">
<meta property="og:site_name" content="AINumbers.co">

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">

<style>
:root {
  --bg: #080E1A; --bg-2: #0D1627; --bg-3: #111E35;
  --border: #1E2F4A; --muted: #3A5270; --body: #6888A8;
  --text: #A8C4DE; --bright: #D4E8F8; --white: #EEF6FD;
  --teal: #14B8A6; --teal-lt: #2DD4BF; --gold: #D4A847; --amber: #E0A83D;
  --radius: 6px; --radius-lg: 10px;
}
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:'Sora',sans-serif; font-size:.9rem; line-height:1.7; min-height:100vh; }
h1,h2 { font-family:'DM Serif Display',serif; font-weight:400; line-height:1.2; }
a { color:inherit; text-decoration:none; }
code { font-family:'JetBrains Mono',monospace; font-size:.85em; color:var(--teal-lt); }
.container { max-width:1000px; margin:0 auto; padding:0 2rem; }
.hero { padding:4rem 0 2.5rem; border-bottom:1px solid var(--border); }
.hero-eyebrow { display:flex; align-items:center; gap:.6rem; margin-bottom:1rem; font-family:'JetBrains Mono',monospace; font-size:.57rem; letter-spacing:.22em; text-transform:uppercase; color:var(--teal-lt); }
.hero-eyebrow::before { content:''; display:block; width:28px; height:1px; background:var(--teal); }
.hero h1 { font-size:clamp(2rem,4vw,2.6rem); color:var(--white); margin-bottom:.85rem; }
.hero-sub { font-size:.93rem; color:var(--body); max-width:760px; line-height:1.85; }
.hero-note { margin-top:1.2rem; font-size:.85rem; color:var(--text); background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1rem 1.3rem; max-width:760px; }
.stat-row { display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:1.5rem; }
.stat-tile { background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1rem 1.3rem; min-width:140px; }
.stat-num { font-family:'JetBrains Mono',monospace; font-size:1.5rem; color:var(--bright); }
.stat-label { font-size:.68rem; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-top:.25rem; }
.cal-section { padding:2.5rem 2rem; max-width:1100px; margin:0 auto; }
.cal-section + .cal-section { border-top:1px solid var(--border); }
.cal-section h2 { font-size:1.4rem; color:var(--white); margin-bottom:.5rem; }
.cal-section-note { font-size:.85rem; color:var(--body); margin-bottom:1.5rem; max-width:780px; }
.cal-table { width:100%; border-collapse:collapse; background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; font-size:.8rem; }
.cal-table th { text-align:left; padding:.65rem .9rem; background:var(--bg-3); color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:.6rem; letter-spacing:.08em; text-transform:uppercase; border-bottom:1px solid var(--border); }
.cal-table td { padding:.65rem .9rem; border-bottom:1px solid var(--border); color:var(--text); vertical-align:top; }
.cal-table tr:last-child td { border-bottom:none; }
.cal-table td.num { font-family:'JetBrains Mono',monospace; color:var(--bright); white-space:nowrap; }
.cal-footnote { font-family:'JetBrains Mono',monospace; font-size:.6rem; color:var(--muted); margin-top:1rem; padding-top:1.5rem; border-top:1px solid var(--border); }
</style>
<style>
${CHROME_CSS}
</style>
</head>
<body>

${nav}

<main>
  <header class="hero" role="banner">
    <div class="container">
      <p class="hero-eyebrow">Vintage table / dated values with pinned sources</p>
      <h1>The vintage calendar.</h1>
      <p class="hero-sub">Many numbers behind the tools on this site are true for one year: wage bases, thresholds indexed each January, limits a regulator republishes. The vintage table gives each of them one dated entry with a pinned source document. This page is generated from that table: every fact, its current value and unit, the source with the day it was retrieved, the dates the value is in force, and what is known about the successor. A scheduled horizon check lists any fact whose next value is overdue, so the table ages loudly rather than silently.</p>
      <p class="hero-note">This page is a data reference, not legal advice: every value cites its source and its retrieval date, and the source document governs.</p>
      <div class="stat-row">
        <div class="stat-tile"><div class="stat-num" data-count="vintage.facts"><!--COUNT:vintage.facts-->${counts['vintage.facts']}<!--/COUNT--></div><div class="stat-label">facts tracked</div></div>
        <div class="stat-tile"><div class="stat-num" data-count="vintage.entries"><!--COUNT:vintage.entries-->${counts['vintage.entries']}<!--/COUNT--></div><div class="stat-label">dated entries</div></div>
        <div class="stat-tile"><div class="stat-num" data-count="vintage.sources"><!--COUNT:vintage.sources-->${counts['vintage.sources']}<!--/COUNT--></div><div class="stat-label">pinned sources</div></div>
      </div>
    </div>
  </header>

  <section class="cal-section" aria-label="Current values">
    <h2>Current values</h2>
    <p class="cal-section-note">One line per fact: the value in force today, where it comes from, and the day it stops being true. When a regulator publishes the next year's value and it is entered in the table, the fact's line here moves to the new vintage and the old value stays in the history below.</p>
    <table class="cal-table">
      <thead><tr><th>fact</th><th>vintage</th><th>value</th><th>unit</th><th>in force</th><th>source (retrieved)</th><th>successor</th></tr></thead>
      <tbody>${factRows(entries, retrieval)}
      </tbody>
    </table>
  </section>

  <section class="cal-section" aria-label="Vintage history">
    <h2>Every entered vintage</h2>
    <p class="cal-section-note">The full table, oldest values included. A value stays listed after it expires: the calendar is a record of what was true and when, so a computation that pinned last year's wage base can still be checked against the vintage it used.</p>
    <table class="cal-table">
      <thead><tr><th>fact</th><th>vintage</th><th>value</th><th>unit</th><th>in force</th><th>source (retrieved)</th><th>entered</th></tr></thead>
      <tbody>${historyRows(entries, retrieval)}
      </tbody>
    </table>
  </section>

  <div class="container">
    <p class="cal-footnote">Generated from data/vintages.json by scripts/gen-vintage-calendar.mjs; retrieval dates resolve through chaingraph/standard/clause-snapshot-registry.json. Which facts are about to go stale is reported by scripts/vintage-horizon.mjs on a schedule. This page is not legal advice.</p>
  </div>
</main>

${footer}

</body>
</html>
`;
  return renderGuard(html);
}

/** The three hero counts, defined once for the page and the counts engine. */
export function vintageCounts(entries) {
  return {
    'vintage.facts': currentByFact(entries).size,
    'vintage.entries': entries.length,
    'vintage.sources': new Set(entries.map((e) => e.source.clause_digest)).size,
  };
}

function main() {
  const table = JSON.parse(readFileSync(resolve(ROOT, TABLE_REL), 'utf8'));
  // Legacy file + per-digest shards: new pins land only as shards (pin-clause-snapshot.mjs).
  const registryEntries = loadRegistryUnion(resolve(ROOT, REGISTRY_REL));
  const html = renderPage(table, registryEntries);
  const outPath = resolve(ROOT, OUT_REL);
  if (CHECK) {
    const current = readFileSync(outPath, 'utf8');
    if (current !== html) {
      console.error('gen-vintage-calendar --check: vintage-calendar.html is stale, run `node scripts/gen-vintage-calendar.mjs`');
      process.exit(1);
    }
    console.log('gen-vintage-calendar --check: OK, vintage-calendar.html is fresh.');
    return;
  }
  let current = null;
  try { current = readFileSync(outPath, 'utf8'); } catch { /* missing: write fresh */ }
  if (current === html) {
    console.log('gen-vintage-calendar: chaingraph/vintage-calendar.html already current, left untouched.');
    return;
  }
  writeFileSync(outPath, html);
  console.log('gen-vintage-calendar: wrote chaingraph/vintage-calendar.html');
}

// ── self-test (RED+GREEN controls; runs against synthetic fixtures, no writes) ──

function selfTest() {
  const failures = [];
  const check = (name, ok) => { if (!ok) failures.push(name); };

  // GREEN: count math over a synthetic table (3 entries, 2 facts, 2 sources).
  const synth = {
    vintages: [
      { fact: 'a.b.c', vintage: '2025', value: 1000, unit: 'USD', effective_from: '2025-01-01', effective_to: '2025-12-31', source: { clause_digest: 'sha256:aa', scheme: 's', id: 'S 2025' }, successor_expected_by: '2025-11-01', entered_at: '2026-01-01', entered_by: 't' },
      { fact: 'a.b.c', vintage: '2026', value: 2000, unit: 'USD', effective_from: '2026-01-01', effective_to: '2026-12-31', source: { clause_digest: 'sha256:bb', scheme: 's', id: 'S 2026' }, successor_expected_by: '2026-11-01', entered_at: '2026-01-02', entered_by: 't' },
      { fact: 'd.e.f', vintage: '2026', value: 7, unit: 'pct', effective_from: '2026-01-01', effective_to: null, source: { clause_digest: 'sha256:bb', scheme: 's', id: 'S 2026' }, successor_expected_by: null, entered_at: '2026-01-02', entered_by: 't' },
    ],
  };
  const counts = vintageCounts(synth.vintages);
  check('counts: facts', counts['vintage.facts'] === 2);
  check('counts: entries', counts['vintage.entries'] === 3);
  check('counts: sources', counts['vintage.sources'] === 2);
  // Mutation control for the counts: one more entry with a NEW digest must move sources.
  const mutated = vintageCounts([...synth.vintages, { ...synth.vintages[2], fact: 'g.h.i', source: { clause_digest: 'sha256:cc', scheme: 's', id: 'S' } }]);
  check('counts: mutation moves facts+sources', mutated['vintage.facts'] === 3 && mutated['vintage.sources'] === 3);

  // GREEN: currentByFact picks the latest effective_from; a tie is won by the later entry.
  const cur = currentByFact(synth.vintages);
  check('current: latest vintage wins', cur.get('a.b.c').entry.value === 2000);
  const corrected = currentByFact([
    { ...synth.vintages[1], value: 2000 },
    { ...synth.vintages[1], value: 2222, entered_at: '2026-02-01' },
  ]);
  check('current: correction (same dates, later index) overrides', corrected.get('a.b.c').entry.value === 2222);

  // GREEN: formatValue groups integers and passes non-integers through.
  check('format: 184500 -> 184,500', formatValue(184500) === '184,500');
  check('format: 3.5 unchanged', formatValue(3.5) === '3.5');
  check('format: string unchanged', formatValue('tier A') === 'tier A');

  // RED: retrievalDates refuses a digest the registry does not carry (a V4 red must not render).
  let refused = false;
  try { retrievalDates([{ digest: 'sha256:aa', retrieved_at: '2026-01-01' }], synth.vintages); }
  catch { refused = true; }
  check('RED: missing registry digest refuses', refused);

  // RED: the copy guard fires on an em-dash, a row id and a build code.
  for (const [name, bad] of [
    ['RED: em-dash refused', `<p>bad ${'—'} dash</p>`],
    ['RED: row id refused', '<p>see VINTAGE-CALENDAR-1</p>'],
    ['RED: build code refused', '<p>Wave 3 of the build</p>'],
  ]) {
    let threw = false;
    try { renderGuard(bad); } catch { threw = true; }
    check(name, threw);
  }

  // GREEN: the real page renders byte-stable twice (pure function), carries the
  // canonical chrome, and its sentinel keys are exactly the registered set.
  const table = JSON.parse(readFileSync(resolve(ROOT, TABLE_REL), 'utf8'));
  const registry = loadRegistryUnion(resolve(ROOT, REGISTRY_REL));
  const html1 = renderPage(table, registry);
  const html2 = renderPage(table, registry);
  check('GREEN: render is pure (two passes byte-equal)', html1 === html2);
  check('GREEN: canonical nav present', html1.includes('class="nav-breadcrumb"') && html1.includes('../start.html'));
  check('GREEN: canonical footer present', html1.includes('class="footer-inner"') && html1.includes('class="footer-cols"'));
  check('GREEN: chrome CSS marker present', html1.includes('/* OCG-CHROME-CSS:v1 */'));
  const sentinelKeys = [...html1.matchAll(/<!--COUNT:([^-]+?)-->/g)].map((m) => m[1]);
  check('GREEN: sentinel keys match the registered set', JSON.stringify(sentinelKeys) === JSON.stringify([...VINTAGE_COUNT_KEYS]));
  check('GREEN: every sentinel digit equals the derived count', VINTAGE_COUNT_KEYS.every((k) => {
    const m = html1.match(new RegExp(`<!--COUNT:${k}-->(\\d+)<!--/COUNT-->`));
    return m && Number(m[1]) === countsReal[k];
  }));

  if (failures.length) {
    console.error(`gen-vintage-calendar --self-test: ${failures.length} failure(s):`);
    failures.forEach((f) => console.error('  FAIL ' + f));
    process.exit(1);
  }
  console.log('gen-vintage-calendar --self-test: OK, all controls pass.');
}

// Real-table counts for the sentinel parity leg above (same derivation the
// counts engine uses: distinct facts, total entries, distinct digests).
const countsReal = (() => {
  try {
    const t = JSON.parse(readFileSync(resolve(ROOT, TABLE_REL), 'utf8'));
    const entries = Array.isArray(t.vintages) ? t.vintages : [];
    return {
      'vintage.facts': new Set(entries.map((e) => e.fact)).size,
      'vintage.entries': entries.length,
      'vintage.sources': new Set(entries.map((e) => e.source.clause_digest)).size,
    };
  } catch { return { 'vintage.facts': 0, 'vintage.entries': 0, 'vintage.sources': 0 }; }
})();

if (SELF_TEST) {
  selfTest();
} else {
  main();
}
