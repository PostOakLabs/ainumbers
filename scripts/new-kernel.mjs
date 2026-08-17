#!/usr/bin/env node
/**
 * scripts/new-kernel.mjs — KERNEL-SCAFFOLD-1.
 *
 * Emits every file a new kernel needs to start from a scaffold that passes
 * `kernel-preflight` before a single line of domain logic is written (Tim,
 * 2026-08-16: kernels "should work without issues the moment they are made").
 * Idempotent — refuses to overwrite any file it would emit.
 *
 * Usage:
 *   node scripts/new-kernel.mjs <art-id> <slug> [--class A|B|K] [--mandate-type <value>]
 *                                [--mcp-name <value>] [--with-page --category "<hub category name>"]
 *
 *   <art-id>   e.g. art-999            (no trailing slug)
 *   <slug>     e.g. scaffold-probe     tool_id becomes "<art-id>-<slug>"
 *   --class    A|B|K, floor-tightness label recorded in the proptest header comment
 *              (FV-PBT-FLOOR-BUILD-SPEC.md). Default: K.
 *   --mandate-type   chaingraph.json mandate_type. Default: compliance_control.
 *   --mcp-name       MCP tool name. Default: compute_<slug with _ instead of ->.
 *                    MUST be globally unique — this script does not check that; run
 *                    `node ../mcp-apps-poc/scripts/check-tool-names.mjs` after filling
 *                    compute() and before landing (CLAUDE.md's MCP invariant).
 *   --with-page      Emit chaingraph/<id>.html + a hub-categories.json entry (--category
 *                    required). DEFAULT IS OFF — see "PAGE-LESS BY DEFAULT" below.
 *
 * DECLARED FILE SET this command writes (SO #40(c) — `git status --porcelain` after one
 * run must touch exactly these paths, nothing else):
 *   chaingraph/graph/nodes/<id>.json
 *   chaingraph/kernels/<id>.kernel.mjs
 *   chaingraph/kernels/__proptests__/<id>.proptest.mjs
 *   chaingraph/kernels/fixtures/<id>.fixtures.json
 *   chaingraph/kernels/index.mjs                  (regenerated via gen-index.mjs --write)
 *   chaingraph/<id>.html + chaingraph/hub-categories.json   (ONLY with --with-page)
 *
 * NEVER WRITTEN, by design, regardless of flags: chaingraph.json, chaingraph.meta.json.
 * `order.nodes` registration is SO #35's single-writer artifact — it belongs to
 * ASSEMBLE-LAND, never a kernel row (RIDER-KERNEL.md SO #6/#35). This script prints the
 * exact line the assemble row runs instead of writing it.
 *
 * PAGE-LESS BY DEFAULT — a deliberate deviation from this row's originally-drafted "emit
 * a page unless --no-page" framing (board/queued/KERNEL-SCAFFOLD-1.md's own text). Memory
 * `project-ainumbers-kernel-shard-row-ships-pageless` (2026-08-14) and every node shipped
 * since (art-598..art-627) are page-less: a brand-new chaingraph/art-*.html page trips
 * NAV-ISLAND-1 (nothing links to it yet) and a shard row has no legal fix for that — the
 * only two fixes are chaingraph-hub.html (generated from chaingraph.json, forbidden to a
 * kernel row) and nav-island-baseline.json (an SO #35 single-writer artifact). A scaffold
 * that emits a page by DEFAULT would therefore fail its own acceptance test's
 * expected-✗-only-set proof, which is decisive: this file defaults to page-less and
 * --with-page is the opt-in for the rare full-showcase-page case, inverting the row
 * text's literal default rather than shipping a scaffold whose default output cannot
 * pass kernel-preflight.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const TEMPLATES = resolve(HERE, 'kernel-templates');

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const flag = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? (argv[i + 1] ?? true) : def;
};

const [artId, slug] = positional;
if (!artId || !slug) {
  console.error('Usage: node scripts/new-kernel.mjs <art-id> <slug> [--class A|B|K] [--mandate-type <v>] [--mcp-name <v>] [--with-page --category "<name>"]');
  process.exit(2);
}

const TOOL_ID = `${artId}-${slug}`;
const KERNEL_RE = /^[a-z0-9][a-z0-9-]*$/;
if (!KERNEL_RE.test(TOOL_ID)) {
  console.error(`✗ "${TOOL_ID}" is not a valid tool_id — must match ${KERNEL_RE} (lowercase, digits, hyphens only; gen-index.mjs's own allowlist).`);
  process.exit(2);
}

const CLASS = String(flag('class', 'K')).toUpperCase();
if (!['A', 'B', 'K'].includes(CLASS)) {
  console.error(`✗ --class must be A, B, or K (got "${CLASS}").`);
  process.exit(2);
}
const MANDATE_TYPE = flag('mandate-type', 'compliance_control');
const MCP_NAME = flag('mcp-name', `compute_${slug.replace(/-/g, '_')}`);
const WITH_PAGE = argv.includes('--with-page');
const CATEGORY = flag('category', null);
if (WITH_PAGE && !CATEGORY) {
  console.error('✗ --with-page requires --category "<hub category name>" (must match a key in chaingraph/hub-categories.json).');
  process.exit(2);
}

// ── target paths ─────────────────────────────────────────────────────────────
const KERNEL_PATH = resolve(REPO, 'chaingraph', 'kernels', `${TOOL_ID}.kernel.mjs`);
const PROPTEST_PATH = resolve(REPO, 'chaingraph', 'kernels', '__proptests__', `${TOOL_ID}.proptest.mjs`);
const FIXTURES_PATH = resolve(REPO, 'chaingraph', 'kernels', 'fixtures', `${TOOL_ID}.fixtures.json`);
const SHARD_PATH = resolve(REPO, 'chaingraph', 'graph', 'nodes', `${TOOL_ID}.json`);
const PAGE_PATH = resolve(REPO, 'chaingraph', `${TOOL_ID}.html`);
const HUB_CATEGORIES_PATH = resolve(REPO, 'chaingraph', 'hub-categories.json');

const declared = [KERNEL_PATH, PROPTEST_PATH, FIXTURES_PATH, SHARD_PATH];
if (WITH_PAGE) declared.push(PAGE_PATH);

const existing = declared.filter((p) => existsSync(p));
if (existing.length) {
  console.error(`✗ refusing to overwrite — already exist:\n${existing.map((p) => `    ${p}`).join('\n')}`);
  console.error(`  (${TOOL_ID} may already be scaffolded, or a slug collides with an existing kernel.)`);
  process.exit(1);
}

// ── derived values ──────────────────────────────────────────────────────────
const DISPLAY_NAME = slug.split('-').map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const numericPrefix = artId.match(/^(?:art-)?(\d+)$/) ? artId.replace(/^art-/, '') : artId;
const URL_SLUG = `${numericPrefix}-${slug}`;
const TODAY = new Date().toISOString().slice(0, 10);

function maxExistingWave() {
  const dir = resolve(REPO, 'chaingraph', 'graph', 'nodes');
  let max = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const w = JSON.parse(readFileSync(resolve(dir, f), 'utf8')).wave;
      if (typeof w === 'number' && w > max) max = w;
    } catch { /* skip unparsable */ }
  }
  return max;
}
const WAVE = maxExistingWave() + 1;

