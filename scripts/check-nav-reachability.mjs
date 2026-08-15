#!/usr/bin/env node
// scripts/check-nav-reachability.mjs — NAV-ISLAND-1 reachability gate.
//
// Prevents "island" pages: finished, deployed .html that no on-site navigation
// links to (reachable only via sitemap.xml / a direct URL). All such pages are in
// sitemap.xml so crawlers find them, but a human clicking through the site never
// will — the recurring failure mode where a guide/tool ships but nobody wires it
// into a hub or nav.
//
// Reachability model:
//   roots      : index.html
//   static     : follow <a href> links (JS-runtime hrefs ignored — code stripped)
//   dynamic    : every *.html referenced inside chaingraph/chaingraph.json is
//                treated as reachable, because the ChainGraph boundary-explorer
//                enumerates nodes/chains from that JSON at runtime (not via static
//                <a> tags the crawler above can see).
//   by-design  : redirect shims (<meta http-equiv="refresh"> or robots noindex)
//                are auto-exempt — they are legacy-URL forwarders that are
//                unlinked ON PURPOSE (see memory project-ainumbers-guide-redirect-shims).
//
// Baseline (scripts/nav-island-baseline.json), ratchet like the dead-link gate:
//   - an island NOT in the baseline    -> FAIL (exit 1)   [the recurrence guard]
//   - a baseline entry now reachable   -> WARN (prune)    [keeps baseline honest]
// Flags: --init / --update  regenerate the baseline from current state, exit 0.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.NAV_ROOT ? resolve(process.env.NAV_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = process.env.NAV_BASELINE ? resolve(process.env.NAV_BASELINE)
  : join(ROOT, 'scripts', 'nav-island-baseline.json');
const MODE = (process.argv.includes('--init') || process.argv.includes('--update')) ? 'update' : 'check';

// Sibling git worktrees + tooling dirs are foreign checkouts, not site content.
// '.wt' is the canonical worktree dir per workspace-root CLAUDE.md ("Worktrees live
// under AINumbers/.wt/, .worktrees/, or .claude/worktrees/") — a live sibling worktree
// checked out there (e.g. repo/.wt/<wu>/) is a full repo copy and must be excluded the
// same way '.claude'/'worktrees' already are, or every page in it double-counts as an
// island/reachable-baseline entry for someone else's in-progress WU.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'worktrees', '.claude', '.wt']);

function collect(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.git')) collect(join(dir, e.name), out);
    } else if (e.isFile() && /\.html?$/i.test(e.name)) {
      out.push(rel(join(dir, e.name)));
    }
  }
  return out;
}
function rel(abs) { return relative(ROOT, abs).split(/[\\/]/).join('/'); }
function read(relPath) { try { return readFileSync(join(ROOT, relPath), 'utf-8'); } catch { return ''; } }
function stripCode(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
             .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
             .replace(/<!--[\s\S]*?-->/g, ' ');
}
function isSitemap(p) { return /(^|\/)sitemap[^/]*\.html$/i.test(p); }
function isShim(relPath) {
  const t = read(relPath).replace(/\s+/g, '');
  return /http-equiv=["']?refresh/i.test(t) || /name=["']?robots["']?content=["'][^"']*noindex/i.test(t);
}
// resolve an href found in `fromRel` to a repo-relative .html path, or null.
function resolveHref(fromRel, href) {
  let h = href.split('#')[0].split('?')[0].trim();
  if (!h || /^(https?:|mailto:|tel:|javascript:|data:)/i.test(h)) return null;
  let p = h.startsWith('/') ? h.slice(1) : posix.normalize(posix.join(posix.dirname(fromRel), h));
  if (p.endsWith('/')) p += 'index.html';
  return /\.html?$/i.test(p) ? p : null;
}
function staticHrefs(relPath) {
  const html = stripCode(read(relPath));
  const out = new Set();
  const re = /href\s*=\s*("([^"]*)"|'([^']*)')/gi; let m;
  while ((m = re.exec(html))) {
    const r = resolveHref(relPath, m[2] != null ? m[2] : (m[3] || ''));
    if (r) out.add(r);
  }
  return out;
}

const ALL = new Set(collect(ROOT));
function bfs(roots) {
  const seen = new Set(); const st = [...roots];
  while (st.length) {
    const c = st.pop();
    if (seen.has(c)) continue;
    seen.add(c);
    if (isSitemap(c)) continue;              // don't traverse the sitemap (it lists everything)
    if (!ALL.has(c)) continue;
    for (const l of staticHrefs(c)) if (ALL.has(l) && !seen.has(l)) st.push(l);
  }
  return seen;
}

// dynamic reachable roots from chaingraph.json
const cg = read('chaingraph/chaingraph.json');
const dyn = new Set();
for (const m of cg.matchAll(/"([^"\n]+?\.html)"/g)) {
  const raw = m[1].replace(/^\//, '').split(/[\\/]/).join('/');
  for (const cand of [raw, 'chaingraph/' + raw, 'chaingraph/' + posix.basename(raw)]) {
    if (ALL.has(cand)) dyn.add(cand);
  }
}

const reach = new Set([...bfs(['index.html']), ...bfs([...dyn]), ...dyn]);

const islands = [...ALL]
  .filter(p => !reach.has(p) && !isSitemap(p) && !isShim(p))
  .sort();

if (MODE === 'update') {
  writeFileSync(BASELINE, JSON.stringify(islands, null, 2) + '\n');
  console.log(`nav-reachability: baseline written with ${islands.length} accepted island(s) -> ${rel(BASELINE)}`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf-8')) : [];
const baseSet = new Set(baseline);
const isSet = new Set(islands);
const created = islands.filter(p => !baseSet.has(p));      // NEW islands -> fail
const pruned = baseline.filter(p => !isSet.has(p));         // now-reachable baseline -> warn

if (pruned.length) {
  console.warn(`nav-reachability: ${pruned.length} baseline entr(y/ies) now reachable — prune with --update:`);
  for (const p of pruned) console.warn(`  ${p}`);
}
if (created.length) {
  console.error(`\nnav-reachability: ${created.length} NEW island(s) — page(s) no nav path reaches:`);
  for (const p of created) console.error(`  ${p}`);
  console.error(`\nFix: link the page from a hub / nav / directory (e.g. guides/index.html), or`);
  console.error(`if it is an intentional redirect shim add <meta http-equiv="refresh"> + robots noindex,`);
  console.error(`or (rarely) accept it as by-design with: node scripts/check-nav-reachability.mjs --update`);
  process.exit(1);
}
console.log(`nav-reachability: OK — 0 new islands (${islands.length} accepted in baseline, ${reach.size} pages reachable).`);
