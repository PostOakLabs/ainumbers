// art-804-receipt-export-envelopes — class-K property-test FLOOR + envelope conformance test.
// kernel_digest_at_authoring: sha256:b9a03535dc4c0719919b7b28d8798d813b4ecb12b6cdeed9eade9da6e61e4cae
// spec: research/RECEIPT-EXPORT-PIN-2026-10-29.md (pins the two wire specs this kernel emits;
//       snapshots under research/clause-snapshots/receipt-export/, schema vendored with its
//       LICENSE at chaingraph/kernels/fixtures/vendor/openlineage-1.55.0/)
// human_sign_off: builder-authored 2026-11-02 (LANDSCAPE-RECEIPT-EXPORT-ENVELOPES-RESUME-1)
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Gates this file carries:
//   1. fixture oracle parity (all golden vectors, including the fail-closed refusal);
//   2. EVERY emitted RunEvent validates against the vendored OpenLineage.json schema
//      (static vectors AND 400 randomized receipts);
//   3. every emitted event envelope carries all REQUIRED context attributes of the pinned
//      event-envelope core spec (id, source, specversion, type) plus the structured-mode
//      members this node declares (time, datacontenttype, data);
//   4. determinism: same receipt in, byte-identical envelope JSON out;
//   5. fail-closed: any mutated hash/timestamp/URI member is refused, never exported;
//   6. runId bit layout: version nibble 8, variant bits 10, derived only from the receipt.
//
// Run: node chaingraph/kernels/__proptests__/art-804-receipt-export-envelopes.proptest.mjs

import { compute } from '../art-804-receipt-export-envelopes.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, NASTY_STRINGS } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KERNEL_ID = 'art-804-receipt-export-envelopes';
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
const SCHEMA = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'vendor', 'openlineage-1.55.0', 'OpenLineage.json'), 'utf8'));

// ---------- minimal JSON Schema validator (the keyword subset the pinned schema uses) ----
function validate(schema, value, defs, path = '$') {
  const errors = [];
  if (schema === true) return errors;
  if (schema === false) { errors.push(`${path}: schema false`); return errors; }
  if (schema.$ref) {
    const name = schema.$ref.replace(/^#\/\$defs\//, '');
    return validate(defs[name], value, defs, path);
  }
  for (const comb of ['allOf', 'anyOf', 'oneOf']) {
    if (schema[comb]) {
      const branches = schema[comb].map((b) => validate(b, value, defs, path));
      const passing = branches.filter((b) => b.length === 0);
      if (comb === 'allOf') branches.forEach((b) => errors.push(...b));
      if (comb === 'anyOf' && passing.length === 0) errors.push(`${path}: failed anyOf (${branches.map((b) => b.join('; ')).join(' | ')})`);
      if (comb === 'oneOf' && passing.length !== 1) errors.push(`${path}: expected exactly one oneOf branch, got ${passing.length}`);
    }
  }
  if (schema.not && validate(schema.not, value, defs, path).length === 0) {
    errors.push(`${path}: matched a forbidden (not) schema`);
  }
  const t = schema.type;
  if (t) {
    const ok = (t === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value))
      || (t === 'array' && Array.isArray(value))
      || (t === 'string' && typeof value === 'string')
      || (t === 'number' && typeof value === 'number')
      || (t === 'boolean' && typeof value === 'boolean')
      || (t === 'null' && value === null);
    if (!ok) { errors.push(`${path}: expected type ${t}`); return errors; }
  }
  if (schema.enum && !schema.enum.some((e) => deepEqual(e, value))) errors.push(`${path}: not in enum`);
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (schema.required) {
      for (const k of schema.required) {
        if (!(k in value)) errors.push(`${path}: missing required member ${k}`);
      }
    }
    if (schema.properties) {
      for (const k of Object.keys(value)) {
        if (k in schema.properties) errors.push(...validate(schema.properties[k], value[k], defs, `${path}.${k}`));
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(value)) {
        if (!(k in schema.properties)) errors.push(`${path}: additional member ${k} not allowed`);
      }
    } else if (typeof schema.additionalProperties === 'object') {
      for (const k of Object.keys(value)) {
        if (!schema.properties || !(k in schema.properties)) {
          errors.push(...validate(schema.additionalProperties, value[k], defs, `${path}.${k}`));
        }
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validate(schema.items, item, defs, `${path}[${i}]`)));
  }
  if (typeof value === 'string' && schema.format) {
    if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
      errors.push(`${path}: not canonical uuid form`);
    }
    if (schema.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(value)) {
      errors.push(`${path}: not date-time form`);
    }
    if (schema.format === 'uri' && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      errors.push(`${path}: not absolute-uri form`);
    }
  }
  return errors;
}

