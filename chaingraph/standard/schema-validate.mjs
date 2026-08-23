#!/usr/bin/env node
// schema-validate.mjs — GATE (NEW, conformance-by-construction §4)
// Validates chaingraph.json (catalog: nodes[]/chains[]) and any v0.4 artifact fixtures
// against standard/openchain-graph-v0.4.schema.json. Zero-dependency: implements the
// draft-2020-12 SUBSET our schema uses (type, required, properties, additionalProperties,
// enum, const, pattern, items, minItems, minLength, minimum, oneOf, $ref to local $defs).
// Non-zero exit blocks CI. Makes "strict v0.4" mean "validates against the published schema."
//
// Usage (paths default to the sibling repo layout; override with env):
//   node schema-validate.mjs
//   SCHEMA=… CHAINGRAPH=… FIXTURES_DIR=… node schema-validate.mjs
//
// Placement: run in BOTH repos — site (repo/) validates chaingraph.json; worker
// (mcp-apps-poc/) validates the vendored data/chaingraph/chaingraph.json + kernel fixtures.
// ⚠ One sibling-file dependency since DENOMINATOR-SENTINEL-1: ../../scripts/denominator-sentinel.mjs
// (zero-dep, node: builtins only). It is NOT vendored into mcp-apps-poc today — verified by
// `git ls-files` there, which carries no copy of this gate either — so nothing is broken by it; but a
// future vendor of this file must take that one module with it.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSsotPresentOrExit } from '../../scripts/denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = process.env.SCHEMA || firstExisting([
  join(HERE, '..', 'repo', 'chaingraph', 'standard', 'openchain-graph-v0.4.schema.json'),
  join(HERE, 'openchain-graph-v0.4.schema.json'),
  join(HERE, '..', 'standard', 'openchain-graph-v0.4.schema.json'),
]);
const CHAINGRAPH = process.env.CHAINGRAPH || firstExisting([
  join(HERE, '..', 'chaingraph.json'),                       // landed: standard/ → chaingraph/chaingraph.json
  join(HERE, '..', 'repo', 'chaingraph', 'chaingraph.json'), // staging: ssot-rollout/
  join(HERE, '..', 'data', 'chaingraph', 'chaingraph.json'), // worker: vendored
  join(HERE, 'chaingraph.json'),
]);
const FIXTURES_DIR = process.env.FIXTURES_DIR || firstExistingDir([
  join(HERE, '..', 'repo', 'chaingraph', 'kernels', 'fixtures'),
  join(HERE, '..', 'kernels', 'fixtures'),
]);

function firstExisting(paths) { return paths.find((p) => existsSync(p)) || paths[0]; }
function firstExistingDir(paths) { return paths.find((p) => existsSync(p) && statSync(p).isDirectory()) || null; }

// ---- minimal JSON Schema (draft 2020-12 subset) validator ----
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
      // surface the closest branch's errors to aid debugging
      const closest = branchErrs.reduce((a, b) => (b.length < a.length ? b : a));
      closest.slice(0, 4).forEach((e) => errs.push(`  ↳ ${e}`));
    }
    return;
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
  if (typeof data === 'number' && schema.minimum != null && data < schema.minimum)
    errs.push(`${path}: ${data} < minimum ${schema.minimum}`);
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
  if (Array.isArray(t)) return t.some((x) => typeOk(x, d)); // union type, e.g. ["string","null"]
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

// ---- run ----
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));
let failed = 0, checked = 0;

function check(label, data, subOverride) {
  checked++;
  const errs = [];
  // pick the right sub-schema by document shape for clear errors (top-level oneOf hides which branch failed)
  // subOverride lets a caller name the exact $defs fragment directly (see --shard mode below)
  // instead of relying on shape-sniffing, without changing this heuristic for anyone who doesn't pass one.
  const sub = subOverride || (data && data.execution_hash ? schema.$defs.artifact
    : data && Array.isArray(data.nodes) ? schema.oneOf[1]
    : schema);
  validate(sub, data, schema, label, errs);
  if (errs.length) { failed++; console.error(`✗ ${label}`); errs.slice(0, 40).forEach((e) => console.error(`    ${e}`)); if (errs.length > 40) console.error(`    … +${errs.length - 40} more`); }
  else console.log(`✓ ${label}`);
}

