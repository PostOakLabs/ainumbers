// check-shipped-prose.mjs — fail the build if any shipped chaingraph.json chain/node description
// or title contains internal build jargon (a "Wave N" / "W-x" reference) or a DEPRECATED cryptic
// slug-stem that the engagement-naming wave renamed (tcm-/wts-/aer-/aig-/cbm-/sanc-/sd-/ec-).
// User-facing registry copy must use the spelled-out chain/domain names, not build-wave numbers or
// the dead cryptic slugs. This was a recurring manual nit (CONTRACT §A3.3, memory
// project-ainumbers-engagement-naming-wave) — now deterministic + gated.
//
// Note: legitimate domain acronyms are NOT flagged — only the wave-N pattern and the specific
// deprecated slug-stems followed by `-*` or `-<lowercase>` (DTC/MiCA/etc. are not in the list).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const cg = JSON.parse(readFileSync(resolve(HERE, '..', 'chaingraph', 'chaingraph.json'), 'utf8'));

const FORBIDDEN = /\bwave[- ]?\d+\b|\b(?:tcm|wts|aer|aig|cbm|sanc|sd|ec)-(?:\*|[a-z])/i;
const hits = [];
const check = (kind, id, text) => {
  const m = (text || '').match(FORBIDDEN);
  if (m) hits.push(`${kind} ${id}: "${m[0]}" — in "${(text || '').slice(0, 90)}…"`);
};
for (const n of cg.nodes ?? []) check('node', n.tool_id, n.description);
for (const c of cg.chains ?? []) { check('chain', c.name, c.description); check('chain-title', c.name, c.title); }

if (hits.length) {
  console.error(`✗ shipped-prose FAILED (${hits.length}) — internal build jargon / deprecated slugs in user-facing copy:`);
  for (const h of hits) console.error('  • ' + h);
  console.error('\nUse the spelled-out chain/domain name; drop "Wave N" / "W-x" and the dead tcm-/wts-/aer-/aig-/cbm-/sanc-/sd-/ec- slugs.');
  console.error('(CONTRACT §A3.3; memory project-ainumbers-engagement-naming-wave.)');
  process.exit(1);
}
console.log(`✓ shipped-prose clean — ${(cg.nodes ?? []).length} node + ${(cg.chains ?? []).length} chain descriptions, no build jargon / deprecated slugs.`);
