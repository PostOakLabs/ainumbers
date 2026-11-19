#!/usr/bin/env node
// check-document-span.selftest.mjs - the TIEOUT-SPAN-SCHEMA-1 gate leg.
//
// Proves, on every push:
//   1. every positive fixture validates against chaingraph/standard/ocg-document-span-v1.schema.json
//      and every RECORD_SHAPE_* negative is rejected by it;
//   2. the reference checker (scripts/check-document-span.mjs) returns each fixture's stated
//      structural / verifiable / reason_code verdict;
//   3. RED control A (GATE-SELFTEST-META-1 pairing): a mutated checker with the row-key uniqueness
//      guard disarmed stops refusing the repeated-key fixture, proving the rule is load-bearing;
//   4. RED control B: a mutated checker that answers `external` for an incomplete record is caught
//      by the suite, proving the fail-closed rule is load-bearing;
//   5. the CLI wrapper exits 0 on a positive fixture and 1 on a negative one.
//
// Mutations run on temp copies under .tmp/ written by this selftest and imported with a
// cache-busting URL; the committed checker is never modified. Zero-dependency, node builtins only.

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyDocumentSpan } from './check-document-span.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const SCHEMA_PATH = join(REPO_ROOT, 'chaingraph', 'standard', 'ocg-document-span-v1.schema.json');
const FIXTURE_DIR = join(REPO_ROOT, 'chaingraph', 'standard', 'fixtures', 'document-span');
const CHECKER_PATH = join(HERE, 'check-document-span.mjs');
const TMP = join(REPO_ROOT, '.tmp', 'document-span-selftest-mutations');

let failures = 0;
function fail(msg) {
  failures++;
  console.error('check-document-span.selftest: FAIL ' + msg);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}

// ---- minimal JSON Schema (draft 2020-12 subset) validator ----
// Mirrors the keyword subset chaingraph/standard/schema-validate.mjs implements: type, required,
// properties, additionalProperties, enum, const, pattern, items, minItems, minLength, minimum,
// oneOf, $ref to local $defs. Not a general engine; this profile's schema uses exactly this subset.
function schemaValidate(schema, data, root, path, errs) {
  if (schema.$ref) {
    const def = schema.$ref.startsWith('#/$defs/')
      ? (root.$defs || {})[schema.$ref.slice('#/$defs/'.length)]
      : undefined;
    if (def === undefined) { errs.push(path + ': unresolved $ref ' + schema.$ref); return; }
    return schemaValidate(def, data, root, path, errs);
  }
  if (schema.oneOf) {
    const branchErrs = schema.oneOf.map((s) => { const e = []; schemaValidate(s, data, root, path, e); return e; });
    const passing = branchErrs.filter((e) => e.length === 0).length;
    if (passing !== 1) errs.push(path + ': matched ' + passing + ' of ' + schema.oneOf.length + ' oneOf branches (need exactly 1)');
    return;
  }
  if (schema.const !== undefined && JSON.stringify(data) !== JSON.stringify(schema.const)) {
    errs.push(path + ': expected const ' + JSON.stringify(schema.const));
  }
  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(data))) {
    errs.push(path + ': ' + JSON.stringify(data) + ' not in enum');
  }
  if (schema.type && !typeOk(schema.type, data)) {
    errs.push(path + ': expected type ' + schema.type + ', got ' + jsType(data));
    return;
  }
  if (typeof data === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errs.push(path + ': ' + JSON.stringify(data.slice(0, 40)) + ' does not match ' + schema.pattern);
    if (schema.minLength != null && data.length < schema.minLength) errs.push(path + ': shorter than minLength ' + schema.minLength);
  }
  if (typeof data === 'number' && schema.minimum != null && data < schema.minimum) {
    errs.push(path + ': ' + data + ' < minimum ' + schema.minimum);
  }
  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems) errs.push(path + ': fewer than minItems ' + schema.minItems);
    if (schema.items) data.forEach((e, i) => schemaValidate(schema.items, e, root, path + '[' + i + ']', errs));
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    for (const req of schema.required || []) {
      if (!Object.hasOwn(data, req)) errs.push(path + ': missing required ' + JSON.stringify(req));
    }
    for (const key of Object.keys(data)) {
      const prop = (schema.properties || {})[key];
      if (prop) schemaValidate(prop, data[key], root, path + '/' + key, errs);
      else if (schema.additionalProperties === false) errs.push(path + ': additional property ' + JSON.stringify(key) + ' refused');
    }
  }
}
function typeOk(type, data) {
  if (type === 'object') return data !== null && typeof data === 'object' && !Array.isArray(data);
  if (type === 'array') return Array.isArray(data);
  if (type === 'string') return typeof data === 'string';
  if (type === 'number') return typeof data === 'number';
  if (type === 'integer') return typeof data === 'number' && Number.isInteger(data);
  if (type === 'boolean') return typeof data === 'boolean';
  if (type === 'null') return data === null;
  return false;
}
function jsType(data) {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  return typeof data;
}

