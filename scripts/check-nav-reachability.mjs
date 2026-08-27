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
//                           HUMAN use only: it ACCEPTS every current island.
//        --prune            regen mode for derived-artifacts-regen.yml: removes
//                           now-reachable entries, never adds. Exit 0.
//        --baseline-check   the DERIVED-ARTIFACT freshness gate: exit 1 iff a
//                           baseline entry is now reachable (baseline stale);
//                           new islands are reported but do NOT fail here.
//
// ⚠ TWO GATES, TWO OWNERS — do not fold them back together. Measured 2026-08-16:
// PR #1309 shipped chaingraph/integrator-profile.html with no inbound link, and
// its PR CI stayed green because this whole command was registered as the
// nav-island *derived-artifact* gate (advisory on a PR, since the baseline is
// single-writer on main). But a NEW island is not derived drift — it is a
// content defect the PR itself must fix, and the main-side regen cannot fix it
// (--update would merely baseline the defect). So:
//   plain (no flag)     -> new islands FAIL, hard, in EVERY context (PR + main)
//   --baseline-check    -> stale baseline FAILS; advisory on PR, blocking on
//                          main, repaired by derived-artifacts-regen.yml
//
// ⚠ NAV-ISLAND-PENDING-ASSEMBLE-1 (2026-08-22) — PENDING-ASSEMBLE ACCOMMODATION.
// A class-K row ships its node page in the SAME PR as the node shard
// (RIDER-KERNEL K-FULL), but registering that shard into chaingraph.json is
// main-side single-writer (SO #35) — the PR that adds the page cannot also
// make it reachable, because this gate's only DYNAMIC root is chaingraph.json
// itself (see "dynamic" above). Without an accommodation every K row reds this
// gate by construction. The fix mirrors scripts/check-shard-assembly.mjs's own
// SHARD-GATE-PRE-ASSEMBLE-1 branch-awareness rather than reinventing it: a
// candidate island page chaingraph/<id>.html whose shard
// chaingraph/graph/nodes/<id>.json exists on disk is checked against THAT
// gate's own PENDING-ASSEMBLE classification (shelled to, output parsed — see
// pendingAssembleNodeIds() below, the same reuse pattern
// check-node-complete.mjs's checkRegistration() already uses; no second copy
// of the base-ref / assembling-branch git logic lives here, per SO #34). Only
// a page whose shard is genuinely mid-flight (absent from the base ref, not
// registered, branch not itself assembling) is excused — a page whose shard
// is leaked, orphaned, schema-invalid, or already registered is NOT in that
// section and stays a real island. Excused pages are never added to the
// baseline: they are not islands yet, not islands the reader should accept.
//
// --changed <REF> (PREREQ-CHANGED-SCOPING-1, B6 of GATE-MANIFEST-DRAFT.md §1),
// PLAIN check mode only. Reachability is a GRAPH property, not a per-file
// property, so the graph itself is still built from every page on disk —
// that read is unavoidable for a correct global answer and is not what makes
// this gate expensive for a builder session; the noise is the FAILURE
// REPORT. So --changed narrows what can FAIL the gate to NEW islands that
// are themselves a touched page, the same "does this property hold for a
// touched file" shape every other --changed gate uses. Known scope gap,
// stated plainly rather than hidden: a touched file that removes the ONLY
// inbound link to an UNTOUCHED page turns that page into a new island too;
// such a case is surfaced as an advisory (not a failure) under --changed so
// it is never silently dropped — run without --changed for the hard check.
// Undeterminable diff falls back to a FULL scan (fail-open, safe-by-cost) —
// never combined with --init/--update/--prune/--baseline-check, which are
// already whole-estate operations by design.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveChangedScope, isTouched } from './_changed-files-lib.js';

