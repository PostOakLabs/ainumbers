import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const chains = cg.chains || [];

const entries = chains.map(c => {
  let domain = 'Other';
  const n = c.name || '';
  if (n.startsWith('agent-economy-')) domain = 'Agent Economy';
  else if (n.startsWith('ai-governance-')) domain = 'AI Governance';
  else if (n.startsWith('treasury-clearing-')) domain = 'Treasury Clearing';
  else if (n.startsWith('wholesale-settlement-')) domain = 'Wholesale Settlement';
  else if (n.startsWith('settlement-discipline-')) domain = 'Settlement Discipline';
  else if (n.startsWith('digital-trade-')) domain = 'Digital Trade';
  else if (n.startsWith('cbam-')) domain = 'CBAM';
  else if (n.startsWith('sanctions-')) domain = 'Sanctions';
  else if (n.startsWith('export-control-')) domain = 'Export Control';

  const steps = (c.steps || []).length;
  const url = c.composer_url || '';
  let relUrl = url
    .replace('https://ainumbers.co/chaingraph/', '')
    .replace('https://ainumbers.co/', '../');
  if (!relUrl) relUrl = 'chains/' + c.name + '.html';
  const desc = (c.description || '').slice(0, 120);
  const title = c.title || c.name;
  return JSON.stringify({ n: c.name, t: title, d: desc, s: steps, u: relUrl, dom: domain });
});

const jsData = 'var CHAIN_INDEX=[' + entries.join(',') + '];';
const truth = chains.length;

// Embed directly into the hub (single-line CHAIN_INDEX block at ~line 2409).
const HUB = resolve(REPO, 'chaingraph', 'chaingraph-hub.html');
const hub = readFileSync(HUB, 'utf8');
const RE = /var CHAIN_INDEX=\[.*\];/; // no /s — block is one line; greedy to last ]; on that line
const m = hub.match(RE);
if (!m) { console.error('gen-chain-index: CHAIN_INDEX block not found in chaingraph-hub.html'); process.exit(2); }
const embedded = (m[0].match(/"n":"/g) || []).length;

// --check: freshness gate (hub embedded chains must equal chaingraph.json chains).
// Wired into CI + preflight so the hub can never silently drift behind a chain build.
if (process.argv.includes('--check')) {
  // Check BOTH the searchable CHAIN_INDEX and the displayed hero stats — the hero
  // is what a human sees, so it must be gated too (this is the 122-vs-200 bug).
  const heroIds = ['hub-total-n', 'hub-mcp-n', 'hub-eyebrow-n'];
  const heroBad = heroIds.filter(id => {
    const hm = hub.match(new RegExp(`id="${id}">(\\d+)`));
    return !hm || Number(hm[1]) !== truth;
  });
  if (embedded !== truth || heroBad.length) {
    console.error(`gen-chain-index --check FAIL: chaingraph.json has ${truth} chains; hub CHAIN_INDEX=${embedded}` +
      (heroBad.length ? `, stale hero stat(s): ${heroBad.join(', ')}` : '') +
      `. Run: node scripts/gen-chain-index.mjs`);
    process.exit(1);
  }
  console.log(`gen-chain-index --check: hub fresh (${truth} chains, hero stats match).`);
  process.exit(0);
}

// Write mode: re-embed the index + refresh the hero static fallbacks (the runtime
// JS overrides these from the live card count, but keep the static HTML honest too).
let out = hub.replace(RE, jsData)
  .replace(/(id="hub-total-n">)\d+/,   `$1${truth}`)
  .replace(/(id="hub-mcp-n">)\d+/,     `$1${truth}`)
  .replace(/(id="hub-eyebrow-n">)\d+/, `$1${truth}`);
writeFileSync(HUB, out);
console.log(`gen-chain-index: embedded ${truth} chains into chaingraph-hub.html (was ${embedded}).`);
