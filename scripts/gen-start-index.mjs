#!/usr/bin/env node
/**
 * scripts/gen-start-index.mjs
 *
 * Builds the inline search index for start.html.
 *
 * Scans:
 *   tools/*.html             → standalone tools  (w: false)
 *   chaingraph/chains/*.html → gated workflows   (w: true)
 *   chaingraph.json nodes    → OCG node pages     (n: true) — DISCOVER-1 §D-3:
 *     380 node pages had no start.html search entry at all, discoverable only
 *     via sitemap.html or a chain composer link.
 *
 * Extracts the display title from each file's <title> tag (part before " | ").
 * Injects a `const SEARCH_INDEX=[...];` script block between the
 *   <!--START-INDEX--> ... <!--/START-INDEX-->
 * sentinels in start.html.
 *
 * Usage:
 *   node scripts/gen-start-index.mjs          # inject
 *   node scripts/gen-start-index.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(HERE, '..');
const TARGET = resolve(REPO, 'start.html');
const SENTINEL_START = '<!--START-INDEX-->';
const SENTINEL_END   = '<!--/START-INDEX-->';

function extractTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return fallback;
  return m[1].split('|')[0].trim();
}

// Node titles/mcp_names are sourced from chaingraph.json for other contexts and
// can carry CONTRACT §1.4 copy-hallmarks (em-dash) that the gate disallows in
// newly-rendered visible text — scrub before embedding, same pattern as
// gen-sitemap-html.mjs's sanitizeCopy (source data is left untouched).
function sanitizeCopy(s) {
  return String(s).replace(/—/g, ', ').replace(/\s+--\s+/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

function slug(filename) {
  return basename(filename, '.html');
}

function scanDir(dirPath, relPrefix, isWorkflow) {
  let entries;
  try { entries = readdirSync(dirPath); } catch { return []; }
  return entries
    .filter(f => f.endsWith('.html') && !f.startsWith('_'))
    .sort()
    .map(f => {
      const full = resolve(dirPath, f);
      const html = readFileSync(full, 'utf8');
      const name = slug(f);
      const title = extractTitle(html, name);
      const item = { n: name, t: title, u: relPrefix + '/' + f };
      if (isWorkflow) item.w = true;
      return item;
    });
}

function scanChaingraphNodes(repo) {
  let cg;
  try { cg = JSON.parse(readFileSync(resolve(repo, 'chaingraph', 'chaingraph.json'), 'utf8')); } catch { return []; }
  return (cg.nodes || [])
    .filter(n => (n.url || '').includes('/chaingraph/') && !(n.url || '').includes('/chaingraph/chains/'))
    .map(n => {
      const u = (n.url || '').replace('https://ainumbers.co/', '');
      const name = basename(u, '.html');
      return { n: name, t: sanitizeCopy(n.display_name || name), u, ocg: true };
    })
    .sort((a, b) => a.n.localeCompare(b.n));
}

function buildIndex() {
  const tools     = scanDir(resolve(REPO, 'tools'),                  'tools',                  false);
  const workflows = scanDir(resolve(REPO, 'chaingraph', 'chains'),   'chaingraph/chains',       true);
  const nodes     = scanChaingraphNodes(REPO);
  return { tools, workflows, nodes, all: [...tools, ...workflows, ...nodes] };
}

function serializeIndex(items) {
  const compact = items.map(x => {
    const parts = ['"n":' + JSON.stringify(x.n), '"t":' + JSON.stringify(x.t), '"u":' + JSON.stringify(x.u)];
    if (x.w) parts.push('"w":true');
    if (x.ocg) parts.push('"ocg":true');
    return '{' + parts.join(',') + '}';
  });
  return compact.join(',');
}

const CHECK = process.argv.includes('--check');
const { tools, workflows, nodes, all: items } = buildIndex();
const serialized = serializeIndex(items);
const scriptBlock = '<script>const SEARCH_INDEX=[' + serialized + '];</script>';
const replacement = SENTINEL_START + '\n' + scriptBlock + '\n' + SENTINEL_END;

const original = readFileSync(TARGET, 'utf8');
const startIdx = original.indexOf(SENTINEL_START);
const endIdx   = original.indexOf(SENTINEL_END);

if (startIdx === -1 || endIdx === -1) {
  console.error('gen-start-index: sentinels not found in start.html');
  process.exit(1);
}

const current = original.slice(startIdx, endIdx + SENTINEL_END.length);
const isStale = current !== replacement;

if (CHECK) {
  if (isStale) {
    console.error('gen-start-index: start.html search index is stale. Run `node scripts/gen-start-index.mjs` to refresh.');
    process.exit(1);
  }
  console.log('gen-start-index --check: OK (' + items.length + ' items).');
  process.exit(0);
}

if (isStale) {
  const updated = original.slice(0, startIdx) + replacement + original.slice(endIdx + SENTINEL_END.length);
  writeFileSync(TARGET, updated, 'utf8');
  console.log('gen-start-index: injected ' + items.length + ' items (' + tools.length + ' tools + ' + workflows.length + ' workflows + ' + nodes.length + ' OCG nodes).');
} else {
  console.log('gen-start-index: already fresh (' + items.length + ' items).');
}
