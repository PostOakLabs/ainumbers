// check-manifest-schema.mjs — full-shape JSON Schema validation for every
// manifests/*.manifest.json file against chaingraph/schemas/manifest.schema.json.
// check-manifest-parity.mjs only diffs one field pair (mcp_tool_definition.name
// vs chaingraph.json mcp_name); this checks the entire manifest shape — required
// fields, types, no stray/typo'd keys — which nothing checked before (SSOT
// survey 2026-07-14). Baseline-shielded: pre-existing violations are grandfathered
// in scripts/manifest-schema-baseline.json, new violations fail immediately.
//
// Zero-dependency by design (repo convention, CONTRACT.md §0): implements the
// draft-2020-12 SUBSET manifest.schema.json actually uses (type incl. union
// types, required, properties, additionalProperties, items, minLength, $ref,
// oneOf) — same pattern as chaingraph/standard/schema-validate.mjs.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SCHEMA_PATH = resolve(REPO, 'chaingraph', 'schemas', 'manifest.schema.json');
const MANIFESTS_DIR = resolve(REPO, 'manifests');
const BASELINE_PATH = resolve(REPO, 'scripts', 'manifest-schema-baseline.json');

// ---- minimal JSON Schema (draft 2020-12 subset) validator ----
// Mirrors chaingraph/standard/schema-validate.mjs's validate() — kept as a
// separate small copy here rather than a shared import, since that script is
// a standalone CLI entry point, not a library module.
function validate(schema, data, root, path, errs) {
  if (schema.$ref) {
    const def = resolveRef(schema.$ref, root);
    if (!def) { errs.push(`${path}: unresolved $ref ${schema.$ref}`); return; }
    return validate(def, data, root, path, errs);
  }
  if (schema.oneOf) {
    const branchErrs = schema.oneOf.map((s) => { const e = []; validate(s, data, root, path, e); return e; });
    const passing = branchErrs.filter((e) => e.length === 0).length;
    if (passing !== 1) {
      errs.push(`${path}: matched ${passing} of ${schema.oneOf.length} oneOf branches (need exactly 1)`);
      const closest = branchErrs.reduce((a, b) => (b.length < a.length ? b : a));
      closest.slice(0, 4).forEach((e) => errs.push(`  ↳ ${e}`));
    }
    return;
  }
  if (schema.type && !typeOk(schema.type, data)) {
    errs.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${jsType(data)}`);
    return; // further checks assume the type
  }
  if (typeof data === 'string' && schema.minLength != null && data.length < schema.minLength)
    errs.push(`${path}: shorter than minLength ${schema.minLength}`);
  if (Array.isArray(data) && schema.items)
    data.forEach((d, i) => validate(schema.items, d, root, `${path}[${i}]`, errs));
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
  if (Array.isArray(t)) return t.some((x) => typeOk(x, d)); // union type, e.g. ["object","boolean"]
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

// ---- run ----
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const update = process.argv.includes('--update');
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { files: {} };

const files = readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.manifest.json'));
const violations = {}; // file -> [messages]

for (const f of files) {
  const path = resolve(MANIFESTS_DIR, f);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    violations[f] = [`invalid JSON: ${e.message}`];
    continue;
  }
  const errs = [];
  validate(schema, doc, schema, '', errs);
  if (errs.length) violations[f] = errs;
}

if (update) {
  const next = { files: {} };
  for (const f of Object.keys(violations).sort()) next.files[f] = violations[f];
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(next, null, 2) + '\n',
    'utf8'
  );
  console.log(`✓ manifest-schema baseline updated — ${Object.keys(next.files).length} pre-existing violation(s) shielded.`);
  process.exit(0);
}

const newViolations = [];
let shielded = 0;
for (const [f, msgs] of Object.entries(violations)) {
  const known = baseline.files[f];
  if (known && JSON.stringify(known) === JSON.stringify(msgs)) {
    shielded++;
    continue;
  }
  newViolations.push([f, msgs]);
}

// Baseline entries for files that now pass are stale credit, not a failure —
// they just mean the debt burned down; --update refreshes the file to reflect that.

if (newViolations.length) {
  console.error(`✗ manifest-schema FAILED — ${newViolations.length} new violation(s) (${shielded} pre-existing shielded by baseline):`);
  for (const [f, msgs] of newViolations) {
    console.error(`  • ${f}`);
    for (const m of msgs) console.error(`      ${m}`);
  }
  console.error('\nFix the manifest, or if this is legitimate pre-existing debt run:');
  console.error('  node scripts/check-manifest-schema.mjs --update');
  process.exit(1);
}

console.log(`✓ manifest-schema clean — ${files.length} manifests checked, ${shielded} pre-existing violation(s) shielded by baseline, 0 new.`);
