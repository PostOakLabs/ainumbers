#!/usr/bin/env node
// validate-input-manifest.mjs — GATE (WB-2, WORKBOOK-1-BUILD-SPEC.md §WB-2)
// Validates a Spreadsheet Input Manifest against input-manifest.schema.json.
// Zero-dependency: implements the SAME draft-2020-12 SUBSET as
// chaingraph/standard/schema-validate.mjs and scripts/validate-evidence-profiles.mjs
// (type, required, properties, additionalProperties, enum, const, pattern, items,
// minItems, minLength). Standalone -- not imported from either sibling validator,
// so this row touches no SSOT-owned file.
//
// Usage:
//   node validate-input-manifest.mjs <manifest.json> [<manifest2.json> ...]
//   node validate-input-manifest.mjs                 # validates fixtures/*.json

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, 'input-manifest.schema.json');
const FIXTURES_DIR = join(HERE, 'fixtures');

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
  if (!ref.startsWith('#/')) return null;
  return ref.slice(2).split('/').reduce((o, seg) => (o ? o[seg] : undefined), root);
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

if (!existsSync(SCHEMA_PATH)) { console.error(`✗ schema not found: ${SCHEMA_PATH}`); process.exit(1); }
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const argPaths = process.argv.slice(2);
const targets = argPaths.length
  ? argPaths
  : (existsSync(FIXTURES_DIR) ? readdirSync(FIXTURES_DIR).filter((n) => n.endsWith('.json')).map((n) => join(FIXTURES_DIR, n)) : []);

if (!targets.length) { console.error('✗ no manifest files given and no fixtures/*.json found'); process.exit(1); }

let failed = 0;
for (const p of targets) {
  const label = basename(p);
  if (!existsSync(p)) { failed++; console.error(`✗ ${label}: not found`); continue; }
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { failed++; console.error(`✗ ${label}: invalid JSON (${e.message})`); continue; }
  const errs = [];
  validate(schema, data, schema, label, errs);
  if (errs.length) { failed++; console.error(`✗ ${label}`); errs.slice(0, 40).forEach((e) => console.error(`    ${e}`)); }
  else console.log(`✓ ${label}`);
}
console.log(`\n${targets.length} checked, ${failed} failed.`);
process.exit(failed ? 1 : 0);
