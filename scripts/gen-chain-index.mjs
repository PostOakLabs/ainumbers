import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const chains = cg.chains || [];

// Resolve a chain's composer page to a hub-relative path. The hub lives in chaingraph/,
// so resolve against that dir.
function composerRel(c) {
  let rel = (c.composer_url || '')
    .replace('https://ainumbers.co/chaingraph/', '')
    .replace('https://ainumbers.co/', '../');
  if (!rel) rel = 'chains/' + c.name + '.html';
  return rel;
}

// Composer-existence gate: every chain must have an on-disk composer page. A chain added
// to chaingraph.json without authoring its composer HTML would ship a dangling hub card.
const missingComposers = chains
  .map((c) => ({ name: c.name, rel: composerRel(c) }))
  .filter((x) => !existsSync(resolve(REPO, 'chaingraph', x.rel)));
if (missingComposers.length) {
  console.error(`gen-chain-index: ${missingComposers.length} chain(s) reference a composer page that does not exist on disk (would ship a dangling hub card):`);
  missingComposers.forEach((x) => console.error(`  MISSING: ${x.name} -> ${x.rel}`));
  console.error('Author the composer HTML page(s) before regenerating the hub.');
  process.exit(1);
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// chaingraph.json descriptions are internal build-tracking copy (written for ORCH, served
// to agents over MCP where build jargon is fine) — this generator renders them as VISIBLE
// reader-facing text for the first time, so scrub CONTRACT §1.4 copy-hallmarks (em-dash,
// W-[A-F]/D0 wave badge codes) before display. The underlying chaingraph.json is untouched.
function sanitizeCopy(s) {
  return String(s)
    .replace(/^W-[A-F] chain\.\s*/, '')
    .replace(/\bW-[A-F]\b\s*/g, '')
    .replace(/\bD0\b\s*/g, '')
    .replace(/—/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const truth = chains.length;

// GEN:MORE-CHAINS block — statically renders EVERY chain's composer page as a clickable
// .tool-card, reusing the hub's existing (already-styled) tool-card CSS. This is separate
// from the 122 hand-curated individual-tool cards above it (those link to single-tool
// pages, not chain composer pages, and are out of this generator's fence).
const cardsHtml = chains
  .slice()
  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  .map((c) => {
    const rel = composerRel(c);
    const title = escHtml(sanitizeCopy(c.title || c.name));
    const descClean = sanitizeCopy(c.description || '');
    const descRaw = descClean.slice(0, 140);
    const desc = escHtml(descRaw) + (descClean.length > 140 ? '…' : '');
    const steps = (c.steps || []).length;
    const stepLabel = steps ? `${steps}-step chain` : 'chain';
    const domain = escHtml(c.domain);
    return `    <a href="${escHtml(rel)}" class="tool-card">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">${escHtml(stepLabel)}</span><span class="card-arrow">→</span></div>
        <div class="card-name">${title}</div>
        <div class="card-desc">${desc}</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-body">${domain}</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>`;
  })
  .join('\n\n');

const genBlock =
`<!-- GEN:MORE-CHAINS:START (generator-owned — do not hand-edit; regenerate via node scripts/gen-chain-index.mjs) -->
  <div class="cat-heading" style="margin-top:36px">
    <span class="cat-tag-label" style="border-color:rgba(20,184,166,.3);color:var(--teal)">All Chains</span>
    <h2 class="cat-name">OpenChainGraph Composed Workflows</h2>
    <span class="cat-n">${truth} chains</span>
  </div>
  <p class="cat-sub">Every multi-step workflow in chaingraph.json, generator-maintained: new chains appear here automatically on the next regenerate.</p>
  <div class="tool-grid">

${cardsHtml}

  </div>
  <!-- GEN:MORE-CHAINS:END -->`;

const HUB = resolve(REPO, 'chaingraph', 'chaingraph-hub.html');
const hub = readFileSync(HUB, 'utf8');
const BLOCK_RE = /<!-- GEN:MORE-CHAINS:START[\s\S]*?GEN:MORE-CHAINS:END -->/;
const blockMatch = hub.match(BLOCK_RE);
if (!blockMatch) {
  console.error('gen-chain-index: GEN:MORE-CHAINS markers not found in chaingraph-hub.html');
  process.exit(2);
}
const embeddedCount = (blockMatch[0].match(/class="tool-card"/g) || []).length;

// --check: freshness gate. Verifies BOTH the hero stats a human sees AND the actual
// rendered card grid a human can click — the prior version only checked the hero
// number + an orphaned JS array, which is exactly how the hub drifted to 122/290
// (58% of chains undiscoverable) undetected for weeks.
if (process.argv.includes('--check')) {
  const heroIds = ['hub-total-n', 'hub-mcp-n', 'hub-eyebrow-n'];
  const heroBad = heroIds.filter((id) => {
    const hm = hub.match(new RegExp(`id="${id}">(\\d+)`));
    return !hm || Number(hm[1]) !== truth;
  });
  if (embeddedCount !== truth || heroBad.length) {
    console.error(`gen-chain-index --check FAIL: chaingraph.json has ${truth} chains; hub rendered card grid=${embeddedCount}` +
      (heroBad.length ? `, stale hero stat(s): ${heroBad.join(', ')}` : '') +
      `. Run: node scripts/gen-chain-index.mjs`);
    process.exit(1);
  }
  console.log(`gen-chain-index --check: hub fresh (${truth} chains, ${embeddedCount} rendered cards, hero stats match).`);
  process.exit(0);
}

// Write mode: re-render the full chain-card grid + refresh the hero static fallbacks.
let out = hub.replace(BLOCK_RE, genBlock)
  .replace(/(id="hub-total-n">)\d+/, `$1${truth}`)
  .replace(/(id="hub-mcp-n">)\d+/, `$1${truth}`)
  .replace(/(id="hub-eyebrow-n">)\d+/, `$1${truth}`);
writeFileSync(HUB, out);
console.log(`gen-chain-index: rendered ${truth} chain cards into chaingraph-hub.html (was ${embeddedCount}).`);