// ---- the fixture legs -----------------------------------------------------------

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const names = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort();
if (names.length === 0) fail('no fixtures found in ' + FIXTURE_DIR);

let positives = 0, negatives = 0, schemaAccept = 0, schemaReject = 0;
for (const name of names) {
  const fx = JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));
  const isShapeRefusal = typeof fx.expect.reason_code === 'string' && fx.expect.reason_code.startsWith('RECORD_SHAPE_');

  // Leg 1: schema accept/reject. A well-formed record (any semantic verdict) is schema-valid; a
  // RECORD_SHAPE_* refusal must be schema-invalid, keyword for keyword.
  const errs = [];
  schemaValidate(schema, fx.record, schema, '$', errs);
  if (isShapeRefusal) {
    schemaReject++;
    if (errs.length === 0) fail(name + ': schema accepted a record the shape rules must refuse (' + fx.expect.reason_code + ')');
  } else {
    schemaAccept++;
    if (errs.length > 0) fail(name + ': schema rejected a well-formed record: ' + errs.slice(0, 3).join(' | '));
  }

  // Leg 2: the reference checker's verdict matches the fixture's stated expectation.
  const verdict = verifyDocumentSpan(fx.record, {
    documentText: typeof fx.document === 'string' ? fx.document : undefined,
    policyParameters: fx.policy_parameters === null ? undefined : fx.policy_parameters,
  });
  if (verdict.structural !== fx.expect.structural) {
    fail(name + ': structural ' + verdict.structural + ' != expected ' + fx.expect.structural + ' (' + verdict.reason_code + ')');
  }
  if (verdict.verifiable !== fx.expect.verifiable) {
    fail(name + ': verifiable ' + verdict.verifiable + ' != expected ' + fx.expect.verifiable + ' (' + verdict.reason_code + ')');
  }
  if (verdict.reason_code !== fx.expect.reason_code) {
    fail(name + ': reason_code ' + verdict.reason_code + ' != expected ' + fx.expect.reason_code);
  }
  if (fx.expect.verifiable === 'verified' || fx.expect.verifiable === 'external') positives++; else negatives++;
}
if (positives < 6) fail('fewer than six positive fixtures: ' + positives);
if (negatives < 16) fail('fewer than sixteen negative fixtures: ' + negatives);

// ---- RED control A: disarm the row-key uniqueness guard ---------------------------
// SPAN-UNIQUENESS-GUARD mutates `rowKeyOccurrences > 1` to `rowKeyOccurrences < 1` so the repeated
// key sails through: the fixture that must be refused as ambiguous stops being refused, which is
// exactly the reordered-file hazard the rule exists for.
const source = readFileSync(CHECKER_PATH, 'utf8');
const UNIQUENESS = 'rowKeyOccurrences > 1';
if (!source.includes(UNIQUENESS)) fail('mutation target not found in checker source: ' + UNIQUENESS);
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const mutatedAPath = join(TMP, 'check-document-span.mutated-uniqueness.mjs');
// The mutated copy lives two levels deeper than scripts/, so its relative imports are repointed.
writeFileSync(mutatedAPath, source.replace(UNIQUENESS, 'rowKeyOccurrences < 1').replaceAll("'../chaingraph/", "'../../chaingraph/"));
const mutatedA = (await import(pathToFileURL(mutatedAPath).href + '?run=a')).verifyDocumentSpan;
const repeatedKey = JSON.parse(readFileSync(join(FIXTURE_DIR, 'neg-02-repeated-key.json'), 'utf8'));
const mutatedAVerdict = mutatedA(repeatedKey.record, { documentText: repeatedKey.document, policyParameters: repeatedKey.policy_parameters });
assert(
  mutatedAVerdict.reason_code !== 'ROW_KEY_AMBIGUOUS',
  'red control A: the uniqueness-disarmed mutation still refuses neg-02 as ambiguous (' + mutatedAVerdict.reason_code + ') - the control proves nothing'
);
const committedAVerdict = verifyDocumentSpan(repeatedKey.record, { documentText: repeatedKey.document, policyParameters: repeatedKey.policy_parameters });
assert(committedAVerdict.reason_code === 'ROW_KEY_AMBIGUOUS', 'red control A: committed checker lost the ambiguity refusal');

