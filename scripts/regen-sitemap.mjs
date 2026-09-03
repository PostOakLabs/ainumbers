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
 * ── STATUS FILTER (GENERATOR-STATUS-FILTER-1) — THE SHARPEST CASE ───────────
 * ⛔ A DEPARTED PAGE'S URL MUST DROP WHEN ITS NODE'S STATUS FLIPS, **EVEN WHILE
 *    THE FILE EXISTS**. This generator walks the filesystem, so before this
 *    change a URL lived exactly as long as its file did. That is unfixable by
 *    deleting the file, because keeping the file is the CORRECT retirement
 *    shape: ART99-GHOST-CLEANUP-1 retains art-99's page as a retirement-banner
 *    stub precisely so a rebuilt successor can inherit the URL. So the file
 *    legitimately remains while the node is not live ⇒ file presence can NEVER
 *    be the liveness test. Only chaingraph.json's `status` can answer, via the
 *    shared lens in scripts/_node-status.mjs.
 * ⛔ Only pages the GRAPH KNOWS are eligible to drop. A tools/ or docs/ page
 *    with no chaingraph node is not in the lens and is never filtered — absence
 *    from the graph is not a departure. Measured on origin/main ffa230dc:
 *    exactly ONE URL changes (art-99's), 1851 -> 1850.
 * ⛔ Same mechanism rots on ANY retirement style, not just deprecation — the
 *    disclosures/postmortem-log.html redirect shim (#1361) is still advertised
 *    here for the same reason. That one is NOT fixed by this filter: a redirect
 *    shim is not a graph node, so nothing declares its status. Stated rather
 *    than silently left, so the next reader knows it is a known remainder and
 *    not an oversight in this filter.
 *
 * Usage:
 *   node scripts/regen-sitemap.mjs          # write sitemap.xml
 *   node scripts/regen-sitemap.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStatusLens } from './_node-status.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SITEMAP_PATH = resolve(REPO, 'sitemap.xml');
const MANIFEST = JSON.parse(readFileSync(resolve(HERE, 'published-dirs.json'), 'utf8'));
const BASE = 'https://ainumbers.co';
const CHECK = process.argv.includes('--check');
const LENS = loadStatusLens(REPO);

function toolSortKey(fname) {
  const m = fname.match(/^(\d+)/);
  return m ? [parseInt(m[1], 10), fname] : [Number.MAX_SAFE_INTEGER, fname];
}

function cmpTool(a, b) {
  const [an, as] = toolSortKey(a);
  const [bn, bs] = toolSortKey(b);
  return an !== bn ? an - bn : as.localeCompare(bs);
}

/**
 * THE ONE PLACE a discovered file is refused publication. Both the flat lister
 * and the recursive walker route through it, so the two cannot drift apart —
 * which is how a filter ends up applied to tools/ and forgotten on chaingraph/.
 * @param {string} rel repo-relative path, forward slashes, e.g. `tools/1-x.html`
 */
function isPublishable(rel) {
  return !LENS.isNonLivePath(rel);
}

function listHtml(dirAbs, dirRel) {
  let entries;
  try { entries = readdirSync(dirAbs); } catch { return []; }
  return entries.filter((f) => f.endsWith('.html') && isPublishable(`${dirRel}/${f}`));
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
    } else if (e.name.endsWith('.html') && isPublishable(rel)) {
      found.push(rel);
    }
  }
  return found;
}

function loadExistingLastmods(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const map = {};
  const re = /<loc>https:\/\/([^/]+)\/([^<]*)<\/loc><lastmod>([^<]+)<\/lastmod>/g;
  let m;
  while ((m = re.exec(text))) map[`${m[1]}/${m[2]}`] = m[3];
  return map;
}

