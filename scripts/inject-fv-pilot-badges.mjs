#!/usr/bin/env node
/**
 * scripts/inject-fv-pilot-badges.mjs — FV-BADGE-1.
 *
 * Renders (or removes) the per-kernel formal-verification tier badge on the ~4 node pages named by
 * chaingraph/fv-pilot/*.json, driven ENTIRELY by check-fv-pilot-badge.mjs's derived state -- never
 * hand-typed here. SCOPE IS DELIBERATELY NARROW: only the node pages that have a fv-pilot record are
 * touched (today: 4 of ~530), never the shared node-page chrome in _page-chrome.mjs and never any page
 * without a record. This is the mechanism-scoped blast radius STANDING-ORDERS.md warns about -- do not
 * widen this to iterate every art-*.html page.
 *
 * Badge only ever appears at FULL/fresh derived status (never on a stale or missing record) -- the
 * classifier in check-fv-pilot-badge.mjs is the single source of truth for that boolean.
 *
 * Idempotent: injects into a marker-delimited block right after <h1>; a repeat run with unchanged
 * derivation produces no diff. When a kernel goes stale, re-running this DROPS the badge automatically.
 *
 * Usage:
 *   node scripts/inject-fv-pilot-badges.mjs            dry-run, prints what would change
 *   node scripts/inject-fv-pilot-badges.mjs --apply     writes the node pages
 *   node scripts/inject-fv-pilot-badges.mjs --check     exit 1 if any page's on-disk badge state doesn't
 *                                                        match the live derivation (CI/preflight gate)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deriveFvPilotBadges } from './check-fv-pilot-badge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_DIR = resolve(REPO, 'chaingraph');
const KDIR = resolve(CG_DIR, 'kernels');

const APPLY = process.argv.includes('--apply');
const CHECK = process.argv.includes('--check');

const MARK_START = '<!-- FV-PILOT-BADGE:START -->';
const MARK_END = '<!-- FV-PILOT-BADGE:END -->';

// Method-transparency hover copy — no "certified"/"guaranteed"/assurance-grade language, no individual
// named. Links to methods.html for the full scope + assumptions writeup, never restates it here.
const HOVER_TEXT = 'Part of a small formal-verification pilot (4 kernels). Method transparency only, not a compliance certification -- see methods.html for scope and assumptions.';

function badgeHtml(r) {
  const safeLabel = r.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `${MARK_START}\n  <a href="../methods.html" class="fv-pilot-badge" title="${HOVER_TEXT}">Class ${r.class} &middot; ${safeLabel}</a>\n  ${MARK_END}`;
}

const FV_BADGE_CSS_MARKER = '/* FV-PILOT-BADGE-CSS:v1 */';
const FV_BADGE_CSS = `\n${FV_BADGE_CSS_MARKER}\n.fv-pilot-badge{display:inline-flex;align-items:center;gap:.3rem;font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.06em;text-transform:none;padding:.16rem .55rem;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.35);color:var(--gold);border-radius:3px;margin-left:.6rem;vertical-align:middle;text-decoration:none}\n.fv-pilot-badge:hover{opacity:.85}\n`;

function readKernelSource(tool_id) {
  const p = resolve(KDIR, `${tool_id}.kernel.mjs`);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
const derived = await deriveFvPilotBadges(readKernelSource, sourceDigest);

let drift = false;
const changed = [];
const unchanged = [];

for (const r of derived) {
  const pagePath = resolve(CG_DIR, `${r.tool_id}.html`);
  if (!existsSync(pagePath)) {
    console.error(`  ⚠ no node page for ${r.tool_id} at ${pagePath} — skipping`);
    continue;
  }
  const original = readFileSync(pagePath, 'utf8');
  let html = original;

  // Strip any existing badge block first (handles both "still fresh, re-render" and "went stale, drop").
  const blockRe = new RegExp(`\\s*${MARK_START}[\\s\\S]*?${MARK_END}`, 'g');
  html = html.replace(blockRe, '');

  if (r.badge) {
    const h1Re = /(<h1[^>]*>[\s\S]*?<\/h1>)/;
    if (!h1Re.test(html)) {
      console.error(`  ⚠ ${r.tool_id}: no <h1> found — cannot place badge`);
      continue;
    }
    html = html.replace(h1Re, `$1\n  ${badgeHtml(r)}`);
  }

  // Ensure badge CSS present whenever a badge is (or was, so removal-only edits still leave valid CSS
  // for a future re-add) -- inject once, idempotent via marker.
  if (!html.includes(FV_BADGE_CSS_MARKER)) {
    const headClose = html.indexOf('</head>');
    if (headClose !== -1) {
      html = html.slice(0, headClose) + `<style>${FV_BADGE_CSS}</style>\n` + html.slice(headClose);
    }
  }

  if (html !== original) {
    drift = true;
    changed.push(r.tool_id);
    if (APPLY) writeFileSync(pagePath, html, 'utf8');
  } else {
    unchanged.push(r.tool_id);
  }
}

console.log(`\nFV pilot badge injection — ${derived.length} pilot record(s) evaluated.`);
console.log(`  badge-eligible : ${derived.filter((r) => r.badge).length}`);
console.log(`  dropped        : ${derived.filter((r) => !r.badge).length}`);
if (changed.length) console.log(`  ${APPLY ? 'written' : 'would change'}: ${changed.join(', ')}`);
if (unchanged.length) console.log(`  already current: ${unchanged.join(', ')}`);

if (CHECK) {
  if (drift) {
    console.error('\n✗ FV pilot badge drift — on-disk node pages do not match the live derivation. Run: node scripts/inject-fv-pilot-badges.mjs --apply');
    process.exit(1);
  }
  console.log('\n✓ FV pilot badges match live derivation on all node pages.');
  process.exit(0);
}

if (!APPLY && drift) {
  console.log('\nRun with --apply to write these changes.');
}
