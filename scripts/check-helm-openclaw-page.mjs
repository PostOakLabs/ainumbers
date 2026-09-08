#!/usr/bin/env node
// check-helm-openclaw-page.mjs — HELM-OPENCLAW-PAGE-1 gate.
//
// Asserts helm-openclaw.html is structurally whole and its six HELMKIT marker
// regions are byte-fresh against data/helm-kit/ (via
// gen-helm-openclaw-snippets.mjs's renderers, imported — one renderer, never a
// re-implementation).
//
// Advisory/blocking split (mirrors the other derived surfaces): while
// data/helm-kit/manifest.json carries "todoKit": true (pre-kit), a region whose
// content matches its PRE-KIT vendor copy passes with "ADVISORY: TODO-KIT"
// printed — the advisory names provenance, not staleness. Structural defects
// (missing/broken markers, missing sections, missing head metas, malformed
// JSON-LD, region drift against the vendor copy) fail in EVERY context.
// When HELM-AGENT-KIT-1 lands and the vendor copy is replaced, the same check
// becomes the real freshness gate (blocking on main, the advisory split for
// kits lands with the kit row).
//
// Usage: node scripts/check-helm-openclaw-page.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRegion, regionContent, REGIONS } from './gen-helm-openclaw-snippets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE = resolve(REPO, 'helm-openclaw.html');

const SECTION_IDS = ['get', 'install', 'trust', 'try', 'verify', 'canvas', 'faq', 'links'];
const REQUIRED_METAS = [
  ['name="ain:category"', 'helm'],
  ['name="ain:featured"', 'start'],
];

const failures = [];
const advisories = [];

let html;
try {
  html = readFileSync(PAGE, 'utf8');
} catch (e) {
  console.error(`✗ check-helm-openclaw-page: cannot read helm-openclaw.html: ${e.message}`);
  process.exit(1);
}

// 1. Six marker pairs, each exactly once, open-before-close.
for (const id of REGIONS) {
  const open = `<!--HELMKIT:${id}-->`;
  const close = `<!--/HELMKIT:${id}-->`;
  const nOpen = html.split(open).length - 1;
  const nClose = html.split(close).length - 1;
  if (nOpen !== 1 || nClose !== 1) {
    failures.push(`marker region ${id}: expected exactly one open+close pair, found ${nOpen}/${nClose}`);
    continue;
  }
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (j < i) failures.push(`marker region ${id}: close marker precedes open marker`);
}

// 2. Eight sections.
for (const id of SECTION_IDS) {
  const needle = `id="${id}"`;
  if (!html.includes(needle)) failures.push(`missing section id="${id}" (the spec's eight sections are binding)`);
}

// 3. Head metas.
for (const [attr, val] of REQUIRED_METAS) {
  const re = new RegExp(`<meta\\s+${attr.replace(/[:"]/g, (c) => `\\${c}`)}\\s+content="${val}"`);
  if (!re.test(html)) failures.push(`missing head meta ${attr} content="${val}"`);
}

// 4. JSON-LD parses and carries a TechArticle with a name.
const ldMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!ldMatch) {
  failures.push('no application/ld+json block found (spec requires JSON-LD TechArticle)');
} else {
  try {
    const graph = JSON.parse(ldMatch[1]);
    const nodes = graph['@graph'] || [graph];
    if (!nodes.some((n) => n['@type'] === 'TechArticle' && n.name)) {
      failures.push('JSON-LD @graph has no TechArticle with a name');
    }
  } catch (e) {
    failures.push(`JSON-LD block is not well-formed JSON: ${e.message}`);
  }
}

// 5. Marker freshness against the vendor copy (advisory provenance, blocking drift).
let drifted = 0;
for (const id of REGIONS) {
  let want;
  try {
    want = renderRegion(id).trim();
  } catch (e) {
    failures.push(`region ${id}: renderer failed: ${e.message}`);
    continue;
  }
  const have = regionContent(html, id);
  if (have === null) {
    failures.push(`region ${id}: content unreadable (broken marker pair)`);
    continue;
  }
  if (have.trim() !== want) {
    drifted++;
    failures.push(`region ${id}: drifted from data/helm-kit/ — run node scripts/gen-helm-openclaw-snippets.mjs and commit`);
  } else {
    advisories.push(`ADVISORY: TODO-KIT ${id}`);
  }
}

if (drifted === 0 && failures.length === 0) {
  console.log('helm-openclaw page: structure green, six marker regions byte-fresh.');
}
for (const a of advisories) console.log(a);
if (failures.length) {
  console.error(`\n✗ check-helm-openclaw-page FAILED — ${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('check-helm-openclaw-page: OK.');
