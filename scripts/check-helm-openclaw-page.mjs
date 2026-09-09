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
// evaluate() is a pure function of (pageText, kit manifest, rendered regions)
// so the paired self-test (check-helm-openclaw-page.test.mjs, SO #34c /
// GATE-SELFTEST-META-1) can drive RED/GREEN mutations without touching disk.
//
// Usage: node scripts/check-helm-openclaw-page.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRegion, regionContent, REGIONS } from './gen-helm-openclaw-snippets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE = resolve(REPO, 'helm-openclaw.html');

export const SECTION_IDS = ['get', 'install', 'trust', 'try', 'verify', 'canvas', 'faq', 'links'];
export const REQUIRED_METAS = [
  ['name="ain:category"', 'helm'],
  ['name="ain:featured"', 'start'],
];

// Pure. regions = { id -> rendered content } supplied by the caller (main
// renders from the real kit; the self-test renders once and mutates the page
// text, so the comparison target stays fixed).
export function evaluate(pageText, regions) {
  const failures = [];
  const advisories = [];

  // 1. Six marker pairs, each exactly once, open-before-close.
  for (const id of REGIONS) {
    const open = `<!--HELMKIT:${id}-->`;
    const close = `<!--/HELMKIT:${id}-->`;
    const nOpen = pageText.split(open).length - 1;
    const nClose = pageText.split(close).length - 1;
    if (nOpen !== 1 || nClose !== 1) {
      failures.push(`marker region ${id}: expected exactly one open+close pair, found ${nOpen}/${nClose}`);
      continue;
    }
    if (pageText.indexOf(close) < pageText.indexOf(open)) {
      failures.push(`marker region ${id}: close marker precedes open marker`);
    }
  }

  // 2. Eight sections.
  for (const id of SECTION_IDS) {
    if (!pageText.includes(`id="${id}"`)) failures.push(`missing section id="${id}" (the spec's eight sections are binding)`);
  }

  // 3. Head metas.
  for (const [attr, val] of REQUIRED_METAS) {
    const re = new RegExp(`<meta\\s+${attr.replace(/[:"]/g, (c) => `\\${c}`)}\\s+content="${val}"`);
    if (!re.test(pageText)) failures.push(`missing head meta ${attr} content="${val}"`);
  }

  // 4. JSON-LD parses and carries a TechArticle with a name.
  const ldMatch = pageText.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
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
    const want = (regions[id] ?? '').trim();
    const have = regionContent(pageText, id);
    if (have === null) {
      if (pageText.includes(`HELMKIT:${id}`)) failures.push(`region ${id}: content unreadable (broken marker pair)`);
      continue; // marker-count failure already recorded in step 1
    }
    if (have.trim() !== want) {
      drifted++;
      failures.push(`region ${id}: drifted from data/helm-kit/ — run node scripts/gen-helm-openclaw-snippets.mjs and commit`);
    } else {
      advisories.push(`ADVISORY: TODO-KIT ${id}`);
    }
  }
  return { failures, advisories, drifted };
}

function main() {
  let html;
  try {
    html = readFileSync(PAGE, 'utf8');
  } catch (e) {
    console.error(`✗ check-helm-openclaw-page: cannot read helm-openclaw.html: ${e.message}`);
    process.exit(1);
  }
  const regions = {};
  for (const id of REGIONS) regions[id] = renderRegion(id);
  const { failures, advisories, drifted } = evaluate(html, regions);

  if (drifted === 0 && failures.length === 0) {
    console.log('helm-openclaw page: structure green, six marker regions byte-fresh.');
  }
  for (const a of advisories) console.log(a);
  if (failures.length) {
    console.error(`\n✗ check-helm-openclaw-page FAILED — ${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log('check-helm-openclaw-page: OK.');
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  main();
}
