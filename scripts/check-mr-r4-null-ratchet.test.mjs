#!/usr/bin/env node
// check-mr-r4-null-ratchet.test.mjs — paired red-proof for the R4 null-class ratchet
// (MR-R4-NULL-REGRESSION-GATE-1), under `node --test --test-reporter=dot`.
//
// SO #40b / GATE-SELFTEST-META-1 pairing: the gate (check-mr-r4-null-ratchet.mjs) and this
// proof land together. Three layers, all in-memory or emitted-code — none touches a kernel
// file, a manifest, or the committed baseline:
//
//   1. RATCHET CONTROLS (planted, both directions — a gate nobody has watched fire has not
//      been observed at all): a measurement ABOVE the pin REGRESSES (new violating kernel,
//      per-kernel worsening, offsetting move that keeps the total flat), one AT the pin is
//      green and silent, one BELOW it greens with the tighten hint.
//
//   2. DETECTOR CONTROLS: the in-repo replication of the instrument's R4 cell fires on the
//      two canonical defect shapes from the design note (the `Number(null) === 0` scalar
//      coercion — art-215/art-271's mechanism; the `= {}` destructuring default that skips
//      null and throws — art-135/art-180's mechanism) and HOLDS for a kernel answering null
//      as absent and for one refusing both sides.
//
//   3. IDENTICAL-execution_hash AT EACH NORMALIZING CALLER (the row's step 4 — the one
//      property SPEC.md §4 re-verifiability rests on for the normalized preimage form, and
//      the one an outsider would ask for). A null-carrying call and its null-free twin must
//      produce the identical execution_hash through the REAL emitted registration code and
//      the REAL kernel hash (chaingraph/kernels/_hash.mjs):
//        • the WebMCP DIRECT caller: buildDirectBlock's emitted execute() normalizes params
//          before the manifest fn; the fn hashes exactly what it receives, so the twins
//          MUST hash identically — and the manifest fn must be able to SEE that the null
//          member is gone (normalize-before-compute, never normalize-in-the-hash).
//        • the WebMCP DOM-prefill caller: buildBlock's emitted execute() maps params onto
//          the page's controls; a null optional and an absent key must leave the controls
//          — and therefore the page's derived policy_parameters and its hash — identical.
//          (The x_null_distinct write-through is asserted as the declared third state.)
//      The MCP-worker caller lives in the worker repo (MR-R4-NULL-NORMALIZE-WORKER-1,
//      PR #383) and is out of this repo's fence; its normalizer shares this suite's vector
//      set via gen-webmcp-registrations.null-normalize.test.mjs.
//
// Usage: node --test --test-reporter=dot scripts/check-mr-r4-null-ratchet.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRatchet, r4Variants, classifyR4Variant } from './check-mr-r4-null-ratchet.mjs';
import { buildDirectBlock, buildBlock } from './gen-webmcp-registrations.mjs';
import { executionHash } from '../chaingraph/kernels/_hash.mjs';

// ---------------------------------------------------------------------------
// 1. Ratchet controls — planted, both directions (RED above the pin, GREEN at/below).
// ---------------------------------------------------------------------------

const BASELINE = {
  total_violations: 2,
  kernels_with_violations: ['k-a', 'k-b'],
  per_kernel_violations: { 'k-a': 1, 'k-b': 1 },
};

test('ratchet RED: a NEW violating kernel regresses, named', () => {
  const v = evaluateRatchet(BASELINE, { total: 3, per_kernel: { 'k-a': 1, 'k-b': 1, 'k-new': 1 } });
  assert.equal(v.verdict, 'REGRESSION');
  assert.ok(v.regressions.some((r) => r.includes('k-new: NEW violating kernel (0 -> 1)')), v.regressions.join('; '));
});

test('ratchet RED: a per-kernel worsening regresses even with the total unchanged (offsetting move)', () => {
  const v = evaluateRatchet(BASELINE, { total: 2, per_kernel: { 'k-a': 2, 'k-b': 0, 'k-c': 0 } });
  assert.equal(v.verdict, 'REGRESSION');
  assert.ok(v.regressions.some((r) => r.includes('k-a: 1 -> 2')), v.regressions.join('; '));
});

