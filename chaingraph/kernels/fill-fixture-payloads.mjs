#!/usr/bin/env node
// fill-fixture-payloads.mjs — one-time helper to populate output_payload in
// fixtures/<tool_id>.fixtures.json by calling buildArtifact on each vector.
// Run ONCE after writing new kernel fixtures with empty output_payload:{}.
// After this, run:
//   node golden-parity.test.mjs --update   (pins golden_hash)
//   node kernel-contract.test.mjs          (verifies contract)

import { resolve, dirname } from 'node:path';
import { fileURLToPath }    from 'node:url';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { KERNELS }          from './index.mjs';

const HERE   = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');

if (!existsSync(FIXDIR)) {
  console.error('No fixtures/ directory found.');
  process.exit(1);
}

const files = readdirSync(FIXDIR).filter(f => f.endsWith('.fixtures.json'));
if (files.length === 0) { console.error('No fixture files found.'); process.exit(1); }

let filled = 0;
for (const ff of files) {
  const path   = resolve(FIXDIR, ff);
  const doc    = JSON.parse(readFileSync(path, 'utf8'));
  const kernel = KERNELS[doc.tool_id];
  if (!kernel) { console.warn(`⚠  no kernel for ${doc.tool_id} — skipped`); continue; }
  if (typeof kernel.buildArtifact !== 'function') {
    console.warn(`⚠  ${doc.tool_id} has no buildArtifact() — skipped`);
    continue;
  }
  let dirty = false;
  for (const v of (doc.vectors ?? [])) {
    const art = await kernel.buildArtifact(v.policy_parameters, { now: null });
    if (!art.output_payload) {
      console.error(`✗ ${doc.tool_id}/${v.name}: buildArtifact returned no output_payload`);
      continue;
    }
    v.output_payload = art.output_payload;
    dirty = true;
    filled++;
    console.log(`  ✓ ${doc.tool_id}/${v.name} — output_payload filled`);
  }
  if (dirty) writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}
console.log(`\nDone — filled ${filled} vector(s). Now run:\n  node golden-parity.test.mjs --update\n  node kernel-contract.test.mjs`);
