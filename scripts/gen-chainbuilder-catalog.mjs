import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT = resolve(REPO, 'chaingraph', 'data', 'chain-builder-catalog.gen.js');

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const nodes = cg.nodes || [];

// Per §1 of CHAINBUILDER-CATALOG-BUILD-SPEC.md: strip everything the palette UI
// doesn't need (compute_images, compute_proof, semantic_profile, deadline*,
// conformance_fixtures, wave) — those fields are large and irrelevant to a
// click-to-compose picker.
function slim(n) {
  return {
    tool_id: n.tool_id,
    display_name: n.display_name,
    mandate_type: n.mandate_type,
    url: n.url,
    description: String(n.description || '').slice(0, 140),
    consumes: n.consumes || [],
    feeds: n.feeds || [],
    status: n.status,
  };
}

const catalog = nodes
  .slice()
  .sort((a, b) => (a.tool_id || '').localeCompare(b.tool_id || ''))
  .map(slim);

const body = `// GENERATED FILE — do not hand-edit. Regenerate: node scripts/gen-chainbuilder-catalog.mjs
// Source: chaingraph.json (${catalog.length} nodes). Loaded via <script src> tag, not runtime
// fetch — see CHAINBUILDER-CATALOG-BUILD-SPEC.md §1 for why (CSP connect-src:'none').
window.CHAINBUILDER_CATALOG = ${JSON.stringify(catalog, null, 2)};
`;

if (process.argv.includes('--check')) {
  let existing;
  try {
    existing = readFileSync(OUT, 'utf8');
  } catch {
    console.error(`gen-chainbuilder-catalog --check FAIL: ${OUT} does not exist. Run: node scripts/gen-chainbuilder-catalog.mjs`);
    process.exit(1);
  }
  if (existing !== body) {
    console.error(`gen-chainbuilder-catalog --check FAIL: chain-builder-catalog.gen.js is stale against chaingraph.json (${catalog.length} nodes). Run: node scripts/gen-chainbuilder-catalog.mjs`);
    process.exit(1);
  }
  console.log(`gen-chainbuilder-catalog --check: fresh (${catalog.length} nodes).`);
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body);
console.log(`gen-chainbuilder-catalog: wrote ${catalog.length} nodes to ${OUT}.`);