test('ratchet RED: a total above the ceiling regresses', () => {
  const v = evaluateRatchet(BASELINE, { total: 5, per_kernel: { 'k-a': 1, 'k-b': 1, 'k-x': 1, 'k-y': 1, 'k-z': 1 } });
  assert.equal(v.verdict, 'REGRESSION');
  assert.ok(v.regressions.some((r) => r.includes('total: ceiling 2 -> 5')), v.regressions.join('; '));
});

test('ratchet GREEN: exactly at the pin — no regressions, no improvements, silent', () => {
  const v = evaluateRatchet(BASELINE, { total: 2, per_kernel: { 'k-a': 1, 'k-b': 1 } });
  assert.equal(v.verdict, 'GREEN');
  assert.deepEqual(v.regressions, []);
  assert.deepEqual(v.improvements, []);
});

test('ratchet GREEN below the pin: the fixed kernel is named as a tighten improvement', () => {
  const v = evaluateRatchet(BASELINE, { total: 1, per_kernel: { 'k-a': 1 } });
  assert.equal(v.verdict, 'GREEN');
  assert.deepEqual(v.regressions, []);
  assert.ok(v.improvements.some((r) => r.includes('k-b: 1 -> 0')), v.improvements.join('; '));
  assert.ok(v.improvements.some((r) => r.includes('total: 2 -> 1')), v.improvements.join('; '));
});

test('ratchet is tamper-evident: a non-finite ceiling is refused, never compared', () => {
  assert.throws(() => evaluateRatchet({ ...BASELINE, total_violations: Infinity }, { total: 0, per_kernel: {} }),
    /finite/);
});

// ---------------------------------------------------------------------------
// 2. Detector controls — the instrument's R4 cell replication fires on the two
//    canonical mechanisms and holds where the relation holds.
// ---------------------------------------------------------------------------

test('detector RED (scalar mechanism): Number(null) === 0 diverges from absent — ABSENT_NULL_DIVERGE', async () => {
  // art-215's safeNum shape in miniature: the finiteness check lets 0 through where
  // absent (NaN) falls to the default — Number(null) === 0 is finite, exactly the defect.
  const mod = { meta: { gpu: false }, compute: async (pp) => { const n = Number(pp.x); return { out: { v: Number.isFinite(n) ? n : 12 } }; } };
  const [variant] = r4Variants({ x: 12 }, {});
  const fail = await classifyR4Variant(variant, mod);
  assert.equal(fail?.code, 'ABSENT_NULL_DIVERGE');
  assert.equal(fail?.key, 'x');
});

test('detector RED (object mechanism): `= {}` default skips null and throws — ONE_SIDE_THREW on the transformed side', async () => {
  // art-135's shape in miniature: destructuring defaults fire on undefined only.
  const mod = { meta: { gpu: false }, compute: async (pp) => { const { o = {} } = pp; return { out: { f: String(o.f).trim() } }; } };
  const [variant] = r4Variants({ o: { f: 'x' } }, {});
  const fail = await classifyR4Variant(variant, mod);
  assert.equal(fail?.code, 'ONE_SIDE_THREW');
  assert.equal(fail?.threw, 'b');
});

test('detector GREEN: a kernel answering null exactly as absent holds', async () => {
  const mod = { meta: { gpu: false }, compute: async (pp) => ({ out: { v: pp.x === undefined || pp.x === null ? 12 : pp.x } }) };
  const [variant] = r4Variants({ x: 12 }, {});
  assert.equal(await classifyR4Variant(variant, mod), null);
});

test('detector GREEN: a kernel refusing null AND absent holds by refusal (same error both sides)', async () => {
  const mod = { meta: { gpu: false }, compute: async (pp) => { if (pp.x === undefined || pp.x === null) throw new Error('x required'); return { out: { v: pp.x } }; } };
  const [variant] = r4Variants({ x: 12 }, {});
  assert.equal(await classifyR4Variant(variant, mod), null);
});

