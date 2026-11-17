#!/usr/bin/env node
// gen-webmcp-registrations.manifest-fallback.test.mjs — WEBMCP-SCHEMA-FROM-MANIFEST-1
// done-criteria, under `node --test --test-reporter=dot`.
//
// Gates (from the row):
//   - An UNPARSEABLE kernel (static extraction defeated by pp enumeration) with a
//     valid manifest schema now produces an emittable region: adjudicateTool ok,
//     the fallback is disclosed on the verdict, and the emitted block round-trips
//     byte-exact through insertIntoPage.
//   - A manifest schema that DISAGREES with the fixtures (observable behaviour)
//     stays advisory-flagged: the tool is still emittable, the divergence is
//     carried on the verdict (advisory first — no blocking flip).
//   - Parseable kernels behave exactly as before: CLEARED admission carries no
//     fallback; DIVERGES verdicts still refuse (their resolution is a manifest
//     widening, outside the generator's fence).
//   - The directory listing never claims a tool the pages do not register: a
//     fallback tool whose page carries no generated region yet is not listed;
//     once the region lands it is listed with its input_schema sha.
//
// Hermetic: builds its own tmp manifest/kernel/page/fixtures tree, never touches
// the live estate. Usage:
//   node --test --test-reporter=dot scripts/gen-webmcp-registrations.manifest-fallback.test.mjs

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  adjudicateTool,
  buildDirectoryEntries,
  buildBlockForPage,
  insertIntoPage,
  inputSchemaSha256,
  regionOf,
} from './gen-webmcp-registrations.mjs';
import {
  sweepKernel,
  loadManifestIndex,
  loadMcpNameIndex,
  compareFixturesToSchema,
} from './check-schema-read-divergence.mjs';

const ENUM_KERNEL = [
  "export const meta = { mcp_name: '__MCP__' };",
  'export function compute(pp) {',
  '  const keys = Object.keys(pp);',
  '  return { output_payload: { n: keys.length }, compliance_flags: {} };',
  '}',
].join('\n');

const DIVERGES_KERNEL = [
  "export const meta = { mcp_name: '__MCP__' };",
  'export function compute(pp) {',
  '  const principal = pp.principal; const label = pp.label; const extra = pp.extra_field;',
  '  return { output_payload: { principal, label, extra }, compliance_flags: {} };',
  '}',
].join('\n');

const CLEARED_KERNEL = [
  "export const meta = { mcp_name: '__MCP__' };",
  'export function compute(pp) {',
  '  const principal = pp.principal; const label = pp.label;',
  '  return { output_payload: { principal, label }, compliance_flags: {} };',
  '}',
].join('\n');

function pageBody(ids) {
  const inputs = ids.map((i) => `<input id="${i}">`).join('');
  return [
    '<html><body>',
    inputs,
    '<script>',
    'var _lastArtifact = null;',
    'async function run(){ _lastArtifact = { ok: true }; }',
    '</script>',
    '</body></html>',
  ].join('\n');
}

function manifestJson(toolId, schemaProps, required, defProps, defRequired) {
  const schema = { type: 'object', required: defRequired || required, properties: defProps || schemaProps };
  return {
    tool_id: toolId,
    input_schema: { properties: schemaProps, required },
    mcp_tool_definition: {
      name: `run_${toolId.replace(/-/g, '_')}`,
      description: 'Manifest-fallback selftest tool exercising the sweep-unparseable admission end to end.',
      inputSchema: schema,
    },
    execution: { type: 'browser-javascript', entry: `chaingraph/${toolId}.html`, function_name: 'run', timeout_ms: 3000 },
  };
}

function fixturesJson(toolId, pp) {
  return { tool_id: toolId, vectors: [{ name: 'default-inputs', policy_parameters: pp, output_payload: {}, golden_hash: 'sha256:00' }] };
}