const ROOT = process.env.NAV_ROOT ? resolve(process.env.NAV_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = process.env.NAV_BASELINE ? resolve(process.env.NAV_BASELINE)
  : join(ROOT, 'scripts', 'nav-island-baseline.json');
const MODE = (process.argv.includes('--init') || process.argv.includes('--update')) ? 'update'
  : process.argv.includes('--prune') ? 'prune'
  : process.argv.includes('--baseline-check') ? 'baseline-check'
  : 'check';
const changedArgIdx = process.argv.indexOf('--changed');
const changedRef = changedArgIdx !== -1 ? process.argv[changedArgIdx + 1] : null;
const CHANGED = MODE === 'check'
  ? resolveChangedScope(changedRef, { gate: 'check-nav-reachability.mjs (B6)', failClosed: false })
  : null;

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

const preIslands = [...ALL].filter(p => !reach.has(p) && !isSitemap(p) && !isShim(p));

// NAV-ISLAND-PENDING-ASSEMBLE-1 (see header note). A node page's id is its
// filename minus extension -- only a match against a REAL on-disk shard is a
// candidate; an unrelated page never even reaches the shard-assembly shell-out.
function nodeShardIdForPage(p) {
  const m = /^chaingraph\/([^/]+)\.html?$/i.exec(p);
  if (!m) return null;
  const id = m[1];
  return existsSync(join(ROOT, 'chaingraph', 'graph', 'nodes', `${id}.json`)) ? id : null;
}

const SHARD_ASSEMBLY_SCRIPT = join(ROOT, 'scripts', 'check-shard-assembly.mjs');

// Reuse, not reimplementation (SO #34): shell to check-shard-assembly.mjs --
// the script that already draws the branch-aware PENDING-ASSEMBLE distinction
// from git -- and parse ITS OWN printed PENDING-ASSEMBLE section. Output is
// captured whether the child exits 0 or 1 (a leaked shard elsewhere, or a
// schema failure, still exits 1 while printing a perfectly good PENDING-
// ASSEMBLE section for an unrelated id). If the child cannot even run, no
// section is found and nothing is excused -- fails closed, same as the gate
// it reuses (SO #34c: a missing result is a distinct state, never a green one).
function pendingAssembleNodeIds() {
  let out = '';
  try {
    out = execFileSync('node', [SHARD_ASSEMBLY_SCRIPT], { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  const ids = new Set();
  let inPending = false;
  for (const line of out.split('\n')) {
    if (/^check-shard-assembly: PENDING-ASSEMBLE —/.test(line)) { inPending = true; continue; }
    if (inPending) {
      const m = /^\s*-\s+(\S+)\s/.exec(line);
      if (m) { ids.add(m[1]); continue; }
      inPending = false;
    }
  }
  return ids;
}

const candidateNodePages = preIslands
  .map(p => ({ p, id: nodeShardIdForPage(p) }))
  .filter(x => x.id);

const excused = new Set();
if (candidateNodePages.length > 0) {
  const pending = pendingAssembleNodeIds();
  for (const { p, id } of candidateNodePages) if (pending.has(id)) excused.add(p);
  if (excused.size > 0) {
    console.log(`nav-reachability: ${excused.size} page(s) excused as PENDING-ASSEMBLE (NAV-ISLAND-PENDING-ASSEMBLE-1, per check-shard-assembly.mjs) -- not an island yet, and not added to the baseline:`);
    for (const p of [...excused].sort()) console.log(`  ${p}`);
  }
}

const islands = preIslands.filter(p => !excused.has(p)).sort();

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

if (MODE === 'prune') {
  // The REGEN mode for the main-side derived-artifacts workflow. It may only
  // REMOVE entries that became reachable — never ADD. `--update` accepts every
  // current island, so an unlinked page that slipped onto main would be
  // baselined by the bot within a minute (regen and html-verify run in
  // parallel on push-to-main). Measured 2026-08-16: bot commit 130b63db
  // accepted chaingraph/integrator-profile.html this way. Islands are a
  // human decision (--update, deliberately, on main); pruning is mechanical.
  const kept = baseline.filter(p => isSet.has(p));
  if (created.length) {
    console.warn(`nav-reachability(--prune): ${created.length} NEW island(s) NOT added — a new island is a content defect, fix the link (or a human runs --update deliberately):`);
    for (const p of created) console.warn(`  ${p}`);
  }
  if (kept.length !== baseline.length) {
    writeFileSync(BASELINE, JSON.stringify(kept, null, 2) + '\n');
    console.log(`nav-reachability(--prune): removed ${baseline.length - kept.length} now-reachable entr(y/ies) -> ${rel(BASELINE)} (${kept.length} remain).`);
  } else {
    console.log(`nav-reachability(--prune): nothing to prune (${baseline.length} accepted island(s)).`);
  }
  process.exit(0);
}

if (MODE === 'baseline-check') {
  // Derived-artifact freshness only. Stale baseline -> exit 1 (main-side regen
  // repairs it). New islands are surfaced for the reader but belong to the
  // plain gate, which is hard in every context.
  if (created.length) {
    console.warn(`nav-reachability(--baseline-check): ${created.length} NEW island(s) present — that is the PLAIN gate's failure, not this one's:`);
    for (const p of created) console.warn(`  ${p}`);
  }
  if (pruned.length) {
    console.error(`nav-reachability(--baseline-check): baseline STALE — ${pruned.length} entr(y/ies) now reachable; derived-artifacts-regen.yml prunes this on main (or --update locally on main only):`);
    for (const p of pruned) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`nav-reachability(--baseline-check): OK — baseline fresh (${islands.length} accepted island(s)).`);
  process.exit(0);
}

if (pruned.length) {
  console.warn(`nav-reachability: ${pruned.length} baseline entr(y/ies) now reachable — prune with --update:`);
  for (const p of pruned) console.warn(`  ${p}`);
}
// --changed scoping: only a NEW island that is ITSELF a touched page fails
// here (see header note on the scope gap). Untouched new islands are still
// surfaced, as an advisory, so --changed never silently drops a real finding.
const createdFailing = CHANGED ? created.filter(p => isTouched(p, CHANGED)) : created;
const createdOutsideScope = CHANGED ? created.filter(p => !isTouched(p, CHANGED)) : [];
if (createdOutsideScope.length) {
  console.warn(`nav-reachability(--changed): ${createdOutsideScope.length} NEW island(s) found OUTSIDE the touched scope — not failed here, run without --changed to enforce:`);
  for (const p of createdOutsideScope) console.warn(`  ${p}`);
}
if (createdFailing.length) {
  console.error(`\nnav-reachability: ${createdFailing.length} NEW island(s) — page(s) no nav path reaches:`);
  for (const p of createdFailing) console.error(`  ${p}`);
  console.error(`\nFix: link the page from a hub / nav / directory (e.g. guides/index.html), or`);
  console.error(`if it is an intentional redirect shim add <meta http-equiv="refresh"> + robots noindex,`);
  console.error(`or (rarely) accept it as by-design with: node scripts/check-nav-reachability.mjs --update`);
  process.exit(1);
}
console.log(`nav-reachability: OK — 0 new islands${CHANGED ? ' in touched scope' : ''} (${islands.length} accepted in baseline, ${reach.size} pages reachable).`);