function urlEntry(relPath, lastmod, changefreq = 'monthly', priority = '0.8') {
  return `  <url><loc>${BASE}/${relPath}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function urlEntryExternal(host, relPath, lastmod, changefreq, priority) {
  return `  <url><loc>${host}/${relPath}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function main() {
  const toolFiles = listHtml(resolve(REPO, 'tools'), 'tools').sort(cmpTool);
  const guideFiles = listHtml(resolve(REPO, 'guides'), 'guides').sort();
  const disclosureFiles = listHtml(resolve(REPO, 'disclosures'), 'disclosures').sort();
  const ledgerFiles = listHtml(resolve(REPO, 'ledger'), 'ledger').sort();
  const trustFiles = listHtml(resolve(REPO, 'trust'), 'trust').sort();

  const excludeSet = new Set(MANIFEST.recursiveExcludeSubdirs || []);
  let chaingraphFiles = [];
  let attestationsFiles = [];
  for (const dir of MANIFEST.recursiveDirs) {
    const files = walkHtmlRecursive(resolve(REPO, dir), dir, excludeSet).sort();
    if (dir === 'chaingraph') chaingraphFiles = files;
    else if (dir === 'attestations') attestationsFiles = files;
  }

  // Surfaces published to a DIFFERENT host than BASE (docs/ -> docs.ainumbers.co
  // via deploy-docs.yml/Cloudflare Pages — deploy-to-dreamhost.yml excludes
  // docs/ from the apex entirely, SITEMAP-DOCS-SCOPE-1). Scanned from the same
  // local directory but emitted under their own host, never under BASE.
  const externalSurfaces = (MANIFEST.externalSurfaces || []).map((s) => ({
    ...s,
    files: listHtml(resolve(REPO, s.dir), s.dir).sort(),
  }));

  const lastmods = loadExistingLastmods(SITEMAP_PATH);
  const today = new Date().toISOString().slice(0, 10);
  const HOST = BASE.replace(/^https?:\/\//, '');
  const lm = (relPath) => lastmods[`${HOST}/${relPath}`] || today;
  const lmExt = (host, relPath) => lastmods[`${host.replace(/^https?:\/\//, '')}/${relPath}`] || today;

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  lines.push('');
  lines.push('  <!-- Core Pages -->');
  for (const p of MANIFEST.rootPages) {
    lines.push(urlEntry(p.loc, lastmods[`${HOST}/${p.loc}`] || p.lastmod, p.changefreq, p.priority));
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

  lines.push('  <!-- Ledger -->');
  for (const f of ledgerFiles) lines.push(urlEntry(`ledger/${f}`, lm(`ledger/${f}`), 'monthly', '0.5'));
  lines.push('');

  lines.push('  <!-- Attestations -->');
  for (const f of attestationsFiles) lines.push(urlEntry(f, lm(f), 'yearly', '0.3'));
  lines.push('');

  lines.push('  <!-- Trust -->');
  for (const f of trustFiles) lines.push(urlEntry(`trust/${f}`, lm(`trust/${f}`), 'monthly', '0.5'));
  lines.push('');

  for (const s of externalSurfaces) {
    lines.push(`  <!-- ${s.dir} (external: ${s.host}) -->`);
    for (const f of s.files) lines.push(urlEntryExternal(s.host, f, lmExt(s.host, f), s.changefreq, s.priority));
    lines.push('');
  }

  lines.push('</urlset>');
  const output = lines.join('\n') + '\n';

  const externalTotal = externalSurfaces.reduce((n, s) => n + s.files.length, 0);
  const total = MANIFEST.rootPages.length + guideFiles.length + toolFiles.length +
    chaingraphFiles.length + disclosureFiles.length + ledgerFiles.length + attestationsFiles.length + trustFiles.length + externalTotal;

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
  console.log(`regen-sitemap: written (${toolFiles.length} tools, ${guideFiles.length} guides, ${chaingraphFiles.length} chaingraph, ${disclosureFiles.length} disclosures, ${ledgerFiles.length} ledger, ${attestationsFiles.length} attestations, ${trustFiles.length} trust, ${externalTotal} external, ${total} total).`);
  // Named, never silent: a URL that vanished from the sitemap while its file is
  // still on disk must be explainable from this run's own output.
  const withheld = [...LENS.nonLivePaths].filter((p) => existsSync(resolve(REPO, p))).sort();
  if (withheld.length) {
    console.log(`regen-sitemap: ${withheld.length} URL(s) WITHHELD — file present, node not live (status filter, GENERATOR-STATUS-FILTER-1):`);
    for (const p of withheld) console.log(`  − ${BASE}/${p}  [${LENS.statusByPath.get(p)}]`);
  }
}

main();
