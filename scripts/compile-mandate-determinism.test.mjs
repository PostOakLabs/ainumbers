#!/usr/bin/env node
/**
 * compile-mandate-determinism.test.mjs
 * §22.4 compiler determinism gate: same mandate → byte-identical execution_hash.
 * Also validates fixture output_payload against §22 chain_config shape.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');

// Load kernel (pathToFileURL required on Windows for absolute path dynamic imports)
const { compute, buildArtifact } = await import(pathToFileURL(resolve(REPO, 'chaingraph/kernels/art-274-compile-work-mandate.kernel.mjs')).href);

// Load fixtures
const fixtures = JSON.parse(readFileSync(
  resolve(REPO, 'chaingraph/kernels/fixtures/art-274-compile-work-mandate.fixtures.json'), 'utf-8'
));

let failures = 0;

// ── Test 1: determinism — same mandate hashes identically across two runs ──
console.log('Testing compile_work_mandate determinism...');
for (const v of fixtures.vectors) {
  const a1 = await buildArtifact(v.policy_parameters, { now: null });
  const a2 = await buildArtifact(v.policy_parameters, { now: null });
  if (a1.execution_hash !== a2.execution_hash) {
    console.error(`FAIL [determinism] ${v.name}: hash differs across runs`);
    console.error(`  run1: ${a1.execution_hash}`);
    console.error(`  run2: ${a2.execution_hash}`);
    failures++;
  } else {
    console.log(`  OK  [determinism] ${v.name}`);
  }
}

// ── Test 2: golden hash matches ──
console.log('Testing golden hash match...');
for (const v of fixtures.vectors) {
  const art = await buildArtifact(v.policy_parameters, { now: null });
  // golden_hash in fixtures uses bare hex (no sha256: prefix in stored form)
  const stored = v.golden_hash;
  if (!stored) {
    console.log(`  SKIP [golden] ${v.name}: no golden_hash`);
    continue;
  }
  // execution_hash is sha256:<hex>
  const actual = art.execution_hash.replace(/^sha256:/, '');
  if (actual !== stored) {
    console.error(`FAIL [golden] ${v.name}`);
    console.error(`  expected: ${stored}`);
    console.error(`  actual:   ${actual}`);
    failures++;
  } else {
    console.log(`  OK  [golden] ${v.name}`);
  }
}

// ── Test 3: output_payload shape validation ──
console.log('Testing chain_config output shape...');
for (const v of fixtures.vectors) {
  const result = compute(v.policy_parameters);
  const op = result.output_payload;

  if (op.error) {
    // error response is valid for multi-pointer fixtures (none in current set)
    console.log(`  OK  [shape] ${v.name}: rejection payload`);
    continue;
  }

  if (!op.chain_config || !Array.isArray(op.chain_config.steps)) {
    console.error(`FAIL [shape] ${v.name}: chain_config.steps missing or not array`);
    failures++;
    continue;
  }

  let shapeOk = true;
  for (const step of op.chain_config.steps) {
    if (typeof step.tool_id !== 'string' || typeof step.id !== 'string') {
      console.error(`FAIL [shape] ${v.name}: step missing tool_id or id`);
      shapeOk = false;
      failures++;
      break;
    }
    if (step.gate !== undefined) {
      const g = step.gate;
      if (typeof g.input !== 'string') {
        console.error(`FAIL [shape] ${v.name}: gate.input not string`);
        shapeOk = false; failures++; break;
      }
      if (!Array.isArray(g.rules)) {
        console.error(`FAIL [shape] ${v.name}: gate.rules not array`);
        shapeOk = false; failures++; break;
      }
      if (g.default !== 'escalate') {
        console.error(`FAIL [shape] ${v.name}: gate.default must be "escalate", got ${JSON.stringify(g.default)}`);
        shapeOk = false; failures++; break;
      }
      for (const rule of g.rules) {
        if (typeof rule.op !== 'string' || typeof rule.next !== 'string') {
          console.error(`FAIL [shape] ${v.name}: rule missing op or next`);
          shapeOk = false; failures++; break;
        }
      }
    }
    if (!shapeOk) break;
  }
  if (shapeOk) console.log(`  OK  [shape] ${v.name}`);
}

// ── Test 4: multi-pointer rejection ──
console.log('Testing multi-pointer rejection...');
const multiPtrResult = compute({
  mandate: {
    scope: { tool_ids: ['step_a', 'step_b'] },
    conditions: [{ pointer: '/a/x', op: 'eq', value: true }],
    escalation_triggers: [{ pointer: '/b/y', op: 'eq', value: false }],
  },
});
if (multiPtrResult.output_payload.error === 'multi_pointer_gate') {
  console.log('  OK  [multi_pointer] rejected as expected');
} else {
  console.error('FAIL [multi_pointer] expected rejection, got:', JSON.stringify(multiPtrResult.output_payload));
  failures++;
}

// ── Test 5: escalation trigger rule order (triggers before conditions) ──
console.log('Testing rule order: triggers before conditions...');
const mixResult = compute({
  mandate: {
    scope: { tool_ids: ['assess', 'record'] },
    conditions: [{ pointer: '/ok', op: 'eq', value: true }],
    escalation_triggers: [{ pointer: '/ok', op: 'eq', value: false }],
  },
});
const mixSteps = mixResult.output_payload.chain_config.steps;
const gateRules = mixSteps[0].gate.rules;
if (gateRules[0].next === 'escalate' && gateRules[1].next === 'record') {
  console.log('  OK  [rule_order] trigger first, condition second');
} else {
  console.error('FAIL [rule_order] wrong order:', JSON.stringify(gateRules));
  failures++;
}

// Final
if (failures > 0) {
  console.error(`\nFAIL: ${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nPASS: all compile-mandate-determinism tests green.`);
}
