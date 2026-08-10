// _pbt-common.mjs — shared zero-dep helpers for FV-PROPFLOOR-SHARD-A-TERNARY-1's six
// class-A floor files. NOT itself a *.proptest.mjs — run-proptests.mjs globs only that
// suffix, so this file is never spawned as a standalone test; each kernel's proptest
// file imports it. Per FV-PBT-FLOOR-BUILD-SPEC.md §2: pure Node built-ins only, no
// fast-check, no new dependency.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(HERE, '..', 'fixtures');

export const ENUM_VALUES = ['yes', 'partial', 'no'];

// mulberry32 — deterministic, reproducible seed (same generator shape as
// research/FV-B1-DTI-RATIOS.harness.mjs's proven zero-dep pattern).
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Random policy_parameters over the DECLARED enum domain only (yes/partial/no) —
// class-A floor per spec §3: "declared-enum inputs only", never malformed/out-of-domain.
export function randomAnswers(rng, keys) {
  const pp = {};
  for (const k of keys) pp[k] = pick(rng, ENUM_VALUES);
  return pp;
}

export function allOf(keys, value) {
  const pp = {};
  for (const k of keys) pp[k] = value;
  return pp;
}

export function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Step 2 of the §5/§0.2 pipeline: fixture-oracle gate, mandatory before any property
// is trusted. Loads the kernel's own golden fixtures and diffs compute() output.
// Fixture vectors carry {name, policy_parameters, output_payload, golden_hash} — no
// compliance_flags field (confirmed against all 6 shard fixture files), so only
// output_payload is diffed here.
export function runFixtureOracle(kernelId, compute, wrapPP = (pp) => pp) {
  const fixturesPath = join(FIXTURES_DIR, `${kernelId}.fixtures.json`);
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(wrapPP(vec.policy_parameters));
    const opOk = deepEqual(output_payload, vec.output_payload);
    if (!opOk) {
      failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
    }
  }
  return { total: fixtures.vectors.length, failures };
}

// Recursively assert no NaN / undefined / non-finite number anywhere in a value —
// class-A floor invariant #1 (§3: "output shape, no NaN/undefined").
export function findShapeViolations(value, path = '$') {
  const violations = [];
  if (value === undefined) { violations.push(`${path}: undefined`); return violations; }
  if (typeof value === 'number' && !Number.isFinite(value)) { violations.push(`${path}: non-finite number (${value})`); return violations; }
  if (Array.isArray(value)) {
    value.forEach((v, i) => violations.push(...findShapeViolations(v, `${path}[${i}]`)));
  } else if (value !== null && typeof value === 'object') {
    for (const k of Object.keys(value)) violations.push(...findShapeViolations(value[k], `${path}.${k}`));
  }
  return violations;
}

export function summarize(kernelId, oracleResult, propertyResults) {
  console.log(`=== ${kernelId} — class-A floor property test ===`);
  console.log(`fixture-oracle: ${oracleResult.total - oracleResult.failures.length}/${oracleResult.total} PASS`);
  if (oracleResult.failures.length) {
    console.log('FIXTURE ORACLE FAILURES:', JSON.stringify(oracleResult.failures, null, 2));
  }
  let anyFail = oracleResult.failures.length > 0;
  for (const p of propertyResults) {
    const ok = p.violations === 0;
    anyFail = anyFail || !ok;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${p.name} — ${p.checked} checked, ${p.violations} violations`);
  }
  return !anyFail;
}
