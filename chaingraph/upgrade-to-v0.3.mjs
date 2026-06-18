#!/usr/bin/env node
/**
 * upgrade-to-v0.3.mjs — bump every OpenChainGraph tool's emitted artifact to v0.3.
 *
 * What it changes, ONLY inside tool emission code (files containing `_artifact`
 * and the JS-literal `chaingraph_version: '0.2.0'`):
 *   1. '@context': '…/spec/v0.2/context.jsonld'  →  v0.3 context
 *        · ISO 20022 tools (rca-03, art-11) get an ARRAY: [ v0.3 base, v0.3 iso20022 ]
 *          and gain  semantic_profile: 'iso20022:pacs.008-subset'
 *        · all other tools get the single v0.3 context string
 *   2. chaingraph_version: '0.2.0'  →  '0.3.0'
 *
 * What it deliberately does NOT change:
 *   · buildType — the WebCryptoSHA256 URI is a version-independent identifier of the
 *     hash construction, which is byte-identical in v0.3 (immutability rule). Artifacts
 *     keep https://openchain.graph/spec/v0.2#WebCryptoSHA256.
 *   · the execution_hash preimage (policy_parameters + output_payload) — untouched, so
 *     every previously emitted hash still verifies.
 *   · documentation / spec / guide / hub pages — they use double-quoted JSON examples and
 *     do not contain the JS literal `chaingraph_version: '0.2.0'`, so they never match.
 *
 * Idempotent: a file already at 0.3.0 is skipped. Safe to re-run.
 *
 * Usage:
 *   node upgrade-to-v0.3.mjs           # DRY RUN — prints what would change
 *   node upgrade-to-v0.3.mjs --apply   # writes the changes
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

const V2_CTX = "'@context': 'https://openchain.graph/spec/v0.2/context.jsonld'";
const V3_CTX_SINGLE = "'@context': 'https://openchain.graph/spec/v0.3/context.jsonld'";
const V3_CTX_ARRAY =
  "'@context': ['https://openchain.graph/spec/v0.3/context.jsonld', " +
  "'https://openchain.graph/spec/v0.3/iso20022-context.jsonld']";
const V2_VER = "chaingraph_version: '0.2.0'";
const V3_VER = "chaingraph_version: '0.3.0'";
const SEMPROFILE = "\n    semantic_profile: 'iso20022:pacs.008-subset',";

// ISO 20022 tools that also carry the semantic profile (matches §8 / chaingraph.json)
const isIsoTool = (name) =>
  /^rca-03-iso20022/.test(name) || /^art-11-vop/.test(name);

const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.html'))
  .map((f) => resolve(HERE, f));

let upgraded = 0,
  skipped = 0,
  anomalies = [];

for (const file of files) {
  const name = basename(file);
  let src = readFileSync(file, 'utf8');

  // Only tool emission code qualifies.
  if (!src.includes('_artifact') || !src.includes(V2_VER)) {
    skipped++;
    continue;
  }

  const before = src;
  const iso = isIsoTool(name);

  // 1. @context
  if (src.includes(V2_CTX)) {
    src = src.split(V2_CTX).join(iso ? V3_CTX_ARRAY : V3_CTX_SINGLE);
  } else {
    anomalies.push(`${name}: had v0.2 version but no expected v0.2 @context literal`);
  }

  // 2. chaingraph_version
  src = src.split(V2_VER).join(V3_VER);

  // 3. semantic_profile for ISO tools (insert once, right after the version line)
  if (iso && !src.includes('semantic_profile')) {
    src = src.replace(`${V3_VER},`, `${V3_VER},${SEMPROFILE}`);
  }

  if (src !== before) {
    upgraded++;
    console.log(`${APPLY ? 'UPGRADED' : 'would upgrade'}: ${name}${iso ? '  (+ ISO 20022 profile)' : ''}`);
    if (APPLY) writeFileSync(file, src);
  } else {
    skipped++;
  }
}

console.log(
  `\n${APPLY ? 'Applied' : 'Dry run'} — ${upgraded} tool(s) ${APPLY ? 'upgraded' : 'to upgrade'}, ${skipped} skipped.`,
);
if (anomalies.length) {
  console.log('\nAnomalies (review by hand):');
  for (const a of anomalies) console.log('  - ' + a);
}
if (!APPLY) console.log('\nRe-run with --apply to write the changes.');