function rel(p) { return p ? p.replace(resolve(HERE, '..'), '.') : p; }

// ---- single-shard mode (SHARD-SCHEMA-PARITY-1) ----
// `--shard <path>` validates ONE on-disk file directly against $defs.node — the
// exact fragment chaingraph.json's assembled nodes[] validate against via $ref
// two lines above in the schema (oneOf[1].properties.nodes.items), loaded fresh
// from THIS schema file on every run. No second declaration of the fragment
// exists anywhere (STANDING-ORDERS #34: a gate may not read its expectation
// from a copy — recompute it from the primary source). scripts/check-shard-
// assembly.mjs shells out to this mode for every node shard on disk, so a shard
// that fails here can no longer pass the producer (shard-level) gate while
// still failing the consumer (assembly) gate — the art-662/`pageless` defect
// class (SHARD-SCHEMA-PARITY-1) this closes.
const shardFlagIdx = process.argv.indexOf('--shard');
if (shardFlagIdx !== -1) {
  const shardPath = process.argv[shardFlagIdx + 1];
  if (!shardPath) { console.error('--shard requires a file path argument'); process.exit(2); }
  if (!existsSync(shardPath)) { console.error(`--shard: file not found: ${shardPath}`); process.exit(2); }
  let data;
  try { data = JSON.parse(readFileSync(shardPath, 'utf8')); }
  catch (e) { console.error(`--shard: ${shardPath} is not valid JSON: ${e.message}`); process.exit(1); }
  check(`shard ${rel(shardPath)} vs $defs.node (${rel(SCHEMA)})`, data, schema.$defs.node);
  console.log(`\n${checked} checked, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
}

// ---- default mode: whole chaingraph.json + fixtures (unchanged) ----
console.log(`schema-validate · schema=${rel(SCHEMA)}\n`);

// ── DENOMINATOR SENTINEL (DENOMINATOR-SENTINEL-1 / F-01) ─────────────────────────────────────────
// This branch used to be `if (existsSync(CHAINGRAPH)) check(…) else console.error('! not found')`, and
// the missing-file arm left `failed === 0`, so the run closed "N checked, 0 failed." and exited 0. The
// SSOT schema gate validating nothing, green, because the SSOT itself had moved — and note firstExisting()
// deliberately falls back to paths[0] when nothing exists, so CHAINGRAPH is always a plausible-looking
// path even when no file is behind it. Absence of the subject is a distinct state, never a pass (SO #34c).
//
// The SCHEMA path above is not asserted here: readFileSync(SCHEMA) on line ~112 already throws for a
// missing schema, which fails closed. Only the silently-tolerated arm needed closing.
assertSsotPresentOrExit(CHAINGRAPH, {
  label: 'schema-validate',
  what: 'chaingraph.json (the OpenChainGraph SSOT catalog this gate exists to validate)',
  remedy: 'the SSOT moved or was not assembled — restore it: git checkout origin/main -- chaingraph/chaingraph.json, or point this run at it with CHAINGRAPH=<path>',
});
check(`chaingraph.json (${rel(CHAINGRAPH)})`, JSON.parse(readFileSync(CHAINGRAPH, 'utf8')));

if (FIXTURES_DIR && existsSync(FIXTURES_DIR)) {
  for (const f of readdirSync(FIXTURES_DIR).filter((n) => n.endsWith('.json'))) {
    let doc; try { doc = JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8')); } catch { continue; }
    // fixtures may hold {artifact} or an array of expected artifacts; validate any object with execution_hash
    const candidates = doc.artifact ? [doc.artifact] : Array.isArray(doc) ? doc : doc.execution_hash ? [doc] : [];
    candidates.forEach((a, i) => check(`fixture ${f}#${i}`, a));
  }
}

console.log(`\n${checked} checked, ${failed} failed.`);
process.exit(failed ? 1 : 0);
