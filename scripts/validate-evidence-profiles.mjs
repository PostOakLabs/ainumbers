#!/usr/bin/env node
// validate-evidence-profiles.mjs — GATE (EF-2, EVIDENCE-FRESHNESS-BUILD-SPEC.md §EF-2)
// Validates chaingraph/evidence-profiles.manifest.json against
// chaingraph/schemas/evidence-profile.manifest.schema.json. Zero-dependency: implements
// the same draft-2020-12 SUBSET as chaingraph/standard/schema-validate.mjs (type, required,
// properties, additionalProperties, enum, const, pattern, items, minItems, minLength).
// Standalone (not imported from schema-validate.mjs, which is hard-wired to chaingraph.json)
// so this row never touches PROOFBADGE-1/SSOT-owned files.
//
// Usage: node scripts/validate-evidence-profiles.mjs

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SCHEMA_PATH = join(ROOT, 'chaingraph', 'schemas', 'evidence-profile.manifest.schema.json');
const DATA_PATH = join(ROOT, 'chaingraph', 'evidence-profiles.manifest.json');

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
    return;
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
if (!existsSync(DATA_PATH)) { console.error(`✗ manifest not found: ${DATA_PATH}`); process.exit(1); }

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const errs = [];
validate(schema, data, schema, 'evidence-profiles.manifest.json', errs);

if (errs.length) {
  console.error(`✗ evidence-profiles.manifest.json (${errs.length} error${errs.length === 1 ? '' : 's'})`);
  errs.slice(0, 40).forEach((e) => console.error(`    ${e}`));
  process.exit(1);
}
console.log(`✓ evidence-profiles.manifest.json — ${data.profiles.length} profiles valid against evidence-profile.manifest.schema.json`);
process.exit(0);
