#!/usr/bin/env node
// check-determinism-fixture.mjs — WORKBOOK-1-BUILD-SPEC.md §WB-5 golden-CSV
// determinism gate.
//
// fixtures/golden.csv is a fixed input; fixtures/golden-digest.json pins the
// sha256 digest workbook.mjs's csvDigest() must produce for it, forever. A
// drift in the workbook engine (tokenizer, evaluator, CSV parser, canon path)
// that changes the digest for unchanged input fails this gate locally and in
// CI — it is the cross-check that WB-1's engine stays byte-stable, distinct
// from workbook.test.mjs's self-consistency assertions (same input, same run).
//
// Usage:
//   node chaingraph/workbook/check-determinism-fixture.mjs            # gate
//   node chaingraph/workbook/check-determinism-fixture.mjs --update   # (re)pin the golden digest

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvDigest } from './workbook.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(HERE, 'fixtures', 'golden.csv');
const DIGEST_PATH = resolve(HERE, 'fixtures', 'golden-digest.json');
const UPDATE = process.argv.includes('--update');

const csvText = readFileSync(CSV_PATH, 'utf8');
const digest = await csvDigest(csvText);

if (UPDATE) {
  writeFileSync(DIGEST_PATH, JSON.stringify({ digest }, null, 2) + '\n');
  console.log(`✅ pinned golden digest: ${digest}`);
  process.exit(0);
}

const golden = JSON.parse(readFileSync(DIGEST_PATH, 'utf8'));
if (digest !== golden.digest) {
  console.error('❌ WORKBOOK DETERMINISM DRIFT');
  console.error(`   golden.csv now digests to ${digest}`);
  console.error(`   fixtures/golden-digest.json pins   ${golden.digest}`);
  console.error('   Either the workbook engine changed behavior (investigate before touching');
  console.error('   the pin) or the change is intentional (re-run with --update to re-pin).');
  process.exit(1);
}

console.log(`✅ workbook determinism fixture matches golden digest (${digest})`);