function render(templateName, vars) {
  let text = readFileSync(resolve(TEMPLATES, templateName), 'utf8');
  for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(String(v));
  const leftover = text.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) throw new Error(`render(${templateName}): unsubstituted placeholder ${leftover[0]} — a var is missing from the vars map.`);
  return text;
}

// ── build kernel.mjs first — its byte content is what the digest binds to ──
const kernelContent = render('kernel.template.mjs', { TOOL_ID, MCP_NAME, MANDATE_TYPE });

const { sourceDigest } = await import(pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_buildid.mjs')).href);
const DIGEST = await sourceDigest(kernelContent);

const proptestContent = render('proptest.template.mjs', { TOOL_ID, CLASS, DIGEST });
const fixturesContent = render('fixtures.template.json', { TOOL_ID });
const shardContent = render('shard.template.json', {
  TOOL_ID, DISPLAY_NAME, MCP_NAME, MANDATE_TYPE, WAVE, URL_SLUG, DIGEST, TODAY,
});
// shard.template.json's WAVE placeholder sits inside a JSON number literal (no quotes) —
// confirm the substitution produced valid JSON before writing anything to disk.
JSON.parse(shardContent);

let pageContent = null;
if (WITH_PAGE) {
  pageContent = render('node-page.template.txt', { TOOL_ID, DISPLAY_NAME });
}

// ── write (declared set only, in dependency order) ──────────────────────────
mkdirSync(dirname(PROPTEST_PATH), { recursive: true });
mkdirSync(dirname(FIXTURES_PATH), { recursive: true });
mkdirSync(dirname(SHARD_PATH), { recursive: true });
writeFileSync(KERNEL_PATH, kernelContent);
writeFileSync(PROPTEST_PATH, proptestContent);
writeFileSync(FIXTURES_PATH, fixturesContent);
writeFileSync(SHARD_PATH, shardContent);
if (WITH_PAGE) {
  writeFileSync(PAGE_PATH, pageContent);
  const hub = JSON.parse(readFileSync(HUB_CATEGORIES_PATH, 'utf8'));
  if (!hub[CATEGORY]) {
    console.error(`✗ --category "${CATEGORY}" is not a key in chaingraph/hub-categories.json — pick an existing category (kernel-preflight's own hub-categories check reads this file verbatim; this script does not invent new categories).`);
    process.exit(1);
  }
  if (!Array.isArray(hub[CATEGORY].art_ids)) hub[CATEGORY].art_ids = [];
  if (!hub[CATEGORY].art_ids.includes(TOOL_ID)) hub[CATEGORY].art_ids.push(TOOL_ID);
  writeFileSync(HUB_CATEGORIES_PATH, JSON.stringify(hub, null, 2) + '\n');
}

// chaingraph/kernels/index.mjs — regenerated, never hand-edited (CONTRACT.md §A4).
execFileSync(process.execPath, [resolve(REPO, 'chaingraph', 'kernels', 'gen-index.mjs'), '--write'], { cwd: REPO, stdio: 'inherit' });

// ── report ───────────────────────────────────────────────────────────────
console.log(`\n✓ scaffolded ${TOOL_ID} (class ${CLASS}, digest ${DIGEST}):`);
for (const p of [KERNEL_PATH, PROPTEST_PATH, FIXTURES_PATH, SHARD_PATH, ...(WITH_PAGE ? [PAGE_PATH, HUB_CATEGORIES_PATH] : [])]) {
  console.log(`    ${p.replace(REPO + '\\', '').replace(REPO + '/', '')}`);
}
console.log('    chaingraph/kernels/index.mjs (regenerated)');
console.log(`\nNOT written (SO #35 single-writer — ASSEMBLE-LAND's job): chaingraph.meta.json order.nodes.`);
console.log(`  Whoever runs the next ASSEMBLE-LAND adds: "${TOOL_ID}" to chaingraph.meta.json's order.nodes array.`);
console.log(`\nNext steps:`);
console.log(`  1. Fill compute() in chaingraph/kernels/${TOOL_ID}.kernel.mjs (replace the NOT_IMPLEMENTED throw).`);
console.log(`  2. Replace the placeholder vector in chaingraph/kernels/fixtures/${TOOL_ID}.fixtures.json with real golden vectors.`);
console.log(`  3. Replace the placeholder property in chaingraph/kernels/__proptests__/${TOOL_ID}.proptest.mjs with real properties.`);
console.log(`  4. Cite primary text (SO #38) in chaingraph/graph/nodes/${TOOL_ID}.json's cited_clause_digest[], or set standards_basis to "not_applicable".`);
console.log(`  5. Run: node scripts/kernel-preflight.mjs ${TOOL_ID}   (repeat until READY)`);