test('detector: keys already holding null are not selected (the pair would be vacuous)', () => {
  assert.deepEqual(r4Variants({ x: null, y: 1 }, {}).map((v) => v.ctx.key), ['y']);
});

// ---------------------------------------------------------------------------
// 3. Identical-execution_hash at each normalizing caller — through the REAL emitted
//    registration code and the REAL kernel hash.
// ---------------------------------------------------------------------------

function firstScriptSrc(block) {
  return block.match(/<script>([\s\S]*?)<\/script>/)[1];
}

/** Evaluate an emitted registration <script> the way a browser would: feature-detect the
 *  WebMCP API (navigator.modelContext), capture the registerTool payload. Free page
 *  identifiers (the manifest fn, the render fn, the result global) arrive as function
 *  parameters — the same device the generator's --check uses for emitted-code parsing. */
function evaluateRegistration(src, { pageFns = {}, resGlobal } = {}) {
  let captured = null;
  const mc = { registerTool: (t) => { captured = t; } };
  const factory = new Function(
    'document', 'navigator', ...Object.keys(pageFns), ...(resGlobal ? [resGlobal] : []),
    src
  );
  const documentStub = {
    modelContext: undefined,
    getElementById: () => ({ textContent: '', value: '', checked: false }),
    createElement: () => ({ id: '', textContent: '' }),
    querySelector: () => null,
    body: { insertBefore: () => {}, firstChild: null },
  };
  factory(documentStub, { modelContext: mc }, ...Object.values(pageFns), ...(resGlobal ? [undefined] : []));
  assert.ok(captured, 'the emitted registration must register a tool when the WebMCP API is present');
  assert.equal(typeof captured.execute, 'function');
  return captured;
}

const DIRECT_MANIFEST = {
  mcp_tool_definition: {
    name: 'compute_r4_hash_twin',
    description: 'fixture: null-carrying call vs null-free twin must hash identically',
    inputSchema: {
      type: 'object',
      required: ['spot'],
      properties: {
        spot: { type: 'number' },
        mode: { type: 'string', description: 'optional; null means not supplied' },
      },
    },
  },
  execution: { function_name: 'runFxNormalize' },
};

test('DIRECT caller: a null-carrying call and its null-free twin produce the IDENTICAL execution_hash', async () => {
  const block = buildDirectBlock(DIRECT_MANIFEST, 'manifests/r4-fixture.manifest.json', '_r4Result', 'renderFx');
  const seen = [];
  // The page's manifest fn hashes exactly the input it receives (the kernel's own
  // executionHash over {policy_parameters, output_payload} — SPEC.md §4).
  const captured = evaluateRegistration(firstScriptSrc(block), {
    pageFns: {
      runFxNormalize: async (pp) => {
        seen.push(JSON.parse(JSON.stringify(pp)));
        return { execution_hash: await executionHash(pp, { echoed: pp }) };
      },
      renderFx: async () => {},
    },
    resGlobal: '_r4Result',
  });
  const withNull = await captured.execute({ spot: 101.5, mode: null });
  const withoutKey = await captured.execute({ spot: 101.5 });
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0], { spot: 101.5 }, 'the manifest fn must receive the NORMALIZED form — the null member is gone before compute');
  assert.deepEqual(seen[1], { spot: 101.5 });
  assert.equal(typeof withNull.execution_hash, 'string');
  assert.equal(withNull.execution_hash, withoutKey.execution_hash, 'identical compute input ⇒ identical execution_hash (SPEC.md §4)');
});

