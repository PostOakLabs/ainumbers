#!/usr/bin/env node
// check-roundtrip-determinism.mjs — XLR-5 golden-fixture pair + cross-
// implementation determinism gate (WORKBOOK-ROUNDTRIP-BUILD-SPEC.md §XLR-5).
//
// Same shape as WB-5's check-determinism-fixture.mjs: a fixed input pinned
// against a fixed golden output, so drift in a roundtrip-verify.mjs
// implementation trips this gate. Unlike WB-5 (one engine), XLR-5 covers TWO
// live implementations of the same comparator: XLR-2 (site,
// chaingraph/workbook/roundtrip-verify.mjs) and XLR-4 (worker, vendored
// byte-for-byte into mcp-apps-poc/workbook/roundtrip-verify.mjs by
// generate.mjs). This gate:
//   1. runs the golden fixture through the SITE comparator and pins the
//      receipt byte-for-byte against fixtures/roundtrip-golden-receipt.json.
//   2. PROVES the gate can fail: perturbs the golden observed input, re-runs,
//      and asserts the result diverges from the pinned receipt. A gate that
//      can never fail is not a gate (WB-5's own header makes the same point
//      for the single-engine case).
//   3. OPPORTUNISTICALLY also runs the SAME golden fixture through the
//      WORKER's vendored copy (../../mcp-apps-poc/workbook/roundtrip-verify.mjs,
//      dynamic import) and pins IT against the same golden receipt --
//      proving XLR-2/XLR-4 produce byte-identical OUTPUT, not just
//      byte-identical source text.
//
// ⚠ THE WORKER PATH IS UNGUARDED BY THIS GATE IN repo/'s OWN CI, DOCUMENTED
// RATHER THAN SILENT: repo/'s CI checks out only this repository (see
// .github/workflows/html-verify.yml) -- mcp-apps-poc/ is a SEPARATE git repo
// and is never present there, so step 3 cannot import its code and SKIPS
// (never fails the gate) whenever the mcp-apps-poc/ sibling directory is
// absent. It prints exactly that instead of quietly passing as if it ran.
// The worker copy is still guarded, just not by THIS script:
//   (a) generate.mjs vendors roundtrip-verify.mjs byte-for-byte -- checked by
//       mcp-apps-poc/tests/workbook-roundtrip-verify.test.mjs's own
//       vendor-identity assertion, which DOES have a ../repo sibling (that
//       repo's CI checks out PostOakLabs/ainumbers for its validate job);
//   (b) that same test file runs match/mismatch fixtures against the LIVE
//       worker tool through a real MCP tools/call round-trip.
// On a workstation with both repos checked out side by side (the normal dev
// layout -- and the layout this WU itself ran in), step 3 runs for real and
// this becomes a genuine two-implementation check, not a one-sided one.
//
// Usage:
//   node chaingraph/workbook/check-roundtrip-determinism.mjs            # gate
//   node chaingraph/workbook/check-roundtrip-determinism.mjs --update   # (re)pin golden receipt from current site comparator output

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyRoundtrip } from './roundtrip-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, 'fixtures');
const MANIFEST_PATH = resolve(FIX, 'roundtrip-golden-manifest.json');
const OBSERVED_PATH = resolve(FIX, 'roundtrip-golden-observed.json');
const RECEIPT_PATH = resolve(FIX, 'roundtrip-golden-receipt.json');
const WORKER_PATH = resolve(HERE, '..', '..', '..', 'mcp-apps-poc', 'workbook', 'roundtrip-verify.mjs');
const UPDATE = process.argv.includes('--update');

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const observedByRef = JSON.parse(readFileSync(OBSERVED_PATH, 'utf8'));
const PRODUCED_BY = 'check-roundtrip-determinism.mjs golden fixture';
const PRODUCED_AT = '2026-08-03T00:00:00Z';

const receipt = await verifyRoundtrip(manifest, observedByRef, { producedBy: PRODUCED_BY, producedAt: PRODUCED_AT });

if (UPDATE) {
  writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`✅ pinned golden receipt from current site comparator output (result=${receipt.result})`);
  process.exit(0);
}