function validateRunEvent(evt) {
  const errors = validate(SCHEMA, evt, SCHEMA.$defs);
  // The root oneOf accepts RunEvent/DatasetEvent/JobEvent; a passing branch is enough,
  // but our envelope must be the RunEvent branch specifically.
  if (validate({ $ref: '#/$defs/RunEvent' }, evt, SCHEMA.$defs).length > 0) {
    errors.push('$: does not validate as the RunEvent branch');
  }
  return errors;
}

// ---------- randomized receipt generator (test-time randomness only; kernel stays pure) ---
const HEX = '0123456789abcdef';
function randHash(rng) {
  let s = '';
  for (let i = 0; i < 64; i++) s += HEX[Math.floor(rng() * 16)];
  return s;
}
function randToolId(rng, i) {
  return `art-${700 + Math.floor(rng() * 90)}-step-${i}`;
}
function randReceipt(rng, i) {
  const nParents = Math.floor(rng() * 4);
  const parents = [];
  for (let p = 0; p < nParents; p++) parents.push([randHash(rng), randToolId(rng, p)]);
  const offsets = ['Z', '+01:00', '-05:30'];
  return {
    tool_id: `art-801-agent-run-${i}`,
    execution_hash: randHash(rng),
    parent_hashes: parents.map((p) => p[0]),
    parent_tool_ids: parents.map((p) => p[1]),
    chain_depth: nParents,
    policy_parameters_hash: randHash(rng),
    event_time: `2026-1${Math.floor(rng() * 2)}-2${Math.floor(rng() * 8)}T0${Math.floor(rng() * 9)}:15:30.${Math.floor(rng() * 999)}${offsets[Math.floor(rng() * offsets.length)]}`,
    source: `https://ainumbers.example/chain/${i}`,
    namespace: rng() < 0.5 ? 'ainumbers.co' : 'example.internal',
  };
}

// ---------- properties -------------------------------------------------------------------
function checkSchemaConformanceStatic() {
  let checked = 0, violations = 0;
  for (const vec of FIXTURES.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (output_payload.status !== 'exported') continue;
    checked++;
    const errs = validateRunEvent(output_payload.lineage_event);
    if (errs.length > 0) { violations++; console.log(`  schema-conformance static [${vec.name}]:`, errs.slice(0, 5)); }
  }
  return { name: 'every static exported RunEvent validates against the vendored OpenLineage.json', checked, violations };
}

function checkSchemaConformanceRandom() {
  const rng = mulberry32(804001);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = { receipt: randReceipt(rng, i) };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.status !== 'exported' || !compliance_flags.includes('RECEIPT_EXPORTED')) { violations++; continue; }
    const errs = validateRunEvent(output_payload.lineage_event);
    if (errs.length > 0) { violations++; console.log(`  schema-conformance random [${i}]:`, errs.slice(0, 5)); }
  }
  return { name: 'every randomized exported RunEvent validates against the vendored OpenLineage.json (400 cases)', checked, violations };
}

