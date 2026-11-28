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
 *                                [--mcp-name <value>] [--with-page --category "<hub category name>"
 *                                                           (--hub "<slug>[,<slug>]" | --hub-exempt "<reason>")]
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
 *   --with-page      Emit chaingraph/<id>.html + chaingraph/hub-categories/<id>.json (--category
 *                    required, plus exactly one of --hub/--hub-exempt). DEFAULT IS OFF — see
 *                    "PAGE-LESS BY DEFAULT" below.
 *   --hub            Comma-separated guides-hub slugs written as "hubs" into the per-node
 *                    hub-categories file (HUB-AUTOSWEEP-SSOT-1). Requires --with-page.
 *                    Prints PENDING-HUB / NEW-HUB-REQUIRED for slugs whose guides/<slug>-hub.html
 *                    is absent (the 2+ live-node threshold, scoping doc §2(a)).
 *   --hub-exempt     Reason string written as "hub_exempt" (with "hubs": []) when the node
 *                    belongs to no guides hub. Requires --with-page; mutually exclusive with --hub.
 *
 * DECLARED FILE SET this command writes (SO #40(c) — `git status --porcelain` after one
 * run must touch exactly these paths, nothing else):
 *   chaingraph/graph/nodes/<id>.json
 *   chaingraph/graph/reservations/<art-n>.json   ({row, pr, reserved}; pass --row <ROW-ID>)
 *   chaingraph/kernels/<id>.kernel.mjs
 *   chaingraph/kernels/__proptests__/<id>.proptest.mjs
 *   chaingraph/kernels/fixtures/<id>.fixtures.json
 *   chaingraph/<id>.html + chaingraph/hub-categories/<id>.json   (ONLY with --with-page)
 *
 * NEVER WRITTEN, by design, regardless of flags: chaingraph.json, chaingraph.meta.json,
 * chaingraph/kernels/index.mjs. The kernel index is a main-regen single-writer artifact
 * (derived-artifacts.mjs id 'kernel-index'); scripts/check-main-only-paths.mjs refuses it in a
 * PR, and every PR-side gate that reads it passes without the new entry (measured on #2777's
 * head with the entry removed, 2026-11-03), so main's regen registers the kernel after merge.
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
import { HUB_SLUG_RE, resolveNodeHubs } from './_hub-categories.mjs';
import { loadStatusLens } from './_node-status.mjs';

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
  console.error('Usage: node scripts/new-kernel.mjs <art-id> <slug> [--class A|B|K] [--mandate-type <v>] [--mcp-name <v>] [--with-page --category "<name>" (--hub "<slug>[,<slug>]" | --hub-exempt "<reason>")]');
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
const HUB_FLAG = flag('hub', null); // "<slug>[,<slug>,...]" — names guides/<slug>-hub.html
const HUB_EXEMPT = flag('hub-exempt', null); // "<reason>" — explicit belong-to-no-hub opt-out
const ROW = flag('row', 'TODO-ROW'); // board row / branch that owns the id reservation; edit before push if left default
if (!WITH_PAGE && (HUB_FLAG !== null || HUB_EXEMPT !== null)) {
  console.error('✗ --hub/--hub-exempt require --with-page: they are written into chaingraph/hub-categories/<id>.json, which only --with-page emits.');
  process.exit(2);
}
if (WITH_PAGE && !CATEGORY) {
  console.error('✗ --with-page requires --category "<hub category name>" (must match a key in chaingraph/hub-categories.json).');
  process.exit(2);
}
// HUB-AUTOSWEEP-SSOT-1: exactly one hub decision accompanies every new page node —
// the topic SSOT resolves a node's hubs at creation time, never by a later sweep row.
if (WITH_PAGE && (HUB_FLAG === null) === (HUB_EXEMPT === null)) {
  console.error('✗ --with-page requires exactly ONE of --hub "<slug>[,<slug>]" or --hub-exempt "<reason>" alongside --category (HUB-AUTOSWEEP-SSOT-1).');
  process.exit(2);
}
const HUB_SLUGS = [];
if (HUB_FLAG !== null) {
  for (const raw of String(HUB_FLAG).split(',')) {
    const slug = raw.trim();
    if (!slug) continue;
    if (!HUB_SLUG_RE.test(slug)) {
      console.error(`✗ --hub "${slug}" is not a valid hub slug — it must match ${HUB_SLUG_RE} because it names guides/<slug>-hub.html.`);
      process.exit(2);
    }
    if (!HUB_SLUGS.includes(slug)) HUB_SLUGS.push(slug);
  }
  if (!HUB_SLUGS.length) {
    console.error('✗ --hub needs at least one slug (comma-separated).');
    process.exit(2);
  }
}
if (HUB_EXEMPT !== null && (typeof HUB_EXEMPT !== 'string' || HUB_EXEMPT.trim() === '')) {
  console.error('✗ --hub-exempt needs a non-empty "<reason>" string (why this node belongs to no guides hub).');
  process.exit(2);
}