const golden = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
const receiptJson = JSON.stringify(receipt);
const goldenJson = JSON.stringify(golden);

let failed = false;

// ── 1. site comparator (XLR-2) stays byte-identical to the pinned golden receipt ──
if (receiptJson !== goldenJson) {
  console.error('❌ WORKBOOK ROUND-TRIP DETERMINISM DRIFT (site/XLR-2)');
  console.error(`   golden fixture now produces: ${receiptJson}`);
  console.error(`   fixtures/roundtrip-golden-receipt.json pins:   ${goldenJson}`);
  console.error('   Either the comparator changed behavior (investigate before touching the pin)');
  console.error('   or the change is intentional (re-run with --update to re-pin).');
  failed = true;
} else {
  console.log('✅ site comparator (XLR-2) matches golden receipt');
}

// ── 2. positive control: prove this gate CAN fail ──────────────────────────
{
  const perturbedObserved = JSON.parse(JSON.stringify(observedByRef));
  const firstRef = Object.keys(perturbedObserved)[0];
  perturbedObserved[firstRef] = perturbedObserved[firstRef].replace(/\d/, (d) => String((Number(d) + 1) % 10));
  const perturbedReceipt = await verifyRoundtrip(manifest, perturbedObserved, { producedBy: PRODUCED_BY, producedAt: PRODUCED_AT });
  const perturbedJson = JSON.stringify(perturbedReceipt);
  if (perturbedJson === goldenJson) {
    console.error('❌ POSITIVE CONTROL FAILED: a perturbed observed input produced the SAME receipt as the golden fixture -- this gate cannot detect drift.');
    failed = true;
  } else {
    console.log(`✅ positive control: a perturbed observed input (${firstRef}) diverges from the golden receipt (result=${perturbedReceipt.result}, was ${golden.result}) -- this gate does fire on an altered input`);
  }
}

// ── 3. worker (XLR-4) opportunistic cross-implementation check ─────────────
const workerAvailable = existsSync(WORKER_PATH);
if (workerAvailable) {
  const { verifyRoundtrip: workerVerify } = await import(pathToFileURL(WORKER_PATH).href);
  const workerReceipt = await workerVerify(manifest, observedByRef, { producedBy: PRODUCED_BY, producedAt: PRODUCED_AT });
  const workerJson = JSON.stringify(workerReceipt);
  if (workerJson !== goldenJson) {
    console.error('❌ WORKBOOK ROUND-TRIP DETERMINISM DRIFT (worker/XLR-4)');
    console.error(`   ../../mcp-apps-poc/workbook/roundtrip-verify.mjs now produces: ${workerJson}`);
    console.error(`   fixtures/roundtrip-golden-receipt.json pins:                   ${goldenJson}`);
    failed = true;
  } else {
    console.log('✅ worker comparator (XLR-4, ../../mcp-apps-poc/workbook/roundtrip-verify.mjs) matches golden receipt -- XLR-2/XLR-4 byte-identical OUTPUT on the same input');
  }
} else {
  console.log('⚠ worker (XLR-4) UNEXERCISED by this gate: ../../mcp-apps-poc/ sibling repo is absent in this checkout.');
  console.log('  repo/\'s own CI checks out only this repository (.github/workflows/html-verify.yml) -- mcp-apps-poc/ is a');
  console.log('  separate git repo and is never present there, so this script cannot import its code. NOT silently skipped:');
  console.log('  the worker copy is guarded elsewhere -- generate.mjs vendors roundtrip-verify.mjs byte-for-byte, checked by');
  console.log('  mcp-apps-poc/tests/workbook-roundtrip-verify.test.mjs\'s own vendor-identity assertion (that repo\'s CI DOES');
  console.log('  check out ../repo for its validate job), which also runs match/mismatch fixtures against the live worker tool.');
}

if (failed) process.exit(1);
console.log(`\n✅ workbook round-trip determinism fixture: golden receipt pinned, positive control fired, worker cross-check ${workerAvailable ? 'RAN' : 'SKIPPED (documented gap above)'}.`);
