#!/usr/bin/env node
/**
 * upgrade-to-v0.3.1.mjs — OpenChainGraph v0.3 -> v0.3.1 profile-conformance migration.
 *
 * v0.3.1 is ADDITIVE over v0.3. It does NOT touch the execution_hash preimage.
 * What it does to chaingraph.json:
 *   1. Bump version 1.x -> 1.11.0, spec_version -> "0.3.1", updated -> today.
 *   2. Fix DCAT-mirror drift: @context.ocg spec/v0.2# -> v0.3#, ocg:spec_version 0.2.0 -> 0.3.1.
 *   3. Stamp the ISO 20022 pacs.008 profile on the genuine payment/settlement nodes
 *      (semantic_profile token on the primary node + ocg:semantic_profile + dataset-level
 *      dct:conformsTo profile URI on the DCAT mirror). Truthful tagging only — no blanket ISO.
 *   4. Refresh the v0.3 note to mention the profile registry + dct:conformsTo.
 *
 * Profiles published separately in chaingraph-standard/profiles/ (PROF docs + registry.json).
 * The party-identification profile exists in the registry but is NOT stamped on any existing
 * node here (none of the current 48 emit a bare PartyIdentification payload) — it is provisioned
 * for the Tempo wave. Review candidates for future opt-in are listed in REVIEW_CANDIDATES below.
 *
 * Usage:
 *   node chaingraph/upgrade-to-v0.3.1.mjs           # dry-run: report changes, write nothing
 *   node chaingraph/upgrade-to-v0.3.1.mjs --apply   # write chaingraph.json in place
 *
 * Idempotent: re-running after --apply reports 0 changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'chaingraph.json');
const APPLY = process.argv.includes('--apply');

const NEW_VERSION = '1.11.0';
const NEW_SPEC = '0.3.1';
const TODAY = '2026-06-18';
const TOKEN = 'iso20022:pacs.008-subset';
const PROFILE_URI = 'https://openchain.graph/profiles/iso20022/pacs.008-subset';

// Truthful payment/settlement nodes (amount + parties). art-11 + rca-03 already carry the token.
const PAYMENT_NODES = new Set([
  'art-03-x402-settlement-modeler',
  'art-11-vop-batch-match-rate-analyser',
  'rca-03-iso20022-address-migration-verifier',
]);
// Not stamped automatically — opt in only if they genuinely emit the relevant payload:
const REVIEW_CANDIDATES = [
  'art-08-en16931-einvoice-batch-validator (e-invoice amount/party — EN 16931, not pacs.008)',
  'art-26-x402-payload-decoder-flow-simulator (x402 payment payload)',
  'art-30-agent-commerce-conformance-validator / art-31-a2a-x402-extension-mandate-validator (x402 settlement leg)',
  'party-identification candidates: art-04, art-13, art-25, art-32 (agent/credential identity — verify they bind a legal-entity LEI before tagging)',
];

const V031_NOTE =
  'v0.3.1 (additive): profile conformance migrated to W3C dct:conformsTo + dereferenceable profile URIs ' +
  '(see chaingraph-standard/profiles/registry.json). semantic_profile tokens retained as registered aliases ' +
  '(W3C Content Negotiation by Profile). ISO 20022 profiles applied truthfully — only payment/settlement nodes ' +
  'carry pacs.008-subset; the party-identification profile is published and provisioned for the Tempo wave. ' +
  'Hash preimage and internal IDs unchanged.';

const obj = JSON.parse(readFileSync(FILE, 'utf8'));
const changes = [];

// 1. Top-level version stamps
if (obj.version !== NEW_VERSION) { changes.push(`version ${obj.version} -> ${NEW_VERSION}`); obj.version = NEW_VERSION; }
if (obj.spec_version !== NEW_SPEC) { changes.push(`spec_version ${obj.spec_version} -> ${NEW_SPEC}`); obj.spec_version = NEW_SPEC; }
if (obj.updated !== TODAY) { changes.push(`updated ${obj.updated} -> ${TODAY}`); obj.updated = TODAY; }
if (obj.v0_3_1_note !== V031_NOTE) { changes.push('v0_3_1_note set'); obj.v0_3_1_note = V031_NOTE; }

// 2. DCAT-mirror drift
if (obj['@context'] && typeof obj['@context'].ocg === 'string' && obj['@context'].ocg.includes('/spec/v0.2#')) {
  const fixed = obj['@context'].ocg.replace('/spec/v0.2#', '/spec/v0.3#');
  changes.push(`@context.ocg ${obj['@context'].ocg} -> ${fixed}`);
  obj['@context'].ocg = fixed;
}
if (obj['ocg:spec_version'] && obj['ocg:spec_version'] !== NEW_SPEC) {
  changes.push(`ocg:spec_version ${obj['ocg:spec_version']} -> ${NEW_SPEC}`);
  obj['ocg:spec_version'] = NEW_SPEC;
}

// 3a. Primary node array — semantic_profile token on payment nodes
for (const node of (obj.nodes ?? [])) {
  if (PAYMENT_NODES.has(node.tool_id) && node.semantic_profile !== TOKEN) {
    changes.push(`node ${node.tool_id}: semantic_profile -> ${TOKEN}`);
    node.semantic_profile = TOKEN;
  }
}

// 3b. DCAT mirror datasets — ocg:semantic_profile + dataset-level dct:conformsTo
for (const ds of (obj['dcat:dataset'] ?? [])) {
  const toolId = String(ds['@id'] ?? '').replace(/^ain:/, '');
  if (!PAYMENT_NODES.has(toolId)) continue;
  if (ds['ocg:semantic_profile'] !== TOKEN) {
    changes.push(`dataset ${toolId}: ocg:semantic_profile -> ${TOKEN}`);
    ds['ocg:semantic_profile'] = TOKEN;
  }
  const cur = Array.isArray(ds['dct:conformsTo']) ? ds['dct:conformsTo'] : [];
  if (!cur.includes(PROFILE_URI)) {
    changes.push(`dataset ${toolId}: dct:conformsTo += ${PROFILE_URI}`);
    ds['dct:conformsTo'] = [...cur, PROFILE_URI];
  }
}

// Report
console.log(`OpenChainGraph v0.3.1 migration — ${changes.length} change(s)${APPLY ? ' [APPLYING]' : ' [dry-run]'}`);
for (const c of changes) console.log('  • ' + c);
if (!changes.length) console.log('  (already at v0.3.1 — nothing to do)');
console.log('\nReview candidates NOT auto-stamped (verify payload before opting in):');
for (const r of REVIEW_CANDIDATES) console.log('  - ' + r);

if (APPLY && changes.length) {
  writeFileSync(FILE, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${FILE}. Re-run without --apply to confirm 0 remaining; then regenerate okf/ and commit.`);
} else if (!APPLY && changes.length) {
  console.log('\nDry-run only. Re-run with --apply to write.');
}
