// check-manifest-schema.mjs — full-shape JSON Schema validation for every
// manifests/*.manifest.json file against chaingraph/schemas/manifest.schema.json.
// check-manifest-parity.mjs only diffs one field pair (mcp_tool_definition.name
// vs chaingraph.json mcp_name); this checks the entire manifest shape — required
// fields, types, no stray/typo'd keys — which nothing checked before (SSOT
// survey 2026-07-14). Baseline-shielded: pre-existing violations are grandfathered
// in scripts/manifest-schema-baseline.json, new violations fail immediately.
//
// MCP-SCHEMA-CONFORMANCE-1 (RULINGS 2026-09-10T20:30:44Z): also enforces the
// seven legal JSON Schema type names inside every input_schema /
// mcp_tool_definition.inputSchema (recursively into `items` and nested
// `properties`): a `type` keyword, when present, must be one of
// string number integer boolean array object null (a string or an array of
// those strings). Any other value = violation `illegal-type-name <path>=<value>`.
// The rule lives here, not in manifest.schema.json, because the zero-dependency
// validator subset has no enum-over-nested-keys reach. Baseline-shielded under
// the `illegal_type_names` key of manifest-schema-baseline.json (per-file
// occurrence counts; a file may carry at most its recorded count — the ratchet
// only goes down; the MCP-SCHEMA-CONFORMANCE-1 sweep empties it in PR-5).
//
// Zero-dependency by design (repo convention, CONTRACT.md §0): implements the
// draft-2020-12 SUBSET manifest.schema.json actually uses (type incl. union
// types, required, properties, additionalProperties, items, minLength, $ref,
// oneOf) — same pattern as chaingraph/standard/schema-validate.mjs.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// ---- legal JSON Schema type names (RULINGS 2026-09-10T20:30:44Z) ----
export const LEGAL_TYPE_NAMES = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
const LEGAL_TYPE_SET = new Set(LEGAL_TYPE_NAMES);

const renderTypeValue = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

function walkInputSchemaTypes(node, p, out) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  if ('type' in node) {
    const names = Array.isArray(node.type) ? node.type : [node.type];
    for (const n of names) {
      if (!LEGAL_TYPE_SET.has(n)) out.push(`illegal-type-name ${p}=${renderTypeValue(n)}`);
    }
  }
  if (node.items) walkInputSchemaTypes(node.items, `${p}.items`, out);
  if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) {
    for (const [k, sub] of Object.entries(node.properties)) walkInputSchemaTypes(sub, `${p}.properties.${k}`, out);
  }
}

/**
 * MCP-SCHEMA-CONFORMANCE-1: walk a declared input schema (input_schema or
 * mcp_tool_definition.inputSchema) and return one `illegal-type-name <path>=<value>`
 * message per `type` keyword that is not one of the seven legal JSON Schema type
 * names. Recurses into `items` and nested `properties`. Pure — the
 * gen-input-schemas selftest imports this for its RED control.
 */
export function illegalTypeViolations(schemaNode, rootPath, out = []) {
  walkInputSchemaTypes(schemaNode, rootPath, out);
  return out;
}

// ---- run ----
async function main() {
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const update = process.argv.includes('--update');
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { files: {} };
const illegalBaseline = baseline.illegal_type_names || {};

const files = readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.manifest.json'));
const violations = {}; // file -> [messages]  (schema-shape, exact-match shield)
const illegal = {};    // file -> [messages]  (illegal-type-name, count ratchet)

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
  const typeErrs = [];
  if (doc.input_schema) illegalTypeViolations(doc.input_schema, 'input_schema', typeErrs);
  if (doc.mcp_tool_definition && doc.mcp_tool_definition.inputSchema) {
    illegalTypeViolations(doc.mcp_tool_definition.inputSchema, 'mcp_tool_definition.inputSchema', typeErrs);
  }
  if (typeErrs.length) illegal[f] = typeErrs;
}

if (update) {
  const next = { files: {} };
  for (const f of Object.keys(violations).sort()) next.files[f] = violations[f];
  next.illegal_type_names = {};
  for (const f of Object.keys(illegal).sort()) next.illegal_type_names[f] = illegal[f].length;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(next, null, 2) + '\n',
    'utf8'
  );
  console.log(`✓ manifest-schema baseline updated — ${Object.keys(next.files).length} pre-existing violation(s) shielded, ${Object.keys(next.illegal_type_names).length} file(s) carry baselined illegal-type-name counts (ratchet: counts only go down).`);
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

// Illegal-type-name ratchet (MCP-SCHEMA-CONFORMANCE-1): a file may carry at most
// its recorded count; a file absent from the baseline must be clean. Counts can
// only go down — stale credit is refreshed by --update, never a failure.
const ratchetExceeded = [];
let ratchetShielded = 0;
for (const [f, msgs] of Object.entries(illegal)) {
  const known = illegalBaseline[f] ?? 0;
  if (msgs.length <= known) {
    if (known > 0) ratchetShielded++;
    continue;
  }
  ratchetExceeded.push([f, msgs, known]);
}

// Baseline entries for files that now pass are stale credit, not a failure —
// they just mean the debt burned down; --update refreshes the file to reflect that.

if (newViolations.length || ratchetExceeded.length) {
  console.error(`✗ manifest-schema FAILED — ${newViolations.length} new shape violation(s) (${shielded} pre-existing shielded by baseline), ${ratchetExceeded.length} file(s) exceeding the illegal-type-name baseline ratchet (${ratchetShielded} file(s) within it):`);
  for (const [f, msgs] of newViolations) {
    console.error(`  • ${f}`);
    for (const m of msgs) console.error(`      ${m}`);
  }
  for (const [f, msgs, known] of ratchetExceeded) {
    console.error(`  • ${f}: ${msgs.length} illegal type name(s) exceed baseline ${known} (ratchet)`);
    for (const m of msgs) console.error(`      ${m}`);
  }
  console.error('\nFix the manifest, or if this is legitimate pre-existing debt run:');
  console.error('  node scripts/check-manifest-schema.mjs --update');
  process.exit(1);
}

console.log(`✓ manifest-schema clean — ${files.length} manifests checked, ${shielded} pre-existing shape violation(s) shielded by baseline, ${ratchetShielded} file(s) within the illegal-type-name baseline ratchet, 0 new.`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-manifest-schema.mjs')) {
  main().catch((e) => { console.error('✗ check-manifest-schema exception:', e); process.exit(1); });
}
