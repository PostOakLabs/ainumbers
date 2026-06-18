#!/usr/bin/env node
/**
 * full-migrate-v0.3.1.mjs — repo-wide artifact-envelope harmonization to OpenChainGraph v0.3.1.
 *
 * Decisions (2026-06-18):
 *   Q1 version  : bump every artifact to chaingraph_version "0.3.1".
 *   Q2 ap2_version: KEEP as a deprecated alias (remove in v0.4 — NOT removed here). Additionally,
 *                   add a TRUTHFUL AP2-conformance claim via dct:conformsTo -> the AP2 v0.2 GitHub
 *                   spec on the tools that actually validate/relate to AP2 v0.2 (allowlist below).
 *                   Rationale: ap2_version:"1.0.0" is a legacy ENVELOPE-version label, NOT the AP2
 *                   standard version (AP2 is at v0.2). chaingraph_version is the real envelope version;
 *                   AP2 conformance, where it genuinely applies, is declared explicitly with dct:conformsTo.
 *   Q3 scope    : entire repo (tools/, chaingraph/, guides/).
 *   Q4 parity   : profiled tool EXPORTS emit @context array + dct:conformsTo + semantic_profile,
 *                 matching the server (emit_chaingraph_artifact) and the graph index.
 *
 * SAFETY: hash preimage is {policy_parameters, output_payload} only — @context, dct:conformsTo,
 * semantic_profile, chaingraph_version, ap2_version are ALL outside it. This migration cannot change
 * any execution_hash. Verify with a re-emit before/after.
 *
 * The universal version bump is an exact-string replace (safe). The structural inserts (Parts B/C)
 * are ANCHORED and IDEMPOTENT: if the anchor isn't found, the file is reported SKIPPED — never
 * silently corrupted. Review the dry-run report before --apply.
 *
 * Usage:
 *   node chaingraph/full-migrate-v0.3.1.mjs            # dry-run report
 *   node chaingraph/full-migrate-v0.3.1.mjs --apply    # write in place
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));   // repo/chaingraph
const REPO = dirname(HERE);                             // repo
const APPLY = process.argv.includes('--apply');

const CTX_BASE = 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld';
const CTX_ISO  = 'https://ainumbers.co/chaingraph/context/v0.3/iso20022-context.jsonld';
// Canonical protocol spec URLs (verified 2026-06-18) for dct:conformsTo claims.
const SPEC = {
  ap2:  'https://github.com/google-agentic-commerce/AP2/tree/v0.2',
  acp:  'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol',
  x402: 'https://github.com/coinbase/x402',
  tap:  'https://github.com/visa/trusted-agent-protocol',
};

// Tools whose payload genuinely carries a payment/settlement (amount+parties) -> ISO 20022 pacs.008 profile.
const ISO_PACS_TOOLS = new Map([
  ['art-03-x402-settlement-modeler', 'iso20022:pacs.008-subset'],
  ['art-11-vop-batch-match-rate-analyser', 'iso20022:pacs.008-subset'],
  ['rca-03-iso20022-address-migration-verifier', 'iso20022:pacs.008-subset'],
]);
const PROFILE_URI = { 'iso20022:pacs.008-subset': 'https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld' };

// Per-tool protocol conformsTo (reviewed 2026-06-18). Each tool genuinely validates/emits the
// listed protocol structures. NOTE: 102-ap2-payments-checker was REMOVED — per CONTRACT.md it emits
// an AINumbers Policy Mandate *about* AP2, not a real AP2 mandate, so a conformsTo claim would be false.
const PROTOCOL_CONFORMS_TO = new Map([
  ['art-01-ap2-mandate-chain-validator', [SPEC.ap2]],   // reference AP2 v0.2 validator
  ['art-15-agentic-mandate-sandbox',     [SPEC.ap2]],   // emits AP2-compatible mandate JSON
  ['art-16-google-ap2-mandate-builder',  [SPEC.ap2]],   // builds AP2 mandates
  ['art-17-ap2-mcp-policy-validator',    [SPEC.ap2]],   // validates AP2/MCP policy
  ['art-30-agent-commerce-conformance-validator', [SPEC.ap2, SPEC.acp, SPEC.x402, SPEC.tap]], // cross-protocol — all four
]);

const EXTS = new Set(['.html', '.json', '.jsonld']);
const SKIP_DIRS = new Set(['okf', 'node_modules', '.git']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

const targets = [
  ...walk(join(REPO, 'chaingraph')),
  ...walk(join(REPO, 'tools')),
  ...walk(join(REPO, 'guides')),
];

const log = [];
let bumped = 0, isoDone = 0, isoSkip = 0, ap2Done = 0, ap2Skip = 0;

for (const f of targets) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const orig = text;
  const id = basename(f, extname(f));
  const notes = [];

  // --- Part A: universal version bump (exact-string, both quote styles) ---
  const before = text;
  text = text.split("chaingraph_version: '0.3.0'").join("chaingraph_version: '0.3.1'");
  text = text.split('chaingraph_version: "0.3.0"').join('chaingraph_version: "0.3.1"');
  text = text.split('"chaingraph_version": "0.3.0"').join('"chaingraph_version": "0.3.1"');
  if (text !== before) { bumped++; notes.push('version 0.3.0->0.3.1'); }

  // --- Part B: ISO 20022 pacs.008 parity on profiled tools (anchored, idempotent) ---
  if (ISO_PACS_TOOLS.has(id)) {
    const token = ISO_PACS_TOOLS.get(id);
    const uri = PROFILE_URI[token];
    if (text.includes(uri) || text.includes(`semantic_profile: '${token}'`)) {
      notes.push('iso-parity: already present');
    } else {
      // (1) @context single -> array
      const single = `'@context': '${CTX_BASE}',`;
      const arr = `'@context': [\n          '${CTX_BASE}',\n          '${CTX_ISO}'\n        ],`;
      let did = false;
      if (text.includes(single)) { text = text.split(single).join(arr); did = true; }
      // (2) insert semantic_profile + dct:conformsTo right after the (now-bumped) version line, matching indent
      const m = text.match(/\n(\s*)chaingraph_version: '0\.3\.1',/);
      if (m) {
        const ind = m[1];
        const ins = `\n${ind}chaingraph_version: '0.3.1',\n${ind}semantic_profile: '${token}',\n${ind}'dct:conformsTo': ['${uri}'],`;
        text = text.replace(/\n\s*chaingraph_version: '0\.3\.1',/, ins);
        did = true;
      }
      if (did) { isoDone++; notes.push(`iso-parity: +${token} +dct:conformsTo`); }
      else { isoSkip++; notes.push('iso-parity: SKIPPED (anchor not found — inspect manually)'); }
    }
  }

  // --- Part C: protocol conformsTo on agentic-payment tools (anchored, idempotent) ---
  if (PROTOCOL_CONFORMS_TO.has(id)) {
    const urls = PROTOCOL_CONFORMS_TO.get(id);
    const list = urls.map((u) => `'${u}'`).join(', ');
    if (urls.every((u) => text.includes(u))) {
      notes.push('protocol-conformsTo: already present');
    } else if (/'dct:conformsTo': \[/.test(text)) {
      // merge: prepend any missing protocol URLs into the existing array
      const missing = urls.filter((u) => !text.includes(u)).map((u) => `'${u}'`).join(', ');
      text = text.replace(/'dct:conformsTo': \[/, `'dct:conformsTo': [${missing}, `);
      ap2Done++; notes.push(`protocol-conformsTo: merged ${urls.length} spec(s)`);
    } else {
      const m = text.match(/\n(\s*)chaingraph_version: '0\.3\.1',/);
      if (m) {
        const ind = m[1];
        text = text.replace(/\n\s*chaingraph_version: '0\.3\.1',/,
          `\n${ind}chaingraph_version: '0.3.1',\n${ind}'dct:conformsTo': [${list}],`);
        ap2Done++; notes.push(`protocol-conformsTo: +${urls.length} spec(s)`);
      } else { ap2Skip++; notes.push('protocol-conformsTo: SKIPPED (anchor not found)'); }
    }
  }

  if (text !== orig) {
    log.push([f.replace(REPO, 'repo'), notes.join(' | ')]);
    if (APPLY) writeFileSync(f, text, 'utf8');
  } else if (notes.some(n => n.includes('SKIPPED'))) {
    log.push([f.replace(REPO, 'repo'), notes.join(' | ')]);
  }
}

console.log(`OpenChainGraph v0.3.1 full envelope migration${APPLY ? ' [APPLYING]' : ' [dry-run]'}`);
for (const [file, note] of log) console.log(`  ${file}\n      ${note}`);
console.log(`\nSummary: ${bumped} version bumps · ISO parity ${isoDone} done/${isoSkip} skipped · protocol conformsTo ${ap2Done} done/${ap2Skip} skipped`);
console.log('ap2_version retained as a DEPRECATED ALIAS (remove in v0.4). Hash preimage unchanged.');
console.log('Protocol conformsTo: art-01/15/16/17 → AP2 v0.2; art-30 → AP2+ACP+x402+TAP. (102-ap2-payments-checker excluded — emits a mandate ABOUT AP2, not a real one.)');
console.log('⚠️ Verify the four SPEC URLs (AP2 tag, ACP, x402, Visa TAP) resolve before --apply.');
if (!APPLY) console.log('Dry-run only. Review SKIPPED entries, then re-run with --apply.');
else console.log('Applied. Next: generate-okf.mjs ; regen_catalog.py ; regen_sitemap.py --apply ; verify_repo.py ; commit.');
