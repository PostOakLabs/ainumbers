#!/usr/bin/env node
// gen-webmcp-registrations.null-normalize.test.mjs — MR-R4-NULL-NORMALIZE-WEBMCP-1
// done-criteria, under `node --test --test-reporter=dot`.
//
// Gates (from the row):
//   - DIRECT mode normalizes `params` BEFORE the compute call: the emitted
//     registration contains the normalize call and the manifest fn is invoked
//     with the normalized input, never the raw params.
//   - DOM-prefill SKIPS a null optional instead of writing the literal string
//     "null" into the input (mappingLine guard goes null-and-undefined).
//   - `x_null_distinct` on a manifest input property is the exclusion, wired on
//     both surfaces (normalize opt-out + mapping-line write-through).
//   - normalizer behaviour IDENTICAL to the worker row's (MR-R4-NULL-NORMALIZE-
//     WORKER-1, worker PR #383, PostOakLabs/ainumbers-mcp-apps, merged
//     2026-09-20). The two surfaces cannot share a file (separate repos), so
//     they SHARE A TEST VECTOR SET, and this file is the one that says which:
//     THE NINE UNIT VECTORS of the worker repo's `tests/null-normalize.test.mjs`
//     (six deep-equal input/expected triples plus the non-mutation,
//     idempotence/fixed-point, and reference-passthrough cases — same inputs,
//     same schemas, same assertions). The worker suite runs those vectors
//     against `_null_normalize.mjs`; THIS suite runs the same nine against BOTH
//     the generator's Node-side export `normalizeNullMembers` AND the emitted
//     browser form (`EMITTED_NULL_NORMALIZER_SRC`) evaluated with `new Function`
//     exactly as a browser would define it — so neither textual form can fork
//     behaviourally without going red here, and a fork from the worker contract
//     goes red in the repo whose suite still passes.
//
// The five-findings browser-agent re-run (row work step 5) is a measurement
// recorded in the row check-off / PR body, not a unit gate; its probe lives in
// the research scratch, not in this suite.
//
// Usage: node --test --test-reporter=dot scripts/gen-webmcp-registrations.null-normalize.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNullMembers,
  EMITTED_NULL_NORMALIZER_SRC,
  buildDirectBlock,
  buildBlock,
} from './gen-webmcp-registrations.mjs';

// The emitted browser form, evaluated the way a browser evaluates it (a plain
// function declaration in a script). `new Function` is the same device the
// generator's own --check uses to prove emitted regions parse.
const browserNormalize = new Function('return (' + EMITTED_NULL_NORMALIZER_SRC + ')')();

// ---------------------------------------------------------------------------
// The SHARED vector set — worker PR #383, tests/null-normalize.test.mjs,
// unit section, verbatim inputs and assertions. Run against BOTH forms.
// ---------------------------------------------------------------------------

// Deep-equal triples (worker cases 1, 2, 3, 7, 8, 9).
const VECTORS = [
  {
    name: 'removes null-valued object members at every depth',
    run: (n) => {
      const input = { a: 1, b: null, c: { d: null, e: 2, f: { g: null, h: 3 } } };
      assert.deepEqual(n(input), { a: 1, c: { e: 2, f: { h: 3 } } });
    },
  },
  {
    name: 'PRESERVES null array elements — they are positional',
    run: (n) => {
      const input = { arr: [1, null, { a: null, b: 2 }, null, 3] };
      assert.deepEqual(n(input), { arr: [1, null, { b: 2 }, null, 3] });
    },
  },
  {
    name: 'null array elements survive at the top level and inside nested arrays',
    run: (n) => {
      assert.deepEqual(n([null, { x: [null, null] }]), [null, { x: [null, null] }]);
    },
  },
  {
    name: 'x_null_distinct opt-out: a manifest property declaring it keeps null as a third state',
    run: (n) => {
      const schema = {
        type: 'object',
        properties: {
          disclosure_status: { type: 'string', x_null_distinct: true }, // null = "explicitly N/A"
          periods_per_year: { type: 'integer' },
        },
      };
      const input = { disclosure_status: null, periods_per_year: null };
      assert.deepEqual(n(input, schema), { disclosure_status: null });
    },
  },
  {
    name: 'x_null_distinct is honoured at depth via nested properties',
    run: (n) => {
      const schema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: { flag: { type: 'string', x_null_distinct: true }, other: { type: 'number' } },
          },
        },
      };
      const input = { nested: { flag: null, other: null } };
      assert.deepEqual(n(input, schema), { nested: { flag: null } });
    },
  },
  {
    name: 'with no schema (or no properties entry) nulls are removed everywhere',
    run: (n) => {
      assert.deepEqual(n({ a: null }, undefined), {});
      assert.deepEqual(n({ a: null }, {}), {});
      assert.deepEqual(n({ a: null }, { properties: {} }), {});
    },
  },
];

for (const v of VECTORS) {
  for (const [label, fn] of [['Node export', normalizeNullMembers], ['emitted browser form', browserNormalize]]) {
    test(`shared vector set / ${label}: ${v.name}`, () => v.run(fn));
  }
}

