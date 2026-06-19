// add-export-capability.mjs — back-fill export_capability on chaingraph.json nodes (OCG §13.10).
// Enables hard per-node format gating in the Worker's isFormatAllowed() (a node with a
// non-empty export_capability allows ONLY the listed formats).
//
// Default set is the universally-working formats: xlsx, csv, pdf, and xbrl via ocg-ext.
// (eba-corep-* xbrl entries are intentionally NOT added — those taxonomies are guarded
// until their concept maps are populated; advertising them would be misleading.)
//
// Usage (run from repo root):
//   node chaingraph/add-export-capability.mjs            # DRY RUN — prints what would change
//   node chaingraph/add-export-capability.mjs --write    # writes chaingraph.json
//   node chaingraph/add-export-capability.mjs --force     # also overwrite existing export_capability
//
// After --write: re-vendor (cd ../mcp-apps-poc && node generate.mjs) and commit
// chaingraph.json + data/ in the same push (CONTRACT §A4).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CG = resolve(HERE, 'chaingraph.json');
const WRITE = process.argv.includes('--write');
const FORCE = process.argv.includes('--force');

// Default capability set. Override per mandate_type below if you want to narrow/extend.
const DEFAULT = ['xlsx', 'csv', 'pdf', 'xbrl:ocg-ext'];
const BY_MANDATE = {
  // Decision/attestation/diagnostic outputs lead with a memo (pdf) but keep tabular too.
  agent_guardrail_mandate: ['pdf', 'xlsx', 'xbrl:ocg-ext'],
  attestation_mandate:     ['pdf', 'xlsx', 'xbrl:ocg-ext'],
  // Capital/liquidity: tabular + ocg-ext now; add 'xbrl:eba-corep-own-funds' /
  // 'xbrl:eba-corep-lcr-nsfr' here once those concept maps are populated.
  capital_assessment:      ['xlsx', 'csv', 'pdf', 'xbrl:ocg-ext'],
  liquidity_mandate:       ['xlsx', 'csv', 'pdf', 'xbrl:ocg-ext'],
};

const raw = readFileSync(CG, 'utf8');
const cg = JSON.parse(raw);
const nodes = cg.nodes ?? [];

let changed = 0;
const preview = [];
for (const n of nodes) {
  if (n.status !== 'live') continue;
  if (n.export_capability && n.export_capability.length && !FORCE) continue;
  const next = BY_MANDATE[n.mandate_type] ?? DEFAULT;
  const before = JSON.stringify(n.export_capability ?? null);
  if (before === JSON.stringify(next)) continue;
  preview.push(`  ${n.tool_id}  [${n.mandate_type}]  ->  ${JSON.stringify(next)}`);
  if (WRITE) n.export_capability = next;
  changed++;
}

console.log(`${WRITE ? 'WRITING' : 'DRY RUN'} — ${changed} live node(s) ${WRITE ? 'updated' : 'would change'} of ${nodes.filter((n) => n.status === 'live').length} live:`);
console.log(preview.slice(0, 40).join('\n'));
if (preview.length > 40) console.log(`  … and ${preview.length - 40} more`);

if (WRITE && changed) {
  // Preserve 2-space indent + trailing newline to match the file's style.
  writeFileSync(CG, JSON.stringify(cg, null, 2) + '\n');
  console.log(`\n✓ wrote ${CG}. Next: cd ../mcp-apps-poc && node generate.mjs ; then commit chaingraph.json + data/ together.`);
} else if (!WRITE) {
  console.log('\n(dry run — re-run with --write to apply)');
}