function checkCloudEventsRequired() {
  const REQUIRED = ['id', 'source', 'specversion', 'type'];
  const rng = mulberry32(804002);
  let checked = 0, violations = 0;
  const receipts = FIXTURES.vectors.map((v) => v.policy_parameters).concat(
    Array.from({ length: 50 }, (_, i) => ({ receipt: randReceipt(rng, i) })),
  );
  for (const pp of receipts) {
    const { output_payload } = compute(pp);
    if (output_payload.status !== 'exported') continue;
    checked++;
    const ev = output_payload.event_envelope;
    for (const k of REQUIRED) {
      if (!(k in ev) || ev[k] === null || ev[k] === '') { violations++; console.log(`  cloudevents required: missing ${k}`); }
    }
    for (const k of ['time', 'datacontenttype', 'data']) {
      if (!(k in ev)) { violations++; console.log(`  cloudevents structured-mode: missing ${k}`); }
    }
    if (ev.specversion !== '1.0') { violations++; console.log('  cloudevents: wrong specversion'); }
    if (ev.type !== 'co.ainumbers.ocg.receipt.v1') { violations++; console.log('  cloudevents: wrong type'); }
    if (ev.id !== pp.receipt.execution_hash) { violations++; console.log('  cloudevents: id is not the execution_hash'); }
    if (!deepEqual(ev.data.parent_hashes, pp.receipt.parent_hashes) || ev.data.chain_depth !== pp.receipt.chain_depth) {
      violations++; console.log('  cloudevents: data is not the receipt fields unchanged');
    }
  }
  return { name: 'every emitted envelope carries all REQUIRED attributes of the pinned event-envelope spec, data unchanged', checked, violations };
}

function checkDeterminism() {
  const rng = mulberry32(804003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = { receipt: randReceipt(rng, i) };
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    const c = JSON.stringify(compute({ receipt: JSON.parse(JSON.stringify(pp.receipt)) }).output_payload);
    checked++;
    if (a !== b || a !== c) { violations++; console.log(`  determinism: receipt ${i} not byte-identical across calls`); }
  }
  return { name: 'same receipt always gives a byte-identical export (proptest, 100 cases)', checked, violations };
}

function checkRunIdBits() {
  const rng = mulberry32(804004);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = { receipt: randReceipt(rng, i) };
    const { output_payload } = compute(pp);
    if (output_payload.status !== 'exported') continue;
    checked++;
    const runId = output_payload.lineage_event.run.runId;
    const hex = runId.replace(/-/g, '');
    const b6 = parseInt(hex.slice(12, 14), 16), b8 = parseInt(hex.slice(16, 18), 16);
    if ((b6 & 0xf0) !== 0x80) { violations++; console.log(`  runId: version nibble not 8 in ${runId}`); }
    if ((b8 & 0xc0) !== 0x80) { violations++; console.log(`  runId: variant bits not 10 in ${runId}`); }
  }
  return { name: 'runId carries version nibble 8 and variant bits 10, derived from the receipt hash only', checked, violations };
}

function checkRunIdByteIdentity() {
  let checked = 0, violations = 0;
  for (const vec of FIXTURES.vectors) {
    const pp = vec.policy_parameters;
    if (pp.receipt.execution_hash.length !== 64) continue;
    const { output_payload } = compute(pp);
    checked++;
    const hex = output_payload.lineage_event.run.runId.replace(/-/g, '');
    const bytes = pp.receipt.execution_hash.slice(0, 32).match(/.{2}/g).map((h) => parseInt(h, 16));
    const got = hex.match(/.{2}/g).map((h) => parseInt(h, 16));
    let same = true;
    for (let i = 0; i < 16; i++) {
      if (i === 6) { if ((got[i] & 0xf0) !== 0x80 || (got[i] & 0x0f) !== (bytes[i] & 0x0f)) same = false; }
      else if (i === 8) { if ((got[i] & 0xc0) !== 0x80 || (got[i] & 0x3f) !== (bytes[i] & 0x3f)) same = false; }
      else if (got[i] !== bytes[i]) same = false;
    }
    if (!same) {
      violations++; console.log(`  runId bytes differ from hash prefix for ${vec.name}`);
    }
  }
  return { name: 'runId hex equals the first 16 bytes of the execution_hash modulo the version/variant bit sets', checked, violations };
}

function checkInputsFacetDialect() {
  let checked = 0, violations = 0;
  for (const vec of FIXTURES.vectors) {
    const pp = vec.policy_parameters;
    const { output_payload } = compute(pp);
    if (output_payload.status !== 'exported') continue;
    checked++;
    const inputs = output_payload.lineage_event.inputs;
    if (inputs.length !== pp.receipt.parent_hashes.length) { violations++; console.log(`  inputs count mismatch for ${vec.name}`); }
    inputs.forEach((ds, i) => {
      if (ds.name !== pp.receipt.parent_hashes[i]) { violations++; console.log(`  input ${i} not named by parent hash for ${vec.name}`); }
      if (ds.namespace !== pp.receipt.namespace) { violations++; console.log(`  input ${i} namespace mismatch for ${vec.name}`); }
      if (ds.type !== 'table') { violations++; console.log(`  input ${i} not in the dataset-facet dialect (type) for ${vec.name}`); }
    });
  }
  return { name: 'one dataset per parent hash, named by hash, in the estate lineage-card facet dialect', checked, violations };
}