// One tmp tree shared by the tests, built at module load (node:test runs the
// test() bodies only AFTER the module body completes, so the setup must be
// synchronous top-level code and the cleanup must be an after() hook).
const tmp = mkdtempSync(join(tmpdir(), 'gwmr-fallback-'));
after(() => {
  if (process.env.KEEP_FALLBACK_TEST_TMP !== '1') rmSync(tmp, { recursive: true, force: true });
});
{
  const manifestsDir = join(tmp, 'manifests');
  const kernelsDir = join(tmp, 'chaingraph', 'kernels');
  const fixturesDir = join(tmp, 'chaingraph', 'kernels', 'fixtures');
  mkdirSync(manifestsDir, { recursive: true });
  mkdirSync(kernelsDir, { recursive: true });
  mkdirSync(fixturesDir, { recursive: true });

  const P = { principal: { type: 'number', description: 'Principal amount' }, label: { type: 'string', description: 'Display label' } };
  const R = ['principal'];

  // fx-400: the headline case — UNPARSEABLE kernel, valid manifest, full page mapping.
  writeFileSync(join(manifestsDir, 'fx-400-fallback.manifest.json'), JSON.stringify(manifestJson('fx-400-fallback', P, R), null, 2));
  writeFileSync(join(kernelsDir, 'fx-400-fallback.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_400_fallback'));
  writeFileSync(join(tmp, 'chaingraph', 'fx-400-fallback.html'), pageBody(['principal', 'label']));
  writeFileSync(join(fixturesDir, 'fx-400-fallback.fixtures.json'), JSON.stringify(fixturesJson('fx-400-fallback', { principal: 100, label: 'x' })));

  // fx-401: fixtures exercise a key the manifest never declares — advisory divergence.
  writeFileSync(join(manifestsDir, 'fx-401-fallback-divergent.manifest.json'),
    JSON.stringify(manifestJson('fx-401-fallback-divergent', { principal: P.principal }, R), null, 2));
  writeFileSync(join(kernelsDir, 'fx-401-fallback-divergent.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_401_fallback_divergent'));
  writeFileSync(join(tmp, 'chaingraph', 'fx-401-fallback-divergent.html'), pageBody(['principal']));
  writeFileSync(join(fixturesDir, 'fx-401-fallback-divergent.fixtures.json'),
    JSON.stringify(fixturesJson('fx-401-fallback-divergent', { principal: 1, undeclared_extra: 2 })));

  // fx-402: the manifest's two schema writers disagree — fallback refused (G1b).
  {
    const m = manifestJson('fx-402-parity-broken', P, R, { principal: P.principal });
    writeFileSync(join(manifestsDir, 'fx-402-parity-broken.manifest.json'), JSON.stringify(m, null, 2));
    writeFileSync(join(kernelsDir, 'fx-402-parity-broken.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_402_parity_broken'));
    writeFileSync(join(tmp, 'chaingraph', 'fx-402-parity-broken.html'), pageBody(['principal', 'label']));
  }

  // fx-403: fallback passes the sweep leg but the page mapping is incomplete.
  writeFileSync(join(manifestsDir, 'fx-403-mapping-missing.manifest.json'), JSON.stringify(manifestJson('fx-403-mapping-missing', P, R), null, 2));
  writeFileSync(join(kernelsDir, 'fx-403-mapping-missing.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_403_mapping_missing'));
  writeFileSync(join(tmp, 'chaingraph', 'fx-403-mapping-missing.html'), pageBody(['principal']));

  // fx-404: UNPARSEABLE but NO manifest record at all — fallback has nothing to take.
  writeFileSync(join(kernelsDir, 'fx-404-unpaired.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_404_unpaired'));
  writeFileSync(join(tmp, 'chaingraph', 'fx-404-unpaired.html'), pageBody(['principal']));

  // fx-405: DIVERGES kernel — the fallback must NOT admit it.
  writeFileSync(join(manifestsDir, 'fx-405-diverges.manifest.json'), JSON.stringify(manifestJson('fx-405-diverges', P, R), null, 2));
  writeFileSync(join(kernelsDir, 'fx-405-diverges.kernel.mjs'), DIVERGES_KERNEL.replaceAll('__MCP__', 'run_fx_405_diverges'));
  writeFileSync(join(tmp, 'chaingraph', 'fx-405-diverges.html'), pageBody(['principal', 'label']));

  // fx-406: parseable kernel — behaves exactly as before, no fallback on the verdict.
  writeFileSync(join(manifestsDir, 'fx-406-cleared.manifest.json'), JSON.stringify(manifestJson('fx-406-cleared', P, R), null, 2));
  writeFileSync(join(kernelsDir, 'fx-406-cleared.kernel.mjs'), CLEARED_KERNEL.replaceAll('__MCP__', 'run_fx_406_cleared'));
  writeFileSync(join(tmp, 'chaingraph', 'fx-406-cleared.html'), pageBody(['principal', 'label']));

  // fx-407: array-form type on BOTH writers, byte-identical — parity must hold.
  // A naive `!==` comparator refuses two EQUAL arrays (reference compare); the
  // fallback path is the first place UNPARSEABLE kernels ever reach G1b, so this
  // latent break only surfaces for them (live case: art-735, ["string","null"]).
  {
    const PA = { principal: { type: ['string', 'null'], description: 'Principal amount, nullable union type written as an array' } };
    writeFileSync(join(manifestsDir, 'fx-407-array-type-parity.manifest.json'), JSON.stringify(manifestJson('fx-407-array-type-parity', PA, ['principal']), null, 2));
    writeFileSync(join(kernelsDir, 'fx-407-array-type-parity.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_407_array_type_parity'));
    writeFileSync(join(tmp, 'chaingraph', 'fx-407-array-type-parity.html'), pageBody(['principal']));
  }

  // fx-408: array-form types that genuinely differ — parity still refuses.
  {
    const PA = { principal: { type: ['string', 'null'], description: 'Principal amount as a nullable string union' } };
    const PB = { principal: { type: ['number'], description: 'Principal amount as a number union' } };
    writeFileSync(join(manifestsDir, 'fx-408-array-type-drift.manifest.json'), JSON.stringify(manifestJson('fx-408-array-type-drift', PA, ['principal'], PB), null, 2));
    writeFileSync(join(kernelsDir, 'fx-408-array-type-drift.kernel.mjs'), ENUM_KERNEL.replaceAll('__MCP__', 'run_fx_408_array_type_drift'));
    writeFileSync(join(tmp, 'chaingraph', 'fx-408-array-type-drift.html'), pageBody(['principal']));
  }

  const manifestIndex = loadManifestIndex(tmp);
  const mcpNameByTool = loadMcpNameIndex(tmp);

  test('UNPARSEABLE kernel with a valid manifest schema is emittable (fallback disclosed)', () => {
    const rec = sweepKernel(tmp, 'chaingraph/kernels/fx-400-fallback.kernel.mjs', manifestIndex, mcpNameByTool);
    assert.equal(rec.verdict, 'UNPARSEABLE');
    const d = adjudicateTool('fx-400-fallback', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d.ok, true, `expected fallback admission, refused: ${d.reason}`);
    assert.ok(d.fallback, 'verdict must disclose the manifest-schema fallback');
    assert.match(d.fallback.sweep_reason, /Object enumeration over pp/);
    assert.ok(d.detail, 'emit inputs ride the verdict');
    // the emitted block round-trips byte-exact through the writer
    const pageSrc = readFileSync(join(tmp, 'chaingraph', 'fx-400-fallback.html'), 'utf8');
    const block = buildBlockForPage(JSON.parse(readFileSync(join(manifestsDir, 'fx-400-fallback.manifest.json'), 'utf8')), 'manifests/fx-400-fallback.manifest.json', d.detail.resGlobal, undefined, 'run');
    const next = insertIntoPage(pageSrc, block);
    const region = regionOf(next);
    assert.ok(region, 'region present after insert');
    assert.equal(next.slice(region.start, region.end), block);
    assert.match(block, /name: 'run_fx_400_fallback'/);
    // fixture comparison rides the verdict and agrees for fx-400
    assert.ok(d.fallback.fixture_comparison, 'fixture comparison rides the fallback verdict');
    assert.equal(d.fallback.fixture_comparison.status, 'agrees');
  });

  test('manifest schema that disagrees with the fixtures stays advisory-flagged (still emittable)', () => {
    const rec = sweepKernel(tmp, 'chaingraph/kernels/fx-401-fallback-divergent.kernel.mjs', manifestIndex, mcpNameByTool);
    assert.equal(rec.verdict, 'UNPARSEABLE');
    assert.ok(rec.fixture_comparison, 'observable-behaviour comparison attached to the sweep record');
    assert.equal(rec.fixture_comparison.status, 'diverges');
    assert.deepEqual(rec.fixture_comparison.undeclared, ['undeclared_extra']);
    const d = adjudicateTool('fx-401-fallback-divergent', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d.ok, true, 'advisory only — no blocking flip');
    assert.equal(d.fallback.fixture_comparison.status, 'diverges');
  });

  test('pure compareFixturesToSchema units (agree, never-exercised, skipped inputs, no schema)', () => {
    const schema = { properties: { principal: { type: 'number' }, label: { type: 'string' } }, required: ['principal'] };
    const agree = compareFixturesToSchema([{ policy_parameters: { principal: 1, label: 'x' } }], schema);
    assert.equal(agree.status, 'agrees');
    assert.deepEqual(agree.declared_never_exercised, []);
    const partial = compareFixturesToSchema([{ policy_parameters: { principal: 1 } }], schema);
    assert.equal(partial.status, 'agrees');
    assert.deepEqual(partial.declared_never_exercised, ['label']);
    const requiredNever = compareFixturesToSchema([{ policy_parameters: { label: 'x' } }], schema);
    assert.equal(requiredNever.status, 'agrees', 'informational only');
    assert.deepEqual(requiredNever.required_never_exercised, ['principal']);
    const skipped = compareFixturesToSchema([{ policy_parameters: 'not-an-object' }, { policy_parameters: [1] }, null], schema);
    assert.equal(skipped.inputs, 0);
    assert.deepEqual(skipped.keys_exercised, []);
    const noSchema = compareFixturesToSchema([{ policy_parameters: { a: 1 } }], null);
    assert.equal(noSchema.status, 'no-declared-schema');
  });

  test('fallback still refuses: schema-writer parity (G1b), incomplete mapping, no manifest record', () => {
    const d402 = adjudicateTool('fx-402-parity-broken', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d402.ok, false);
    assert.match(d402.reason, /property sets/);
    const d403 = adjudicateTool('fx-403-mapping-missing', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d403.ok, false);
    assert.match(d403.reason, /form-element mapping incomplete/);
    const d404 = adjudicateTool('fx-404-unpaired', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d404.ok, false);
    assert.match(d404.reason, /no manifests/);
  });

  test('G1b array-form types compare by value: byte-identical unions pass, genuine drift refuses', () => {
    const d407 = adjudicateTool('fx-407-array-type-parity', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d407.ok, true, `identical array-form types must pass parity, refused: ${d407.reason}`);
    const d408 = adjudicateTool('fx-408-array-type-drift', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d408.ok, false);
    assert.match(d408.reason, /disagree on type/);
  });

  test('DIVERGES verdicts still refuse; parseable kernels carry no fallback', () => {
    const d405 = adjudicateTool('fx-405-diverges', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d405.ok, false);
    assert.match(d405.reason, /DIVERGES/);
    const d406 = adjudicateTool('fx-406-cleared', tmp, manifestIndex, mcpNameByTool);
    assert.equal(d406.ok, true);
    assert.ok(!d406.fallback, 'parseable admission must not carry a fallback disclosure');
  });

  test('directory listing claims only fallback tools whose page registers (region present)', () => {
    const targets = { cleared: [], manifestFallback: ['fx-400-fallback'], manifestIndex, mcpNameByTool };
    const before = buildDirectoryEntries(tmp, targets);
    assert.deepEqual(before, [], 'region-less fallback tool must not be listed');
    const pageSrc = readFileSync(join(tmp, 'chaingraph', 'fx-400-fallback.html'), 'utf8');
    const block = buildBlockForPage(JSON.parse(readFileSync(join(manifestsDir, 'fx-400-fallback.manifest.json'), 'utf8')), 'manifests/fx-400-fallback.manifest.json', '_lastArtifact', undefined, 'run');
    writeFileSync(join(tmp, 'chaingraph', 'fx-400-fallback.html'), insertIntoPage(pageSrc, block));
    const after = buildDirectoryEntries(tmp, targets);
    assert.equal(after.length, 1);
    assert.equal(after[0].name, 'run_fx_400_fallback');
    const def = JSON.parse(readFileSync(join(manifestsDir, 'fx-400-fallback.manifest.json'), 'utf8')).mcp_tool_definition;
    assert.equal(after[0].input_schema_sha256, inputSchemaSha256(def.inputSchema));
  });
}
