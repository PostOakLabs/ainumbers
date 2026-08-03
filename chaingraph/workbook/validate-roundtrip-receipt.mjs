#!/usr/bin/env node
// validate-roundtrip-receipt.mjs — GATE (XLR-1, WORKBOOK-ROUNDTRIP-BUILD-SPEC.md)
// Validates a Round-Trip Verify-Back Receipt against roundtrip-receipt.schema.json.
// Zero-dependency: same draft-2020-12 subset as validate-input-manifest.mjs
// (type, required, properties, additionalProperties, enum, const, pattern, items,
// minItems, minLength), EXTENDED to resolve a $ref that names a sibling schema
// file (e.g. "input-manifest.schema.json#/properties/..."), since XLR-1's schema
// cross-references WB-2's field definitions rather than restating them.
//
// Usage:
//   node validate-roundtrip-receipt.mjs <receipt.json> [<receipt2.json> ...]
//   node validate-roundtrip-receipt.mjs                 # validates fixtures/roundtrip-receipt.*.json

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, 'roundtrip-receipt.schema.json');
const FIXTURES_DIR = join(HERE, 'fixtures');

const externalSchemaCache = new Map();
function loadExternalSchema(file) {
  if (!externalSchemaCache.has(file)) {
    const p = join(HERE, file);
    externalSchemaCache.set(file, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
  }
  return externalSchemaCache.get(file);
}

function validate(schema, data, root, path, errs) {
  if (schema.$ref) {
    const def = resolveRef(schema.$ref, root);
    if (!def) { errs.push(`${path}: unresolved $ref ${schema.$ref}`); return; }
    return validate(def, data, root, path, errs);
  }
  if (schema.const !== undefined && JSON.stringify(data) !== JSON.stringify(schema.const))
    errs.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(data)))
    errs.push(`${path}: ${JSON.stringify(data)} not in enum [${schema.enum.join(', ')}]`);
  if (schema.type && !typeOk(schema.type, data)) {
    errs.push(`${path}: expected type ${schema.type}, got ${jsType(data)}`);
    return; // further checks assume the type
  }
  if (typeof data === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(data))
      errs.push(`${path}: "${trunc(data)}" does not match /${schema.pattern}/`);
    if (schema.minLength != null && data.length < schema.minLength)
      errs.push(`${path}: shorter than minLength ${schema.minLength}`);
  }
  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems)
      errs.push(`${path}: fewer than minItems ${schema.minItems}`);
    if (schema.items) data.forEach((d, i) => validate(schema.items, d, root, `${path}[${i}]`, errs));
  }
  if (isObj(data)) {
    (schema.required || []).forEach((k) => { if (!(k in data)) errs.push(`${path}: missing required "${k}"`); });
    if (schema.properties)
      for (const [k, s] of Object.entries(schema.properties))
        if (k in data) validate(s, data[k], root, `${path}.${k}`, errs);
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const k of Object.keys(data))
        if (!allowed.has(k)) errs.push(`${path}: additional property "${k}" not allowed (strict)`);
    }
  }
}
function resolveRef(ref, root) {
  if (ref.startsWith('#/')) return ref.slice(2).split('/').reduce((o, seg) => (o ? o[seg] : undefined), root);
  const [file, pointer] = ref.split('#');
  if (!file || !pointer || !pointer.startsWith('/')) return null;
  const ext = loadExternalSchema(file);
  if (!ext) return null;
  return pointer.slice(1).split('/').reduce((o, seg) => (o ? o[seg] : undefined), ext);
}
function typeOk(t, d) {
  if (Array.isArray(t)) return t.some((x) => typeOk(x, d));
  return t === 'object' ? isObj(d)
    : t === 'null' ? d === null
    : t === 'array' ? Array.isArray(d)
    : t === 'string' ? typeof d === 'string'
    : t === 'number' ? typeof d === 'number'
    : t === 'integer' ? Number.isInteger(d)
    : t === 'boolean' ? typeof d === 'boolean'
    : true;
}
const isObj = (d) => d !== null && typeof d === 'object' && !Array.isArray(d);
const jsType = (d) => (Array.isArray(d) ? 'array' : d === null ? 'null' : typeof d);
const trunc = (s) => (s.length > 50 ? s.slice(0, 47) + '…' : s);

// Business rule beyond this draft-2020-12 subset (no if/then support here):
// result is a closed two-value field, so it must agree with mismatches.
function checkResultConsistency(data, path, errs) {
  if (!isObj(data)) return;
  const mismatches = Array.isArray(data.mismatches) ? data.mismatches : [];
  if (data.result === 'match' && mismatches.length > 0)
    errs.push(`${path}: result "match" but mismatches is non-empty`);
  if (data.result === 'mismatch' && mismatches.length === 0)
    errs.push(`${path}: result "mismatch" but mismatches is empty or missing`);
}

if (!existsSync(SCHEMA_PATH)) { console.error(`✗ schema not found: ${SCHEMA_PATH}`); process.exit(1); }
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const argPaths = process.argv.slice(2);
const targets = argPaths.length
  ? argPaths
  : (existsSync(FIXTURES_DIR)
      ? readdirSync(FIXTURES_DIR).filter((n) => n.startsWith('roundtrip-receipt.') && n.endsWith('.json')).map((n) => join(FIXTURES_DIR, n))
      : []);

if (!targets.length) { console.error('✗ no receipt files given and no fixtures/roundtrip-receipt.*.json found'); process.exit(1); }

let failed = 0;
for (const p of targets) {
  const label = basename(p);
  if (!existsSync(p)) { failed++; console.error(`✗ ${label}: not found`); continue; }
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { failed++; console.error(`✗ ${label}: invalid JSON (${e.message})`); continue; }
  const errs = [];
  validate(schema, data, schema, label, errs);
  checkResultConsistency(data, label, errs);
  if (errs.length) { failed++; console.error(`✗ ${label}`); errs.slice(0, 40).forEach((e) => console.error(`    ${e}`)); }
  else console.log(`✓ ${label}`);
}
console.log(`\n${targets.length} checked, ${failed} failed.`);
process.exit(failed ? 1 : 0);