function checkFailClosed() {
  const rng = mulberry32(804005);
  let checked = 0, violations = 0;
  const base = randReceipt(rng, 0);
  const mutations = [];
  const mut = (fn) => mutations.push(fn);
  mut((r) => ({ ...r, execution_hash: 'XYZ' }));
  mut((r) => ({ ...r, execution_hash: r.execution_hash.slice(0, 63) }));
  mut((r) => ({ ...r, execution_hash: r.execution_hash.toUpperCase() }));
  mut((r) => ({ ...r, execution_hash: undefined }));
  mut((r) => { const { event_time, ...rest } = r; return rest; });
  mut((r) => ({ ...r, event_time: '2026-02-30T00:00:00Z' }));
  mut((r) => ({ ...r, event_time: 'not a time' }));
  mut((r) => ({ ...r, event_time: '2026-11-02 09:00:00' }));
  mut((r) => ({ ...r, source: 'has space in it' }));
  mut((r) => ({ ...r, source: '' }));
  mut((r) => ({ ...r, source: 'bad%2zcape' }));
  mut((r) => ({ ...r, source: 'trailing%2' }));
  mut((r) => ({ ...r, source: undefined }));
  mut((r) => ({ ...r, namespace: '' }));
  mut((r) => ({ ...r, tool_id: '' }));
  mut((r) => ({ ...r, policy_parameters_hash: 'deadbeef' }));
  mut((r) => ({ ...r, parent_hashes: ['ab'], parent_tool_ids: ['x'] }));
  mut((r) => ({ ...r, parent_hashes: [], parent_tool_ids: ['x'] }));
  mut((r) => ({ ...r, chain_depth: -1 }));
  mut((r) => ({ ...r, chain_depth: 1.5 }));
  mut(() => null);
  mut(() => 'receipt');
  for (const nasty of NASTY_STRINGS.slice(0, 8)) {
    mut((r) => ({ ...r, source: nasty }));
    mut((r) => ({ ...r, event_time: nasty }));
    mut((r) => ({ ...r, execution_hash: nasty }));
  }
  for (const fn of mutations) {
    const r = fn(base);
    checked++;
    const { output_payload, compliance_flags } = compute({ receipt: r });
    if (output_payload.status !== 'refused' || compliance_flags[0] !== 'RECEIPT_EXPORT_REFUSED') {
      violations++; console.log(`  fail-closed: mutation accepted: ${JSON.stringify(r).slice(0, 120)}`);
    }
    if (output_payload.lineage_event !== null || output_payload.event_envelope !== null) {
      violations++; console.log('  fail-closed: refused result still carries envelopes');
    }
  }
  return { name: 'fail-closed: every mutated/malformed hash, timestamp or URI-reference is refused, never exported', checked, violations };
}

function checkProhibitedGlobals() {
  // the kernel must stay deterministic: these members must not appear anywhere in its source
  const src = readFileSync(join(HERE, '..', `${KERNEL_ID}.kernel.mjs`), 'utf8');
  const forbidden = ['Date.now', 'Math.random', 'new Date(', 'TextEncoder', 'atob(', 'btoa(', 'fetch(', 'XMLHttpRequest'];
  const hits = forbidden.filter((f) => src.includes(f));
  let checked = forbidden.length, violations = 0;
  for (const h of hits) { violations++; console.log(`  prohibited-global: kernel source contains ${h}`); }
  return { name: 'kernel source contains no clock, randomness, encoding-builtin or network call', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkSchemaConformanceStatic(),
  checkSchemaConformanceRandom(),
  checkCloudEventsRequired(),
  checkDeterminism(),
  checkRunIdBits(),
  checkRunIdByteIdentity(),
  checkInputsFacetDialect(),
  checkFailClosed(),
  checkProhibitedGlobals(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — receipt export envelopes.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