// ── target paths ─────────────────────────────────────────────────────────────
const KERNEL_PATH = resolve(REPO, 'chaingraph', 'kernels', `${TOOL_ID}.kernel.mjs`);
const PROPTEST_PATH = resolve(REPO, 'chaingraph', 'kernels', '__proptests__', `${TOOL_ID}.proptest.mjs`);
const FIXTURES_PATH = resolve(REPO, 'chaingraph', 'kernels', 'fixtures', `${TOOL_ID}.fixtures.json`);
const SHARD_PATH = resolve(REPO, 'chaingraph', 'graph', 'nodes', `${TOOL_ID}.json`);
const PAGE_PATH = resolve(REPO, 'chaingraph', `${TOOL_ID}.html`);
const RESERVATION_PATH = resolve(REPO, 'chaingraph', 'graph', 'reservations', `${artId}.json`);
const HUB_CATEGORIES_PATH = resolve(REPO, 'chaingraph', 'hub-categories.json');
const HUB_NODE_PATH = resolve(REPO, 'chaingraph', 'hub-categories', `${TOOL_ID}.json`);

const declared = [KERNEL_PATH, PROPTEST_PATH, FIXTURES_PATH, SHARD_PATH, RESERVATION_PATH];
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
// Pin each stub vector's golden_hash with the repo's own executionHash() so VM-1a parity and
// golden-parity see a consistent fixture from the first commit (never a hand-built preimage).
const { executionHash } = await import(pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_hash.mjs')).href);
const fixturesDoc = JSON.parse(render('fixtures.template.json', { TOOL_ID }));
for (const v of fixturesDoc.vectors) {
  const golden = await executionHash(v.policy_parameters, v.output_payload);
  if (golden === null) {
    // HASH-REFUSAL-GUARDS-SCRIPTS-1: HASH-REFUSAL-SHARED-1 makes executionHash
    // return null on unhashable input. Fail loudly before anything is written —
    // never scaffold a fixtures file whose golden_hash is null.
    throw new Error(`new-kernel: executionHash returned null (unhashable stub vector) for ${TOOL_ID}.fixtures.json; refusing to write a null golden_hash`);
  }
  v.golden_hash = golden;
}
const fixturesContent = JSON.stringify(fixturesDoc, null, 2) + '\n';
const shardContent = render('shard.template.json', {
  TOOL_ID, DISPLAY_NAME, MCP_NAME, MANDATE_TYPE, WAVE, URL_SLUG, DIGEST, TODAY,
});
// shard.template.json's WAVE placeholder sits inside a JSON number literal (no quotes) —
// confirm the substitution produced valid JSON before writing anything to disk.
JSON.parse(shardContent);

let pageContent = null;
if (WITH_PAGE) {
  // The stamp line comes from check-page-kernel-digest.mjs's own emitter shape and the digest
  // from sourceDigest() above -- never hand-rolled (PAGE-KERNEL-DIGEST-SENTINEL-1).
  pageContent = render('node-page.template.txt', {
    TOOL_ID, DISPLAY_NAME, KERNEL_DIGEST_META: `<meta name="kernel-digest" content="${DIGEST}">`,
  });
}
// Reservation: one file per id (RESERVATIONS-REPOINT-1); the legacy RESERVATIONS.json is frozen.
const reservationContent = JSON.stringify({ row: ROW, pr: null, reserved: TODAY }, null, 2) + '\n';

// ── write (declared set only, in dependency order) ──────────────────────────
mkdirSync(dirname(PROPTEST_PATH), { recursive: true });
mkdirSync(dirname(FIXTURES_PATH), { recursive: true });
mkdirSync(dirname(SHARD_PATH), { recursive: true });
writeFileSync(KERNEL_PATH, kernelContent);
writeFileSync(PROPTEST_PATH, proptestContent);
writeFileSync(FIXTURES_PATH, fixturesContent);
writeFileSync(SHARD_PATH, shardContent);
mkdirSync(dirname(RESERVATION_PATH), { recursive: true });
writeFileSync(RESERVATION_PATH, reservationContent);
if (WITH_PAGE) {
  writeFileSync(PAGE_PATH, pageContent);
  // Membership is one file per node (HUB-CATEGORIES-DERIVE-1); the shared
  // chaingraph/hub-categories.json (key/order/blurb) is never edited here.
  const hub = JSON.parse(readFileSync(HUB_CATEGORIES_PATH, 'utf8'));
  if (!hub[CATEGORY]) {
    console.error(`✗ --category "${CATEGORY}" is not a key in chaingraph/hub-categories.json — pick an existing category (this script does not invent new categories).`);
    process.exit(1);
  }
  mkdirSync(dirname(HUB_NODE_PATH), { recursive: true });
  // HUB-AUTOSWEEP-SSOT-1: the hub decision rides along in the same per-node file.
  // The extra keys are invisible to every current reader (loadHubCategories()
  // destructures only "category"); resolveNodeHubs() is the one that reads them.
  const hubNode = { category: CATEGORY };
  if (HUB_SLUGS.length) hubNode.hubs = HUB_SLUGS;
  if (HUB_EXEMPT !== null) {
    hubNode.hubs = [];
    hubNode.hub_exempt = HUB_EXEMPT;
  }
  writeFileSync(HUB_NODE_PATH, JSON.stringify(hubNode, null, 2) + '\n');
}

// ── report ───────────────────────────────────────────────────────────────
console.log(`\n✓ scaffolded ${TOOL_ID} (class ${CLASS}, digest ${DIGEST}):`);
for (const p of [KERNEL_PATH, PROPTEST_PATH, FIXTURES_PATH, SHARD_PATH, RESERVATION_PATH, ...(WITH_PAGE ? [PAGE_PATH, HUB_NODE_PATH] : [])]) {
  console.log(`    ${p.replace(REPO + '\\', '').replace(REPO + '/', '')}`);
}

// ── HUB-AUTOSWEEP-SSOT-1: stage-time hub signal ─────────────────────────────
// For each requested slug whose guides/<slug>-hub.html does not exist yet, tell the
// builder where the topic stands BEFORE the autosweep gate does (scoping doc §2(a),
// Tim's 2+ threshold): the PR that brings a topic to its 2nd live node must create
// the hub page or point --hub at an existing slug; a 1-node topic is advisory only.
// The count is live nodes resolving to the slug through resolveNodeHubs(), filtered
// through the shard status lens (a departed node must not hold a topic at 1).
if (WITH_PAGE && HUB_SLUGS.length) {
  const cgPath = resolve(REPO, 'chaingraph', 'chaingraph.json');
  let liveIds = null; // no assembled graph (bare scaffold estate) -> count every member
  if (existsSync(cgPath)) {
    liveIds = new Set(loadStatusLens(REPO).liveNodes.map((n) => n.tool_id));
  }
  const resolved = resolveNodeHubs(REPO);
  for (const slug of HUB_SLUGS) {
    if (existsSync(resolve(REPO, 'guides', `${slug}-hub.html`))) continue;
    let count = 1; // the node this run is scaffolding
    for (const [id, entry] of resolved) {
      if (id === TOOL_ID) continue; // this run just wrote its own per-node file — not an existing member
      if (!entry.hubs.includes(slug)) continue;
      if (liveIds && !liveIds.has(id)) continue;
      count += 1;
    }
    if (count >= 2) {
      console.log(`NEW-HUB-REQUIRED ${slug} — guides/${slug}-hub.html is absent and ${TOOL_ID} is its ${count}th live node: create the hub page in this PR (prose shell + chrome is enough; the node GEN block fills on main) or point --hub at an existing slug.`);
    } else {
      console.log(`PENDING-HUB ${slug} — guides/${slug}-hub.html is absent, but the topic has ${count} live node so far; no hub page is required until a 2nd node picks the slug.`);
    }
  }
}
console.log(`\nNOT written (SO #35 single-writer): chaingraph/kernels/index.mjs. main's derived regen registers`);
console.log(`  ${TOOL_ID} there after merge; do not commit index.mjs (check-main-only-paths.mjs refuses it).`);
console.log(`NOT written (SO #35 single-writer — ASSEMBLE-LAND's job): chaingraph.meta.json order.nodes.`);
console.log(`  Whoever runs the next ASSEMBLE-LAND adds: "${TOOL_ID}" to chaingraph.meta.json's order.nodes array.`);
console.log(`\nNext steps:`);
console.log(`  1. Fill compute() in chaingraph/kernels/${TOOL_ID}.kernel.mjs (replace the SCAFFOLD-STUB body; keep null-as-absent reads, conditional flag pushes and the warnings mirror).`);
console.log(`  2. Replace the placeholder vector in chaingraph/kernels/fixtures/${TOOL_ID}.fixtures.json with real golden vectors.`);
console.log(`  3. Replace the placeholder property in chaingraph/kernels/__proptests__/${TOOL_ID}.proptest.mjs with real properties.`);
console.log(`  4. Cite primary text (SO #38) in chaingraph/graph/nodes/${TOOL_ID}.json's cited_clause_digest[], or set standards_basis to "not_applicable".`);
console.log(`  5. Run: node scripts/kernel-preflight.mjs ${TOOL_ID}   (repeat until READY)`);
