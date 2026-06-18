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
const AP2_CONFORMS_TO = 'https://github.com/google-agentic-commerce/AP2/tree/v0.2'; // verify org/repo/tag at build

// Tools whose payload genuinely carries a payment/settlement (amount+parties) -> ISO 20022 pacs.008 profile.
const ISO_PACS_TOOLS = new Map([
  ['art-03-x402-settlement-modeler', 'iso20022:pacs.008-subset'],
  ['art-11-vop-batch-match-rate-analyser', 'iso20022:pacs.008-subset'],
  ['rca-03-iso20022-address-migration-verifier', 'iso20022:pacs.008-subset'],
]);
const PROFILE_URI = { 'iso20022:pacs.008-subset': 'https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld' };

// Tools that genuinely validate/relate to AP2 v0.2 structures -> AP2 conformsTo. EDIT to taste; conservative default.
const AP2_TOOLS = new Set([
  'art-01-ap2-mandate-chain-validator',
  'art-15-agentic-mandate-sandbox',
  'art-16-google-ap2-mandate-builder',
  'art-17-ap2-mcp-policy-validator',
  'art-30-agent-commerce-conformance-validator', // validates AP2 among ACP/TAP/x402
  // repo/tools:
  '102-ap2-payments-checker',
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

  // --- Part C: AP2 v0.2 conformsTo on AP2 tools (anchored, idempotent) ---
  if (AP2_TOOLS.has(id)) {
    if (text.includes(AP2_CONFORMS_TO)) {
      notes.push('ap2-conformsTo: already present');
    } else {
      // Add to an existing dct:conformsTo array if present, else insert a new line after version.
      if (/'dct:conformsTo': \[/.test(text)) {
        text = text.replace(/'dct:conformsTo': \[/, `'dct:conformsTo': ['${AP2_CONFORMS_TO}', `);
        ap2Done++; notes.push('ap2-conformsTo: merged into existing dct:conformsTo');
      } else {
        const m = text.match(/\n(\s*)chaingraph_version: '0\.3\.1',/);
        if (m) {
          const ind = m[1];
          text = text.replace(/\n\s*chaingraph_version: '0\.3\.1',/,
            `\n${ind}chaingraph_version: '0.3.1',\n${ind}'dct:conformsTo': ['${AP2_CONFORMS_TO}'],`);
          ap2Done++; notes.push('ap2-conformsTo: +AP2 v0.2');
        } else { ap2Skip++; notes.push('ap2-conformsTo: SKIPPED (anchor not found)'); }
      }
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
console.log(`\nSummary: ${bumped} version bumps · ISO parity ${isoDone} done/${isoSkip} skipped · AP2 conformsTo ${ap2Done} done/${ap2Skip} skipped`);
console.log('ap2_version retained as a DEPRECATED ALIAS (remove in v0.4). Hash preimage unchanged.');
console.log('⚠️ Verify the AP2 conformsTo URL (org/repo/tag) against the live AP2 GitHub before --apply.');
if (!APPLY) console.log('Dry-run only. Review SKIPPED entries, then re-run with --apply.');
else console.log('Applied. Next: generate-okf.mjs ; regen_catalog.py ; regen_sitemap.py --apply ; verify_repo.py ; commit.');
