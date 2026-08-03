// gen-chaingraph-hub.mjs — renders the ~400 chaingraph/art-*.html node cards in
// chaingraph-hub.html from chaingraph.json + hub-categories.json. Mirrors gen-chain-index.mjs
// (GEN:-marker block, --check freshness gate). Closes HUB-GEN-1: 314 of 404 art-* node pages
// existed on disk + in chaingraph.json but had zero card in the hand-authored hub (only ~90
// carded) — check-nav-reachability never caught it because reachability != discoverability.
//
// hub-categories.json is the hand-editable grouping SSOT: { clusterTitle: {order, blurb,
// art_ids:[...]} }. chaingraph.json (node list/titles/descriptions) is untouched — read-only
// input. The --check coverage gate fails if any chaingraph.json art-* node is missing from
// hub-categories.json (an unmapped new node), forcing a cluster assignment before it can ship.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const categoriesPath = resolve(REPO, 'chaingraph', 'hub-categories.json');
const categories = JSON.parse(readFileSync(categoriesPath, 'utf8'));

const artNodes = cg.nodes.filter((n) => n.url && n.url.includes('/chaingraph/art-'));
const byId = new Map(artNodes.map((n) => [n.tool_id, n]));

// COVERAGE GATE: every art-* node in chaingraph.json must be mapped to a cluster.
const mappedIds = new Set();
for (const cluster of Object.values(categories)) {
  for (const id of cluster.art_ids) mappedIds.add(id);
}
const unmapped = artNodes.map((n) => n.tool_id).filter((id) => !mappedIds.has(id));

if (unmapped.length) {
  console.error(`gen-chaingraph-hub: ${unmapped.length} art-* node(s) in chaingraph.json are NOT in hub-categories.json (would ship undiscoverable):`);
  unmapped.forEach((id) => console.error(`  UNMAPPED: ${id}`));
  console.error('Assign each to a cluster in chaingraph/hub-categories.json, then regenerate.');
  process.exit(1);
}

// Report (not fail) mapped ids that no longer resolve to a chaingraph.json node or an
// on-disk file — a stale mapping entry (renamed/removed node) should be visible, but is not
// this gate's job to enforce (chaingraph.json is out of fence; removal is a separate WU).
const staleMapped = [];
for (const [title, cluster] of Object.entries(categories)) {
  for (const id of cluster.art_ids) {
    if (!byId.has(id)) staleMapped.push(`${id} (cluster "${title}")`);
  }
}
if (staleMapped.length) {
  console.warn(`gen-chaingraph-hub: WARNING ${staleMapped.length} hub-categories.json id(s) no longer resolve to a chaingraph.json node:`);
  staleMapped.forEach((s) => console.warn(`  STALE: ${s}`));
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// chaingraph.json descriptions are internal-facing; scrub CONTRACT §1.4 copy-hallmarks
// (em-dash, wave/W-x/D0 build jargon) before rendering as visible hub text, same as
// gen-chain-index.mjs's sanitizeCopy.
function sanitizeCopy(s) {
  return String(s)
    .replace(/\bWave \d+\b\s*/gi, '')
    .replace(/\bW-[A-F]\b\s*/g, '')
    .replace(/\bD0\b\s*/g, '')
    .replace(/\ban? honest\s+/gi, 'a ')
    .replace(/—/g, ', ')
    .replace(/\s+--\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Breaks on the last word boundary at or before `limit` so a truncated description
// never amputates mid-word (was cutting dates like "2 December 2026" to "2 December 2…").
function truncateOnWord(s, limit) {
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function artNum(id) {
  const m = id.match(/^art-(\d+)-/);
  return m ? parseInt(m[1], 10) : 999999;
}

function cardHtml(node) {
  const rel = node.url.replace('https://ainumbers.co/chaingraph/', '');
  const num = String(artNum(node.tool_id)).padStart(2, '0');
  const title = escHtml(sanitizeCopy(node.display_name || node.tool_id));
  const descClean = sanitizeCopy(node.description || '');
  const desc = escHtml(truncateOnWord(descClean, 220));
  const tags = [`<span class="ctag ctag-teal">${escHtml(node.mcp_name || '')}</span>`];
  if (node.mandate_type) tags.push(`<span class="ctag ctag-body">${escHtml(node.mandate_type)}</span>`);
  if (node.gpu) tags.push('<span class="ctag ctag-purple">GPU</span>');
  return `    <a href="${escHtml(rel)}" class="tool-card da">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-${num}</span><span class="card-arrow">→</span></div>
        <div class="card-name">${title}</div>
        <div class="card-desc">${desc}</div>
      </div>
      <div class="card-footer">
        <div class="card-tags">${tags.join('')}</div>
      </div>
    </a>`;
}

const clusterEntries = Object.entries(categories).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

const sectionsHtml = clusterEntries
  .map(([title, cluster]) => {
    const ids = cluster.art_ids.filter((id) => byId.has(id)).slice().sort((a, b) => artNum(a) - artNum(b));
    if (!ids.length) return '';
    const cards = ids.map((id) => cardHtml(byId.get(id))).join('\n\n');
    const blurb = escHtml(sanitizeCopy(cluster.blurb || ''));
    const guideLink = cluster.guide_url
      ? ` <a href="${escHtml(cluster.guide_url)}" style="color:var(--teal);border-bottom:1px solid rgba(20,184,166,.25)">&rarr; Guide hub &rarr;</a>`
      : '';
    return `  <div class="cat-heading" style="margin-top:36px">
    <h2 class="cat-name">${escHtml(title)}</h2>
    <span class="cat-n">${ids.length} tool${ids.length === 1 ? '' : 's'}</span>
  </div>
  <p class="cat-sub">${blurb}${guideLink}</p>
  <div class="tool-grid">

${cards}

  </div>`;
  })
  .filter(Boolean)
  .join('\n\n');

const totalCards = clusterEntries.reduce(
  (sum, [, c]) => sum + c.art_ids.filter((id) => byId.has(id)).length,
  0
);

const genBlock = `<!-- GEN:NODE-CARDS:START (generator-owned -- do not hand-edit; regenerate via node scripts/gen-chaingraph-hub.mjs) -->
${sectionsHtml}
  <!-- GEN:NODE-CARDS:END -->`;

const HUB = resolve(REPO, 'chaingraph', 'chaingraph-hub.html');
const hub = readFileSync(HUB, 'utf8');
const BLOCK_RE = /<!-- GEN:NODE-CARDS:START[\s\S]*?GEN:NODE-CARDS:END -->/;
const blockMatch = hub.match(BLOCK_RE);
if (!blockMatch) {
  console.error('gen-chaingraph-hub: GEN:NODE-CARDS markers not found in chaingraph-hub.html (run once by hand to bootstrap, see script header).');
  process.exit(2);
}
const embeddedCount = (blockMatch[0].match(/class="tool-card da"/g) || []).length;

if (process.argv.includes('--check')) {
  if (embeddedCount !== totalCards) {
    console.error(`gen-chaingraph-hub --check FAIL: expected ${totalCards} node cards, hub has ${embeddedCount}. Run: node scripts/gen-chaingraph-hub.mjs`);
    process.exit(1);
  }
  console.log(`gen-chaingraph-hub --check: hub fresh (${totalCards} node cards across ${clusterEntries.length} clusters, coverage OK).`);
  process.exit(0);
}

const out = hub.replace(BLOCK_RE, genBlock);
writeFileSync(HUB, out);
console.log(`gen-chaingraph-hub: rendered ${totalCards} node cards across ${clusterEntries.length} clusters into chaingraph-hub.html (was ${embeddedCount}).`);