// ---- RED control B: external for an incomplete record ------------------------------
// SPAN-EXTERNAL-MARKER mutates the shape-refusal return so an incomplete record is answered
// `external` - the exact false-green the fail-closed rule exists to prevent.
const EXTERNAL_TARGET = "report(record, 'fail', 'failed', shape.reason_code, shape.detail)";
if (!source.includes(EXTERNAL_TARGET)) fail('mutation target not found in checker source: ' + EXTERNAL_TARGET);
const mutatedBPath = join(TMP, 'check-document-span.mutated-external.mjs');
writeFileSync(mutatedBPath, source.replace(EXTERNAL_TARGET, "report(record, 'pass', 'external', 'MUTATED_EXTERNAL', shape.detail)").replaceAll("'../chaingraph/", "'../../chaingraph/"));
const mutatedB = (await import(pathToFileURL(mutatedBPath).href + '?run=b')).verifyDocumentSpan;
const incomplete = JSON.parse(readFileSync(join(FIXTURE_DIR, 'neg-39-no-document-shape-invalid.json'), 'utf8'));
const mutatedBVerdict = mutatedB(incomplete.record, { policyParameters: incomplete.policy_parameters });
assert(
  mutatedBVerdict.verifiable === 'external' && mutatedBVerdict.reason_code === 'MUTATED_EXTERNAL',
  'red control B: the mutation did not produce the external-on-incomplete verdict it exists to expose'
);
const committedBVerdict = verifyDocumentSpan(incomplete.record, { policyParameters: incomplete.policy_parameters });
assert(committedBVerdict.verifiable === 'failed', 'red control B: committed checker answered an incomplete record with ' + committedBVerdict.verifiable);

// ---- Leg 3: the CLI wrapper --------------------------------------------------------
const posFx = JSON.parse(readFileSync(join(FIXTURE_DIR, 'pos-01-csv-cell-row-key.json'), 'utf8'));
const negFx = JSON.parse(readFileSync(join(FIXTURE_DIR, 'neg-02-repeated-key.json'), 'utf8'));
const posDoc = join(TMP, 'pos-01.document.csv');
const posPol = join(TMP, 'pos-01.policy.json');
const posRec = join(TMP, 'pos-01.record.json');
const negRec = join(TMP, 'neg-02.record.json');
const negDoc = join(TMP, 'neg-02.document.csv');
const negPol = join(TMP, 'neg-02.policy.json');
writeFileSync(posDoc, posFx.document);
writeFileSync(posPol, JSON.stringify(posFx.policy_parameters));
writeFileSync(posRec, JSON.stringify(posFx.record));
writeFileSync(negRec, JSON.stringify(negFx.record));
writeFileSync(negDoc, negFx.document);
writeFileSync(negPol, JSON.stringify(negFx.policy_parameters));
const runCli = (recordPath, docArgs) => execFileSync(process.execPath, [CHECKER_PATH, '--record', recordPath, ...docArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let cliOk = 0, cliRed = 0;
try { runCli(posRec, ['--document', posDoc, '--policy', posPol]); cliOk++; } catch (e) { fail('CLI leg: positive fixture exited non-zero: ' + String(e.status)); }
try { runCli(negRec, ['--document', negDoc, '--policy', negPol]); fail('CLI leg: negative fixture exited zero'); }
catch (e) {
  if (e.status === 1) cliRed++;
  else fail('CLI leg: negative fixture exited ' + String(e.status) + ' (usage/IO error, not a verdict)');
}
if (!cliOk) fail('CLI leg: positive exit-0 never ran');
if (!cliRed) fail('CLI leg: negative exit-1 never ran');

rmSync(TMP, { recursive: true, force: true });

if (failures > 0) {
  console.error('check-document-span.selftest: RED - ' + failures + ' failure(s) across ' + names.length + ' fixtures');
  process.exit(1);
}
console.log('check-document-span.selftest: GREEN - ' + names.length + ' fixtures (positive ' + positives + ', negative ' + negatives
  + '), schema accept ' + schemaAccept + ' / reject ' + schemaReject
  + ', 2 red controls red-then-green (uniqueness guard, external-on-incomplete), CLI exit 0/1 proven');