// Reference-identity cases (worker cases 4, 5, 6) — same inputs, same assertions.
for (const [label, fn] of [['Node export', normalizeNullMembers], ['emitted browser form', browserNormalize]]) {
  test(`shared vector set / ${label}: never mutates the input`, () => {
    const input = { a: null, b: { c: null, d: [{ e: null }] } };
    const snapshot = JSON.stringify(input);
    fn(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  test(`shared vector set / ${label}: idempotent — its own output is a fixed point`, () => {
    const input = { a: null, b: { c: null, d: [1, null, { e: null }] }, f: 2 };
    const once = fn(input);
    const twice = fn(once);
    assert.deepEqual(twice, once);
    assert.equal(twice, once); // unchanged subtree returns the SAME reference — a true fixed point
  });

  test(`shared vector set / ${label}: returns the original reference when nothing changes; passes through scalars and null`, () => {
    const o = { a: 1, b: { c: 'x' } };
    assert.equal(fn(o), o);
    const arr = [1, [2], { q: 3 }];
    assert.equal(fn(arr), arr);
    assert.equal(fn(null), null);
    assert.equal(fn(7), 7);
    assert.equal(fn('s'), 's');
  });
}

// ---------------------------------------------------------------------------
// Registration-level gates
// ---------------------------------------------------------------------------

// A minimal manifest shaped like the real ones (buildDirectBlock reads
// mcp_tool_definition + execution.function_name and is pure).
const DIRECT_MANIFEST = {
  mcp_tool_definition: {
    name: 'compute_fx_normalize',
    description: 'fixture',
    inputSchema: {
      type: 'object',
      required: ['spot'],
      properties: {
        spot: { type: 'number' },
        mode: { type: 'string', description: 'optional' },
        na: { type: 'string', x_null_distinct: true, description: 'null is meaningful here' },
      },
    },
  },
  execution: { function_name: 'runFxNormalize' },
};

test('DIRECT registration: normalize call emitted BEFORE the compute call, schema embedded verbatim', () => {
  const block = buildDirectBlock(DIRECT_MANIFEST, 'manifests/fx.manifest.json', '_lastResult', 'renderFx');
  const normalizeAt = block.indexOf('__normalizeNullMembers(params');
  const schemaLiteral = JSON.stringify(JSON.stringify(DIRECT_MANIFEST.mcp_tool_definition.inputSchema));
  const computeAt = block.indexOf('await runFxNormalize(__computeInput);');
  assert.ok(normalizeAt !== -1, 'emitted registration must contain the normalize call');
  assert.ok(computeAt !== -1, 'emitted registration must call the manifest fn with __computeInput');
  assert.ok(normalizeAt < computeAt, 'normalize must run BEFORE the compute call');
  assert.ok(!block.includes('await runFxNormalize(params);'), 'the raw params must never reach compute');
  assert.ok(block.includes(`var __computeInput = __normalizeNullMembers(params, ${schemaLiteral});`),
    'the registration inputSchema is handed to the normalizer (x_null_distinct flows through)');
  assert.ok(block.includes(EMITTED_NULL_NORMALIZER_SRC.replace(/\n/g, '\n      ')),
    'the browser normalizer source is embedded verbatim');
  // The whole emitted script still parses as JavaScript (same device as --check).
  assert.doesNotThrow(() => new Function(block.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('DIRECT registration: the embedded browser normalizer, extracted from the block, honours the embedded schema (x_null_distinct end-to-end)', () => {
  const block = buildDirectBlock(DIRECT_MANIFEST, 'manifests/fx.manifest.json', '_lastResult', 'renderFx');
  // Pull the schema literal exactly as the emitted call carries it (a JS string
  // literal), then drive the embedded normalizer against it the way execute() would.
  const callLine = block.split('\n').find((l) => l.includes('var __computeInput = __normalizeNullMembers(params'));
  const lit = callLine.match(/__normalizeNullMembers\(params, ("(?:[^"\\]|\\.)*")\);/)[1];
  const schema = JSON.parse(JSON.parse(lit));
  const src = block.slice(block.indexOf('var __normalizeNullMembers = ') + 'var __normalizeNullMembers = '.length);
  // The helper ends where the __computeInput line begins; drop the statement's
  // trailing semicolon so the slice is a bare function expression.
  const fn = new Function('return (' + src.slice(0, src.indexOf('\n      var __computeInput')).trim().replace(/;$/, '') + ')')();
  const agent = { spot: 101.5, mode: null, na: null };
  assert.deepEqual(fn(agent, schema), { spot: 101.5, na: null });
  assert.deepEqual(agent, { spot: 101.5, mode: null, na: null }); // agent's object untouched
});

test('DOM-prefill: a null optional is SKIPPED, not stringified into the input; required stays unguarded', () => {
  const PREFILL_MANIFEST = {
    mcp_tool_definition: {
      name: 'compute_fx_prefill',
      description: 'fixture',
      inputSchema: {
        type: 'object',
        required: ['principal'],
        properties: {
          principal: { type: 'number' },
          flag: { type: 'boolean' },
          na: { type: 'string', x_null_distinct: true },
        },
      },
    },
    execution: { function_name: 'run' },
  };
  const block = buildBlock(PREFILL_MANIFEST, 'manifests/fx2.manifest.json', {}, 'run');
  // MR-R4-NULL-NORMALIZE-WEBMCP-1: null AND undefined are skipped for optional props…
  assert.ok(block.includes("if (params.flag !== undefined && params.flag !== null) document.getElementById('flag').checked = params.flag === true;"));
  // …a required prop stays unguarded (its own typed validation already rejects null)…
  assert.ok(block.includes("document.getElementById('principal').value = String(params.principal);"));
  assert.ok(!block.includes('if (params.principal !== undefined'));
  // …and an x_null_distinct optional keeps the write-through (null is a third state there,
  // matching the worker row's opt-out semantics).
  assert.ok(block.includes("if (params.na !== undefined) document.getElementById('na').value = String(params.na);"));
  assert.ok(!block.includes("params.na !== undefined && params.na !== null"));
});
