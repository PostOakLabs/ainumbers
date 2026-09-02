#!/usr/bin/env node
// gen-regz-inline.mjs — keep the inlined copies of `_regz-thresholds.mjs` byte-identical
// to the module itself.
//
// WHY THIS EXISTS. art-218 / art-220 / art-234 all serve the same Regulation Z annual
// threshold tables. They used to hold three private copies, so one wrong Federal Register
// locator, authored once and copied faithfully, became three live wrong answers that no
// gate could see. `chaingraph/kernels/_regz-thresholds.mjs` is now the single writer for
// those values.
//
// WHY IT IS INLINED RATHER THAN IMPORTED. The RISC0 zkVM guest resolves only `_hash`;
// a sibling `import` is unavailable in-guest (same constraint `_detmath.bundle.mjs`
// documents). Measured 2026-08-23 with a probe kernel identical but for the import:
//     import { PROBE_TABLE } from './_probe_data.mjs'  ->  {"error":"ocg_run","code":-3,"msg":"undefined"}
//     const PROBE_TABLE = { ... }                      ->  {"output":{"imported_ok":true,...}}
// So a kernel that imported its thresholds would be unprovable. The block between the
// REGZ-SHARED markers is copied verbatim into each consumer instead, and this script's
// --check mode is what makes "one holder" a fact rather than an intention: if a copy
// drifts from the module, the gate goes red.
//
// Usage:
//   node scripts/gen-regz-inline.mjs           # rewrite the inlined block in each consumer
//   node scripts/gen-regz-inline.mjs --check    # verify only; exit 1 on drift

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const KERNELS = path.join(repoRoot, 'chaingraph', 'kernels');

const MODULE_REL = 'chaingraph/kernels/_regz-thresholds.mjs';
const CONSUMERS = [
  'art-218-qm-points-and-fees.kernel.mjs',
  'art-220-reg-z-threshold-lookup.kernel.mjs',
  'art-234-test-hoepa-high-cost.kernel.mjs',
];

const BEGIN = '// ---- REGZ-SHARED-BEGIN ----';
const END = '// ---- REGZ-SHARED-END ----';

function extractBlock(src, whatFile) {
  const i = src.indexOf(BEGIN);
  const j = src.indexOf(END);
  if (i === -1 || j === -1 || j < i) {
    throw new Error(`${whatFile}: REGZ-SHARED markers missing or out of order — cannot locate the shared block.`);
  }
  // Block INCLUDES both marker lines so the markers themselves cannot drift.
  return src.slice(i, j + END.length);
}

const check = process.argv.includes('--check');
const moduleSrc = readFileSync(path.join(repoRoot, MODULE_REL), 'utf8');
const canonical = extractBlock(moduleSrc, MODULE_REL);

let drifted = 0;
let rewritten = 0;

for (const name of CONSUMERS) {
  const abs = path.join(KERNELS, name);
  const src = readFileSync(abs, 'utf8');
  let current;
  try {
    current = extractBlock(src, `chaingraph/kernels/${name}`);
  } catch (e) {
    console.error(`REGZ-INLINE FAIL  ${name}: ${e.message}`);
    drifted++;
    continue;
  }
  if (current === canonical) {
    console.log(`REGZ-INLINE OK    ${name} (in sync with ${MODULE_REL})`);
    continue;
  }
  if (check) {
    console.error(`REGZ-INLINE DRIFT ${name}: inlined block differs from ${MODULE_REL}.`);
    console.error('                  Run `node scripts/gen-regz-inline.mjs` to resync, then re-prove the kernel.');
    drifted++;
    continue;
  }
  writeFileSync(abs, src.slice(0, src.indexOf(BEGIN)) + canonical + src.slice(src.indexOf(END) + END.length), 'utf8');
  console.log(`REGZ-INLINE WROTE ${name}`);
  rewritten++;
}

if (check) {
  if (drifted > 0) {
    console.error(`\nREGZ-INLINE: ${drifted} consumer(s) out of sync with the single-writer module.`);
    process.exit(1);
  }
  console.log(`\nREGZ-INLINE: all ${CONSUMERS.length} consumers byte-identical to ${MODULE_REL}.`);
} else {
  console.log(`\nREGZ-INLINE: ${rewritten} rewritten, ${CONSUMERS.length - rewritten} already in sync.`);
  if (rewritten > 0) {
    console.log('⚠ Kernel bytes moved — these nodes need a re-prove before their seals are valid again.');
  }
}
