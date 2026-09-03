#!/usr/bin/env node
// check-catalog-urls.mjs -- CATALOG-DEADURL-GATE-1 (audit XSRF-4/EXP-8, 2026-09-01).
//
// THE DEFECT: regen_catalog.py used to emit an unconditional
// `{BASE_URL}/tools/{slug}.html` metadata.url per manifest, so any manifest
// whose real page lived elsewhere (a chaingraph node) or under a different
// filename than its own manifest slug (the 520-543 legacy-numbered manifests,
// XSRF-6) shipped a dead URL into the public MCP catalog -- 85/656 entries
// measured 404 at audit time, 13% of the agent-facing discovery surface. The
// generator already detected this (its own `missing_html` diagnostic) but
// nothing gated on it, so the warning printed and the dead URL shipped anyway.
//
// THE FIX (regen_catalog.py, same row): derive metadata.url from where the
// page actually exists -- tools/ page, else the chaingraph node page, else
// omit the url field entirely. Honest absence beats a dead link; a
// kernel-shard tool mid-assemble legitimately has no page yet.
//
// THIS GATE (independent derivation, SO #34 -- never re-read the generator's
// own bookkeeping): for every catalog entry that DOES carry a metadata.url,
// recompute its existence straight off the filesystem, independent of
// whatever the generator believed when it wrote the file. A url that 404s is
// a hard failure; the generator's own book is never consulted.
//
// SCOPE: mcp/catalog.json only. dead-link-check.mjs stays HTML-only and does
// not gain same-domain-absolute resolution in this row (see PR body for why);
// this gate is catalog.json's dedicated owner for exactly the XSRF-4 class.
//
// Usage:
//   node scripts/check-catalog-urls.mjs             # gate (preflight + CI)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');

// Pure, injectable core: given a parsed catalog and an existence predicate
// (path -> bool) over REPO-RELATIVE paths, return every tool entry whose
// metadata.url does not resolve. No filesystem access in this function --
// the CLI wires the real filesystem in below, the selftest wires a fake one.
export function findBrokenUrls(catalog, existsFn, baseUrl) {
  const base = baseUrl || catalog.base_url || 'https://ainumbers.co';
  const prefix = base.replace(/\/$/, '') + '/';
  const broken = [];
  for (const tool of catalog.tools || []) {
    const url = tool?.metadata?.url;
    if (!url) continue; // no url claimed -- nothing to verify
    if (!url.startsWith(prefix)) {
      broken.push({ name: tool.name, url, reason: 'url does not start with base_url' });
      continue;
    }
    const relPath = url.slice(prefix.length).split('#')[0].split('?')[0];
    if (!existsFn(relPath)) {
      broken.push({ name: tool.name, url, reason: 'no file at ' + relPath });
    }
  }
  return broken;
}

function main() {
  const catalogPath = resolve(REPO, 'mcp/catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const broken = findBrokenUrls(catalog, (relPath) => existsSync(resolve(REPO, relPath)));

  if (broken.length === 0) {
    console.log('check-catalog-urls: ' + (catalog.tools || []).length + ' entries scanned, 0 dead url(s).');
    process.exit(0);
  }

  console.error('\nDEAD CATALOG URL(S) FOUND (' + broken.length + ') -- mcp/catalog.json claims a page that does not exist on disk:');
  for (const b of broken) console.error('   X ' + b.name + ' -> ' + b.url + '  (' + b.reason + ')');
  console.error('\nFix: correct or remove the manifest\'s execution.entry, or place the page, then re-run scripts/regen_catalog.py.');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
