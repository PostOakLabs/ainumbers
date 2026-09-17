#!/usr/bin/env node
// fill-fixture-payloads.mjs — canonical helper to populate output_payload in
// fixtures/<tool_id>.fixtures.json by calling buildArtifact on each vector.
// Run after writing new kernel fixtures with empty output_payload:{}.
// After this, run:
//   node golden-parity.test.mjs --update   (pins golden_hash)
//   node kernel-contract.test.mjs          (verifies contract)
//
// FILL-FIXTURE-SALT-ABORT-1 — the driver is now validate-then-write PER FILE.
// The pre-fix driver assigned every vector's payload unconditionally and
// wrote each file the moment it was reached, so one failing file aborted the
// whole corpus mid-run AND every earlier file had already been silently
// re-serialized (measured in the row: a partial run churned 11 unrelated
// art-* fixtures — trailing-newline, number-literal and indentation
// normalization with zero content change — before dying at art-413's salt
// validation). Three rules replace that:
//
//   1. Validate-then-write: EVERY vector of a file is built through its own
//      kernel BEFORE that file is written. Any vector failure (buildArtifact
//      throws, returns no output_payload, or the cases cannot even be read)
//      means the file is NOT written at all — never a partial re-serialize —
//      and the run moves on to the next file instead of aborting.
//   2. Content-diff write: a file is written only when at least one vector's
//      recomputed output_payload actually differs from the committed payload.
//      A corpus that validates is left byte-untouched; no-op re-serializations
//      (the mechanism behind the 11-file churn) are gone.
//   3. Named exit summary: every skipped file is listed by filename, tool_id
//      and reason at the end of the run. Skips are reported, never silent.
//
// Per-file payload semantics are UNCHANGED from the driver the
// VECTOR-VACUITY-TIER1-1 scoped run (#1876) mirrored: the KERNELS registry,
// readCases(), buildArtifact(policy_parameters, { now: null }) per case, and
// JSON.stringify(doc, null, 2) + '\n' serialization on write.
//
// §25 private-input nodes: kernels exporting meta.private_input_profile
// (OCG Standard §25 ocg-private-input@1) are skipped BY NAME without a
// pp-replay. Their buildArtifact first argument is the caller's PRIVATE
// WITNESS, not the artifact's own policy_parameters — the kernel's own meta
// field exists to tell replay harnesses to skip such nodes (SPEC.md §18.3:
// the output is not third-party-recomputable from policy_parameters alone;
// §25.2). Their committed fixtures are validated elsewhere: golden-parity
// pins + the kernel proptest's fixture-oracle, which call buildArtifact with
// the out-of-band disclosure witness (a valid ≥256-bit hex salt; the
// commitment is always computed by the kernel, never hand-built).
//
// EXIT CODE (FILL-FIXTURE-SALT-ABORT-1 decision, stated in the PR): this run
// exits 0 when it completed the corpus and every file either validated or was
// named-skipped, and exits 1 only when the corpus itself cannot be processed
// (missing/empty fixtures directory). Rationale: this helper is a build
// utility, not a CI gate — a fixture that fails its own kernel's validation
// is failed in CI by golden-parity and the kernel proptests; the five §25
// private-input nodes in the live corpus are permanent structural skips, so a
// non-zero-on-skip design would keep the canonical path permanently red and
// push every builder back to the ad-hoc scoped-driver workaround this row
// retires. Skips are loud (named, on stderr) but not fatal.

import { resolve, dirname } from 'node:path';
import { fileURLToPath }    from 'node:url';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { KERNELS }          from './index.mjs';
import { readCases }        from './_shape.mjs';

const HERE   = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');

if (!existsSync(FIXDIR)) {
  console.error('No fixtures/ directory found.');
  process.exit(1);
}

const files = readdirSync(FIXDIR).filter(f => f.endsWith('.fixtures.json'));
if (files.length === 0) { console.error('No fixture files found.'); process.exit(1); }

let updatedFiles = 0, canonicalFiles = 0, filledVectors = 0;
const skipped = []; // { file, tool_id, reason } — reported in the named exit summary

for (const ff of files) {
  const path = resolve(FIXDIR, ff);

  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    skipped.push({ file: ff, tool_id: '(unreadable)', reason: `fixture JSON does not parse: ${err.message}` });
    continue;
  }

  const kernel = KERNELS[doc.tool_id];
  if (!kernel) {
    skipped.push({ file: ff, tool_id: doc.tool_id, reason: 'no kernel registered for tool_id' });
    continue;
  }
  if (typeof kernel.buildArtifact !== 'function') {
    skipped.push({ file: ff, tool_id: doc.tool_id, reason: 'kernel has no buildArtifact()' });
    continue;
  }
  // §25 ocg-private-input@1 (see header): a pp-replay is structurally invalid —
  // skip by name before calling buildArtifact, and never write the file.
  if (kernel.meta && kernel.meta.private_input_profile) {
    skipped.push({
      file: ff,
      tool_id: doc.tool_id,
      reason: `private-input profile ${kernel.meta.private_input_profile}: buildArtifact takes the private `
            + 'witness, not the committed policy_parameters (SPEC.md §18.3/§25.2); validated by golden-parity '
            + 'pins + the kernel proptest fixture-oracle',
    });
    continue;
  }

  // Validate-then-write: build EVERY case before this file is touched.
  const updates = new Map(); // case -> new output_payload
  let fileFailed = null;     // { name, reason }
  try {
    // KERNEL-OUTPUT-READER-1: fixture cases come from _shape.mjs, not a local `.vectors` guess.
    for (const v of readCases(doc)) {
      const name = v && v.name ? v.name : '(unnamed case)';
      let art;
      try {
        // Per-file payload semantics unchanged: buildArtifact(policy_parameters, { now: null }).
        art = await kernel.buildArtifact(v.policy_parameters, { now: null });
      } catch (err) {
        fileFailed = { name, reason: `buildArtifact threw: ${err.message}` };
        break;
      }
      if (!art || !art.output_payload) {
        fileFailed = { name, reason: 'buildArtifact returned no output_payload' };
        break;
      }
      if (JSON.stringify(v.output_payload) !== JSON.stringify(art.output_payload)) {
        updates.set(v, art.output_payload);
      }
    }
  } catch (err) {
    fileFailed = { name: '(case enumeration)', reason: `readCases failed: ${err.message}` };
  }

  if (fileFailed) {
    skipped.push({ file: ff, tool_id: doc.tool_id, reason: `${fileFailed.name}: ${fileFailed.reason}` });
    continue; // the file is NOT written — no partial re-serialize, unrelated files untouched
  }

  if (updates.size === 0) { canonicalFiles++; continue; } // validating corpus stays byte-untouched

  for (const [v, payload] of updates) {
    v.output_payload = payload;
    filledVectors++;
    console.log(`  ✓ ${doc.tool_id}/${v.name} — output_payload filled`);
  }
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
  updatedFiles++;
}

console.log(`\nDone — ${files.length} file(s): ${updatedFiles} updated (${filledVectors} vector payload(s) filled), ${canonicalFiles} already canonical, ${skipped.length} skipped.`);
if (skipped.length > 0) {
  console.error(`\nSKIPPED (${skipped.length}) — named below; these file(s) were NOT written:`);
  for (const s of skipped) console.error(`  ⚠ ${s.file} [${s.tool_id}]: ${s.reason}`);
}
console.log('\nNow run:\n  node golden-parity.test.mjs --update\n  node kernel-contract.test.mjs');
process.exit(0);
