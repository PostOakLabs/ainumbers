#!/usr/bin/env node
/**
 * scripts/regen-sitemap.mjs — DISCOVER-1 §D-1
 *
 * Regenerates sitemap.xml from the live filesystem, scanning EVERY published
 * directory (not just tools/ + guides/, which is all the prior
 * scripts/regen_sitemap.py knew about). Directory list is the shared manifest
 * scripts/published-dirs.json — scripts/verify_repo.py check_sitemap reads
 * the SAME file, so generator and gate can't drift apart independently (the
 * root cause of the 2026-07-16 audit: chaingraph waves after commit #239 kept
 * shipping while the sitemap generator's scope stayed frozen).
 *
 * Preserves existing <lastmod> per URL (re-runs only date genuinely-new
 * pages, not the whole file) — same doctrine as the prior Python script.
 *
 * Usage:
 *   node scripts/regen-sitemap.mjs          # write sitemap.xml
 *   node scripts/regen-sitemap.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SITEMAP_PATH = resolve(REPO, 'sitemap.xml');
const MANIFEST = JSON.parse(readFileSync(resolve(HERE, 'published-dirs.json'), 'utf8'));
const BASE = 'https://ainumbers.co';
const CHECK = process.argv.includes('--check');

function toolSortKey(fname) {
  const m = fname.match(/^(\d+)/);
  return m ? [parseInt(m[1], 10), fname] : [Number.MAX_SAFE_INTEGER, fname];
}

function cmpTool(a, b) {
  const [an, as] = toolSortKey(a);
  const [bn, bs] = toolSortKey(b);
  return an !== bn ? an - bn : as.localeCompare(bs);
}

function listHtml(dirAbs) {
  let entries;
  try { entries = readdirSync(dirAbs); } catch { return []; }
  return entries.filter((f) => f.endsWith('.html'));
}

function walkHtmlRecursive(dirAbs, dirRel, excludeSet) {
  let entries;
  try { entries = readdirSync(dirAbs, { withFileTypes: true }); } catch { return []; }
  let found = [];
  for (const e of entries) {
    const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
    if (excludeSet.has(rel)) continue;
    const abs = join(dirAbs, e.name);
    if (e.isDirectory()) {
      found = found.concat(walkHtmlRecursive(abs, rel, excludeSet));
    } else if (e.name.endsWith('.html')) {
      found.push(rel);
    }
  }
  return found;
}

function loadExistingLastmods(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const map = {};
  const re = /<loc>https:\/\/ainumbers\.co\/([^<]*)<\/loc><lastmod>([^<]+)<\/lastmod>/g;
  let m;
  while ((m = re.exec(text))) map[m[1]] = m[2];
  return map;
}

function urlEntry(relPath, lastmod, changefreq = 'monthly', priority = '0.8') {
  return `  <url><loc>${BASE}/${relPath}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function main() {
  const toolFiles = listHtml(resolve(REPO, 'tools')).sort(cmpTool);
  const guideFiles = listHtml(resolve(REPO, 'guides')).sort();
  const disclosureFiles = listHtml(resolve(REPO, 'disclosures')).sort();
  const docsFiles = listHtml(resolve(REPO, 'docs')).sort();
  const ledgerFiles = listHtml(resolve(REPO, 'ledger')).sort();
  const trustFiles = listHtml(resolve(REPO, 'trust')).sort();

  const excludeSet = new Set(MANIFEST.recursiveExcludeSubdirs || []);
  let chaingraphFiles = [];
  let attestationsFiles = [];
  for (const dir of MANIFEST.recursiveDirs) {
    const files = walkHtmlRecursive(resolve(REPO, dir), dir, excludeSet).sort();
    if (dir === 'chaingraph') chaingraphFiles = files;
    else if (dir === 'attestations') attestationsFiles = files;
  }

  const lastmods = loadExistingLastmods(SITEMAP_PATH);
  const today = new Date().toISOString().slice(0, 10);
  const lm = (relPath) => lastmods[relPath] || today;

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  lines.push('');
  lines.push('  <!-- Core Pages -->');
  for (const p of MANIFEST.rootPages) {
    lines.push(urlEntry(p.loc, lastmods[p.loc] || p.lastmod, p.changefreq, p.priority));
  }
  lines.push('');

  lines.push('  <!-- Guides -->');
  for (const f of guideFiles) lines.push(urlEntry(`guides/${f}`, lm(`guides/${f}`)));
  lines.push('');

  lines.push('  <!-- Tools -->');
  for (const f of toolFiles) lines.push(urlEntry(`tools/${f}`, lm(`tools/${f}`)));
  lines.push('');

  lines.push('  <!-- OpenChainGraph (node pages, chains, hub, spec) -->');
  for (const f of chaingraphFiles) lines.push(urlEntry(f, lm(f)));
  lines.push('');

  lines.push('  <!-- Disclosures -->');
  for (const f of disclosureFiles) lines.push(urlEntry(`disclosures/${f}`, lm(`disclosures/${f}`), 'monthly', '0.5'));
  lines.push('');

  lines.push('  <!-- Docs -->');
  for (const f of docsFiles) lines.push(urlEntry(`docs/${f}`, lm(`docs/${f}`), 'monthly', '0.5'));
  lines.push('');

  lines.push('  <!-- Ledger -->');
  for (const f of ledgerFiles) lines.push(urlEntry(`ledger/${f}`, lm(`ledger/${f}`), 'monthly', '0.5'));
  lines.push('');

  lines.push('  <!-- Attestations -->');
  for (const f of attestationsFiles) lines.push(urlEntry(f, lm(f), 'yearly', '0.3'));
  lines.push('');

  lines.push('  <!-- Trust -->');
  for (const f of trustFiles) lines.push(urlEntry(`trust/${f}`, lm(`trust/${f}`), 'monthly', '0.5'));
  lines.push('');

  lines.push('</urlset>');
  const output = lines.join('\n') + '\n';

  const total = MANIFEST.rootPages.length + guideFiles.length + toolFiles.length +
    chaingraphFiles.length + disclosureFiles.length + docsFiles.length + ledgerFiles.length + attestationsFiles.length + trustFiles.length;

  if (CHECK) {
    const current = existsSync(SITEMAP_PATH) ? readFileSync(SITEMAP_PATH, 'utf8') : '';
    if (current !== output) {
      console.error('regen-sitemap --check FAIL: sitemap.xml is stale. Run: node scripts/regen-sitemap.mjs');
      process.exit(1);
    }
    console.log(`regen-sitemap --check: OK (${total} URLs).`);
    process.exit(0);
  }

  writeFileSync(SITEMAP_PATH, output, 'utf8');
  console.log(`regen-sitemap: written (${toolFiles.length} tools, ${guideFiles.length} guides, ${chaingraphFiles.length} chaingraph, ${disclosureFiles.length} disclosures, ${docsFiles.length} docs, ${ledgerFiles.length} ledger, ${attestationsFiles.length} attestations, ${trustFiles.length} trust, ${total} total).`);
}

main();
