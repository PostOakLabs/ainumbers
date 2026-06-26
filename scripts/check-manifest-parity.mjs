// check-manifest-parity.mjs — fail if a ChainGraph node's HTML inline
// MANIFEST.mcp_tool_definition.name drifts from the node's mcp_name in chaingraph.json.
// The HTML MANIFEST name is the registration key the page advertises; if it disagrees with the
// canonical chaingraph.json mcp_name, agents see two different tool names for one node (art-22
// shipped with a stale 'compare_agentic_payment_protocols' vs the real 'compare_agentic_rail_protocols',
// found by hand on 2026-06-25). This catches that drift deterministically before deploy.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CG = resolve(HERE, '..', 'chaingraph');
const cg = JSON.parse(readFileSync(resolve(CG, 'chaingraph.json'), 'utf8'));

// Matches both the JSON-quoted form ("mcp_tool_definition":{..."name":"x"}) and the older
// JS-literal form (mcp_tool_definition:{name:'x'}) — quoted/unquoted keys, single/double quotes.
const NAME_RE = /["']?mcp_tool_definition["']?\s*:\s*\{[^}]*?["']?name["']?\s*:\s*["']([^"']+)["']/;
const fails = [];
let checked = 0, noHtml = 0, noManifest = 0;

for (const n of cg.nodes ?? []) {
  if (!n.mcp_name) continue;
  const html = resolve(CG, n.tool_id + '.html');
  if (!existsSync(html)) { noHtml++; continue; }
  const src = readFileSync(html, 'utf8');
  const m = src.match(NAME_RE);
  if (!m) { noManifest++; continue; }
  checked++;
  if (m[1] !== n.mcp_name)
    fails.push(`${n.tool_id}: HTML MANIFEST name "${m[1]}" != chaingraph.json mcp_name "${n.mcp_name}"`);
}

if (fails.length) {
  console.error(`✗ manifest-parity FAILED (${fails.length}) — HTML MANIFEST name drifted from chaingraph.json mcp_name:`);
  for (const f of fails) console.error('  • ' + f);
  console.error('\nMake the node HTML\'s MANIFEST.mcp_tool_definition.name EXACTLY equal the chaingraph.json mcp_name.');
  process.exit(1);
}
console.log(`✓ manifest-parity clean — ${checked} node HTML MANIFEST names match chaingraph.json mcp_name (${noHtml} no-HTML, ${noManifest} no-MANIFEST skipped).`);
