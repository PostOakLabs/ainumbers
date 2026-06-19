#!/usr/bin/env node
// OpenChainGraph Conformance Runner
// Usage:
//   node run.mjs           — load each fixture, run its kernel, check output + hash, exit 1 on any failure
//   node run.mjs --update  — rewrite expected_execution_hash in-place after computing it
//
// Loads fixtures from vectors/*.fixture.json, resolves kernels from KERNELS registry.

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const UPDATE = process.argv.includes('--update');

// Kernel registry lives one level up
const { KERNELS } = await import('../kernels/index.mjs');
const { executionHash } = await import('../kernels/_hash.mjs');

// ── helpers ──────────────────────────────────────────────────────────────────

function canonSort(v) {
  if (Array.isArray(v)) return v.map(canonSort);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()
      .reduce((o, k) => { o[k] = canonSort(v[k]); return o; }, {});
  }
  return v;
}

// Stable JSON comparison (sort keys recursively before stringifying)
function stableJson(v) {
  return JSON.stringify(canonSort(v));
}

// Deep-equal via stable JSON
function deepEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

// Subset check: every key in `expected` must match the corresponding value in `actual`.
// Keys not present in `expected` are ignored (allows fixtures to omit locale-sensitive fields).
function subsetEqual(actual, expected) {
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    return deepEqual(actual, expected);
  }
  for (const k of Object.keys(expected)) {
    if (!(k in actual)) return false;
    if (!subsetEqual(actual[k], expected[k])) return false;
  }
  return true;
}

// ── load fixtures ─────────────────────────────────────────────────────────────

const vectorDir = join(__dir, 'vectors');
const files = readdirSync(vectorDir)
  .filter(f => f.endsWith('.fixture.json'))
  .sort();

if (files.length === 0) {
  console.error('No fixture files found in conformance/vectors/');
  process.exit(1);
}

// ── run ───────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

for (const file of files) {
  const fixturePath = join(vectorDir, file);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const { tool_id, policy_parameters, expected_output_payload, expected_execution_hash } = fixture;

  console.log(`\n── ${file} ──`);

  // 1. Resolve kernel
  const kernel = KERNELS[tool_id];
  if (!kernel || typeof kernel.compute !== 'function') {
    console.error(`  SKIP — no kernel found for tool_id: ${tool_id}`);
    failures.push({ file, reason: `no kernel for ${tool_id}` });
    failed++;
    continue;
  }

  // 2. Run compute()
  let result;
  try {
    result = kernel.compute(policy_parameters);
  } catch (err) {
    console.error(`  FAIL — kernel.compute() threw: ${err.message}`);
    failures.push({ file, reason: `compute threw: ${err.message}` });
    failed++;
    continue;
  }

  // art-01 returns { output_payload, compliance_flags, verdict, checks }
  // art-09 returns { output_payload, compliance_flags }
  // art-34 returns payload fields directly (no output_payload wrapper)
  // If the kernel wraps in output_payload, use that; otherwise treat the whole result as the payload.
  const actualPayload = result.output_payload !== undefined
    ? result.output_payload
    : result;

  // 3. Output check: subset match (keys present in fixture must match; omitted keys are ignored)
  // This accommodates locale-sensitive fields (e.g. toLocaleString()) that vary by runtime.
  let outputPass = false;
  if (subsetEqual(actualPayload, expected_output_payload)) {
    outputPass = true;
    console.log('  output  ✓ PASS — output_payload matches fixture (subset check)');
  } else {
    console.error('  output  ✗ FAIL — output_payload mismatch');
    console.error('  expected:', stableJson(expected_output_payload).slice(0, 300));
    console.error('  actual  :', stableJson(actualPayload).slice(0, 300));
  }

  // 4. Hash check
  // Hash preimage is always (policy_parameters, output_payload) — use actualPayload as output_payload
  const computedHashHex = await executionHash(policy_parameters, actualPayload);
  const computedHash = `sha256:${computedHashHex}`;

  let hashPass = false;
  const isPlaceholder = !expected_execution_hash || expected_execution_hash === 'sha256:COMPUTE_ON_FIRST_RUN';

  if (isPlaceholder) {
    if (UPDATE) {
      fixture.expected_execution_hash = computedHash;
      writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
      console.log(`  hash    ✓ UPDATED — pinned ${computedHash}`);
      hashPass = true;
    } else {
      console.log(`  hash    ⊘ SKIP  — placeholder; run with --update to pin`);
      hashPass = true; // don't fail on placeholder
    }
  } else if (expected_execution_hash === computedHash) {
    hashPass = true;
    console.log(`  hash    ✓ PASS — ${computedHash}`);
  } else {
    console.error(`  hash    ✗ FAIL`);
    console.error(`  expected: ${expected_execution_hash}`);
    console.error(`  computed: ${computedHash}`);
  }

  if (outputPass && hashPass) {
    passed++;
  } else {
    failures.push({ file, outputPass, hashPass });
    failed++;
  }
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`OCG Conformance: ${passed} passed, ${failed} failed (${files.length} total)`);
if (failures.length > 0) {
  console.error('\nFailed fixtures:');
  failures.forEach(f => console.error(`  • ${f.file}${f.reason ? ' — ' + f.reason : ''}`));
  process.exit(1);
}
console.log('All conformance checks passed.');