test('DIRECT caller: a genuinely different payload still hashes differently (the equality is not a dead pass)', async () => {
  const block = buildDirectBlock(DIRECT_MANIFEST, 'manifests/r4-fixture.manifest.json', '_r4Result', 'renderFx');
  const captured = evaluateRegistration(firstScriptSrc(block), {
    pageFns: {
      runFxNormalize: async (pp) => ({ execution_hash: await executionHash(pp, { echoed: pp }) }),
      renderFx: async () => {},
    },
    resGlobal: '_r4Result',
  });
  const base = await captured.execute({ spot: 101.5 });
  const other = await captured.execute({ spot: 102.0 });
  assert.notEqual(base.execution_hash, other.execution_hash);
});

const PREFILL_MANIFEST = {
  mcp_tool_definition: {
    name: 'compute_r4_prefill_twin',
    description: 'fixture: prefill maps params onto controls; null optional === absent',
    inputSchema: {
      type: 'object',
      required: ['principal'],
      properties: {
        principal: { type: 'number' },
        flag: { type: 'boolean', description: 'optional' },
        na: { type: 'string', x_null_distinct: true, description: 'null is a declared third state' },
      },
    },
  },
  execution: { function_name: 'runPrefillTool' },
};

/** A DOM stub the emitted mapping lines can write into, with a read-back that mimics a
 *  page's getParams(): the page derives its policy_parameters from the controls. */
function makeDomStub() {
  const elements = new Map();
  return {
    document: {
      modelContext: undefined,
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, { value: '', checked: false });
        return elements.get(id);
      },
      createElement: () => ({ id: '', textContent: '' }),
      querySelector: () => null,
      body: { insertBefore: () => {}, firstChild: null },
    },
    readBack: () => {
      const pp = {};
      for (const [id, el] of elements) {
        if (id === 'principal') pp[id] = Number(el.value);
        else if (id === 'flag') pp[id] = el.checked === true;
        else if (id === 'na') { if (el.value !== '') pp[id] = el.value; }
      }
      return pp;
    },
  };
}

async function runPrefill(params) {
  const block = buildBlock(PREFILL_MANIFEST, 'manifests/r4-prefill-fixture.manifest.json', {});
  const dom = makeDomStub();
  let captured = null;
  const mc = { registerTool: (t) => { captured = t; } };
  // The mapping lines must write into THIS dom stub, so the emitted script is evaluated
  // with it (the same new Function device as evaluateRegistration, per-call stub).
  const factory = new Function('document', 'navigator', 'runPrefillTool', 'RESULT_GLOBAL', firstScriptSrc(block) + '\n;return 0;');
  factory(dom.document, { modelContext: mc }, async () => {}, undefined);
  assert.ok(captured, 'the emitted prefill registration must register a tool');
  await captured.execute(params);
  return dom.readBack();
}

test('PREFILL caller: a null-carrying call and its null-free twin leave identical controls → identical execution_hash', async () => {
  const fromNull = await runPrefill({ principal: 1000, flag: null });
  const fromAbsent = await runPrefill({ principal: 1000 });
  assert.deepEqual(fromNull, fromAbsent, 'a null optional is skipped, exactly like absent — the derived policy_parameters must not differ');
  const h1 = await executionHash(fromNull, { fixed: true });
  const h2 = await executionHash(fromAbsent, { fixed: true });
  assert.equal(h1, h2, 'identical derived policy_parameters ⇒ identical execution_hash (SPEC.md §4)');
});

test('PREFILL caller: the skip is null-specific — a real value still moves the hash, and the x_null_distinct third state is written', async () => {
  const base = await runPrefill({ principal: 1000 });
  const withValue = await runPrefill({ principal: 1000, flag: true });
  assert.deepEqual(withValue, { principal: 1000, flag: true }, 'a non-null optional is still written (the guard is not a dead skip-everything)');
  assert.notEqual(await executionHash(base, { fixed: true }), await executionHash(withValue, { fixed: true }));
  const withDeclaredNull = await runPrefill({ principal: 1000, na: null });
  assert.deepEqual(withDeclaredNull, { principal: 1000, na: 'null' }, 'x_null_distinct keeps the write-through: null is a declared third state there');
  assert.notEqual(await executionHash(base, { fixed: true }), await executionHash(withDeclaredNull, { fixed: true }));
});
