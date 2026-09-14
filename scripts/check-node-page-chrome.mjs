#!/usr/bin/env node
/**
 * scripts/check-node-page-chrome.mjs
 * Permanent CI gate: every chaingraph/*.html page that has been chrome-normalized
 * (art node pages, guide-*.html, and the other chaingraph/*.html hubs/explainers)
 * must carry exactly one canonical <nav> and one canonical <footer> + the CSS marker.
 * Widened from art-*.html-only scope by GUIDE-CHROME-AUDIT-1 (2026-08-17) — see
 * the CHROME_EXEMPT map in chaingraph/_page-chrome.mjs (shared with
 * scripts/normalize-node-chrome.mjs) for the pages excluded and why.
 *
 * PHASE5-FOOTER-COUNT-SCRIPTAWARE-1 (2026-09-14): footer counting/extraction is
 * SCRIPT-AWARE — a <footer> inside a <script>, <style>, or HTML comment is not
 * rendered chrome and is neither counted nor accepted. The pages whose only
 * footer lives inside a <script> template literal are pinned shrink-only in
 * scripts/node-page-chrome-baseline.json: counts only go down, the baseline
 * never absorbs a new offender, and a pinned page that gains a real rendered
 * footer goes RED until its entry is REMOVED (never raised).
 *
 * PHASE5-LINKPARITY-20PAGES-1 (2026-09-14): a LINK-PARITY leg for EXACTLY the
 * 20 footer-linked Phase-2 pages (LINK_PARITY_PAGES below) — each page's
 * rendered-footer href set, extracted from the SAME script-aware scope as the
 * counts (a footer link living inside <script>/<style>/comments is never
 * accepted), is compared BOTH directions against buildFooter() from
 * chaingraph/_page-chrome.mjs at node-page depth ({root:'../', cg:''} — all 20
 * live in chaingraph/, so the guide-* pages among them reach root assets via
 * '../'). The claim-time state (each page misses exactly ../errata.html,
 * ../guides/formal-verification-evidence.html and
 * ../guides/webmcp-field-notes.html vs the canonical href set; measured
 * 2026-09-14) is pinned shrink-only in scripts/node-page-chrome-baseline.json
 * under "linkParity": any FURTHER drift reds immediately, a pin only ever
 * tightens, and when a Phase-2 normalize row makes a page exact its entry is
 * REMOVED (reaching exact parity is that row's proof). The estate-wide
 * link ratchet stays with Phase 4 — this leg is scoped to the 20 names, never
 * the population, and never absorbs a new offender.
 *
 * Pages listed in KNOWN_SKIPS have pre-existing HTML quirks (body-embedded <footer>
 * elements or no chaingraph.json entry) that require manual follow-up — they are
 * excluded from the gate rather than allowed to fail CI in perpetuity.
 *
 * Exit 0 = all assertions pass. Exit 1 = one or more failures (lists offenders).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_REQUIRED_TOKENS, FOOTER_REQUIRED_TOKENS, CSS_MARKER, SPEC_VERSION, CHROME_EXEMPT, buildFooter } from '../chaingraph/_page-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');
const CG    = resolve(REPO, 'chaingraph');

// All normalized pages pass — the only structural skips are the CHROME_EXEMPT
// entries in chaingraph/_page-chrome.mjs; the script-only-footer pages pinned in
// scripts/node-page-chrome-baseline.json are still checked, shrink-only.
const KNOWN_SKIPS = new Set([...CHROME_EXEMPT.keys()]);

// ── shrink-only footer baseline (PHASE5-FOOTER-COUNT-SCRIPTAWARE-1) ──────────
// Pins the pages whose ONLY <footer> lives inside a <script> template literal —
// script-aware counting truthfully reads them at 0 rendered footers. Shape:
//   { "pages": { "<file>.html": { "footers": 0 } } }
// RATCHET (mirrors check-compute-proof-coverage.mjs / check-copy-hallmarks.mjs):
//   • the only legal pin is {"footers":0} — a nonzero pin would let a pinned
//     page silently DROP its rendered footer and stay green;
//   • a pinned page back at 1/1 has been FIXED → gate RED until the entry is
//     removed (the baseline tightens; it is never raised);
//   • a pinned page above its pin, or an unpinned page at != 1/1, is a NEW
//     offender — the baseline never absorbs one.
const FOOTER_BASELINE_PATH = resolve(__dir, 'node-page-chrome-baseline.json');
const BASELINE_DOC = JSON.parse(readFileSync(FOOTER_BASELINE_PATH, 'utf8'));
const FOOTER_BASELINE = BASELINE_DOC.pages;

// ── link-parity shrink-only baseline (PHASE5-LINKPARITY-20PAGES-1) ───────────
// Pins the footer href sets of EXACTLY the 20 footer-linked Phase-2 pages as
// measured at claim time (2026-09-14), against buildFooter() at node-page
// depth. Shape under "linkParity"."pages":
//   { "<file>.html": { "missing": ["<href>", …], "extra": ["<href>", …] } }
// RATCHET (mirrors the footer-count pins above):
//   • the pin records the measured missing/extra hrefs — any href drifting
//     beyond the pin (a link LOST that the pin does not list, or a link
//     GAINED that the canonical footer does not carry) is a new offender and
//     REDS immediately; the baseline never absorbs one;
//   • a pinned page whose measured missing/extra sets SHRANK below the pin
//     has been (partly) healed → gate RED until the entry is TIGHTENED to the
//     measured state (exact parity = REMOVE the entry) — the baseline only
//     ever tightens, it is never raised;
//   • the 20 names are fixed here; the estate-wide link ratchet stays with
//     Phase 4.
const LINK_PARITY_BASELINE = (BASELINE_DOC.linkParity && BASELINE_DOC.linkParity.pages) || {};
const LINK_PARITY_PAGES = new Set([
  'rfp-evidence-desk.html',
  'openchain-graph-spec.html',
  'openchain-graph-explainer.html',
  'ain-bridge-explainer.html',
  'aiact-article12-record-keeping-mapping.html',
  'ocg-sandbox.html',
  'ocg-chain-builder.html',
  'ocg-legacy-vs-ocg.html',
  'ocg-integration-guide.html',
  'ocg-guide-export.html',
  'ocg-industries.html',
  'guide-avalanche.html',
  'guide-tempo.html',
  'guide-prov-dm.html',
  'guide-buildtype.html',
  'guide-intoto.html',
  'guide-ed25519.html',
  'guide-otel.html',
  'guide-iso20022.html',
  'guide-okf.html',
]);
// Canonical footer href set, derived from buildFooter() ITSELF at node-page
// depth ({root:'../', cg:''}) — never a copied literal, so a buildFooter()
// change re-derives the comparison target automatically.
const CANONICAL_FOOTER_HREFS = new Set(
  [...buildFooter({ root: '../', cg: '' }).matchAll(/href\s*=\s*"([^"]*)"/g)].map(m => m[1])
);
// Both quote styles are accepted when reading a PAGE's footer hrefs (the
// canonical template emits double quotes; a single-quoted href is still a
// rendered link).
const HREF_ATTR_RE = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const files = readdirSync(CG).filter(f => /\.html$/.test(f)).sort();

const failures = [];

for (const filename of files) {
  if (KNOWN_SKIPS.has(filename)) continue;

  const html = readFileSync(resolve(CG, filename), 'utf-8');

  // ── count checks — site-chrome <nav> only (no class= attribute); a class'd
  // <nav class="…"> is in-body content (e.g. a table-of-contents), never chrome ──
  const navOpens  = (html.match(/<nav(?![^>]*\bclass=)[^>]*>/g) || []).length;
  const navCloses = (html.match(/<\/nav>/g)   || []).length;
  // ── script-aware footer scope (PHASE5-FOOTER-COUNT-SCRIPTAWARE-1) ──────────
  // <script>/<style> are HTML5 RAW-TEXT elements (a "<!--" inside them is
  // script/style text, never an HTML comment) and HTML comments are inert, so
  // a <footer> inside any of the three is not rendered chrome: strip them
  // before counting/extraction so such footers are neither counted nor
  // accepted. Scripts/styles strip FIRST for the raw-text reason above; the
  // other order measured byte-identical on all 699 pages (2026-09-14).
  const ftrScope = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const ftrOpens  = (ftrScope.match(/<footer[^>]*>/g) || []).length;
  const ftrCloses = (ftrScope.match(/<\/footer>/g)    || []).length;

  if (navOpens !== 1) {
    failures.push(`${filename}: site-chrome nav count (${navOpens})`);
    continue;
  }
  const footerPin = FOOTER_BASELINE[filename];
  if (footerPin !== undefined) {
    if (!footerPin || typeof footerPin.footers !== 'number' || footerPin.footers !== 0) {
      failures.push(`${filename}: illegal shrink-only baseline pin ${JSON.stringify(footerPin)} — the only legal pin is {"footers":0} (a nonzero pin could absorb a footer removal)`);
      continue;
    }
    if (ftrOpens === 1 && ftrCloses === 1) {
      failures.push(`${filename}: stale baseline entry — page now carries a rendered footer; REMOVE the entry from scripts/node-page-chrome-baseline.json (shrink-only: the baseline tightens, never raises)`);
      continue;
    }
    if (ftrOpens > footerPin.footers || ftrCloses > footerPin.footers) {
      failures.push(`${filename}: footer count (${ftrOpens}/${ftrCloses}) exceeds shrink-only baseline pin ${footerPin.footers} — never raise the entry to absorb it`);
      continue;
    }
    // Pinned at the measured 0/0 state: the footer token/spec checks below have
    // no rendered footer to inspect, but the CSS marker must still hold.
    if (!html.includes(CSS_MARKER)) {
      failures.push(`${filename}: missing CSS marker "${CSS_MARKER}"`);
    }
    continue;
  }
  if (ftrOpens !== 1 || ftrCloses !== 1) {
    failures.push(`${filename}: footer count (${ftrOpens}/${ftrCloses}) — not in scripts/node-page-chrome-baseline.json (shrink-only: the baseline never absorbs a new offender)`);
    continue;
  }

  // ── extract nav block for token checks ──
  const navM = html.match(/<nav(?![^>]*\bclass=)[^>]*>[\s\S]*?<\/nav>/);
  if (!navM) { failures.push(`${filename}: nav block not extractable`); continue; }
  const navBlock = navM[0];

  // ── extract footer block for token checks — from the SAME script-aware scope
  // as the count, so a footer living inside a script/style/comment is never
  // accepted as the page's chrome footer ──
  const ftrM = ftrScope.match(/<footer[^>]*>[\s\S]*?<\/footer>/);
  if (!ftrM) { failures.push(`${filename}: footer block not extractable`); continue; }
  const ftrBlock = ftrM[0];

  // ── NAV required tokens ──
  for (const tok of NAV_REQUIRED_TOKENS) {
    if (!navBlock.includes(tok)) {
      failures.push(`${filename}: nav missing "${tok}"`);
    }
  }

  // ── breadcrumb: current-page span must be non-empty. art-NN-*.html pages carry
  // the strict "ART-NN · <display_name>" pattern; every other page (guide/explainer,
  // and registered nodes without an "art-" filename) carries its <title> text
  // instead (no ART-NN prefix) — non-empty is sufficient there.
  const bcSpan = navBlock.match(/<span style="color:var\(--gold\)">([^<]+)<\/span>/);
  if (/^art-\d+/.test(filename)) {
    if (!bcSpan || !/^ART-\d+ · .+/.test(bcSpan[1])) {
      failures.push(`${filename}: nav-breadcrumb current span missing or malformed`);
    }
  } else if (!bcSpan || !bcSpan[1].trim()) {
    failures.push(`${filename}: nav-breadcrumb current span missing or malformed`);
  }

  // ── FOOTER required tokens ──
  for (const tok of FOOTER_REQUIRED_TOKENS) {
    if (!ftrBlock.includes(tok)) {
      failures.push(`${filename}: footer missing "${tok}"`);
    }
  }

  // ── footer spec-version label must track chaingraph.json's spec_version (the record) ──
  if (!ftrBlock.includes(`Spec v${SPEC_VERSION}`)) {
    failures.push(`${filename}: footer "Spec v" label stale — expected v${SPEC_VERSION}, run normalize-node-chrome.mjs --apply`);
  }

  // ── CSS marker ──
  if (!html.includes(CSS_MARKER)) {
    failures.push(`${filename}: missing CSS marker "${CSS_MARKER}"`);
  }

  // ── link parity vs buildFooter() — EXACTLY the 20 Phase-2 pages
  // (PHASE5-LINKPARITY-20PAGES-1). ftrBlock comes from the SAME script-aware
  // scope as the counts, so a link living inside a <script>/<style>/comment
  // is never accepted as parity. ──
  if (LINK_PARITY_PAGES.has(filename)) {
    const pageHrefs = new Set([...ftrBlock.matchAll(HREF_ATTR_RE)].map(m => m[1] ?? m[2]));
    const missing = [...CANONICAL_FOOTER_HREFS].filter(h => !pageHrefs.has(h)).sort();
    const extra   = [...pageHrefs].filter(h => !CANONICAL_FOOTER_HREFS.has(h)).sort();
    const pin = LINK_PARITY_BASELINE[filename];
    if (!pin) {
      failures.push(`${filename}: footer link drift vs buildFooter() — missing [${missing.join(', ')}] extra [${extra.join(', ')}] — not pinned in scripts/node-page-chrome-baseline.json "linkParity" (shrink-only: the baseline never absorbs a new offender)`);
    } else if (!Array.isArray(pin.missing) || !Array.isArray(pin.extra)
        || pin.missing.some(h => typeof h !== 'string') || pin.extra.some(h => typeof h !== 'string')) {
      failures.push(`${filename}: illegal link-parity baseline pin ${JSON.stringify(pin)} — the only legal shape is {"missing":[href…],"extra":[href…]} as measured`);
    } else {
      const pinMissing = new Set(pin.missing);
      const pinExtra   = new Set(pin.extra);
      const beyond = missing.filter(h => !pinMissing.has(h)).concat(extra.filter(h => !pinExtra.has(h)));
      if (beyond.length > 0) {
        failures.push(`${filename}: footer link drift BEYOND shrink-only pin (${beyond.join(', ')}) — measured missing [${missing.join(', ')}] extra [${extra.join(', ')}] vs pinned missing [${pin.missing.join(', ')}] extra [${pin.extra.join(', ')}] — never raise the entry to absorb it`);
      } else if (pin.missing.length !== missing.length || pin.extra.length !== extra.length) {
        failures.push(`${filename}: stale link-parity pin — the page now carries link(s) the pin lists as missing; TIGHTEN the entry in scripts/node-page-chrome-baseline.json to the measured state (shrink-only: the baseline tightens, never raises; exact parity = remove the entry)`);
      }
    }
  }
}

if (failures.length === 0) {
  console.log(`✓ check-node-page-chrome: all ${files.length - KNOWN_SKIPS.size} active pages pass (${KNOWN_SKIPS.size} known-skip excluded; link-parity pinned shrink-only: ${LINK_PARITY_PAGES.size} pages)`);
  process.exit(0);
} else {
  console.error(`✗ check-node-page-chrome: ${failures.length} failure(s):`);
  failures.forEach(f => console.error(`  ${f}`));
  process.exit(1);
}
