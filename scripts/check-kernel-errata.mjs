#!/usr/bin/env node
/**
 * scripts/check-kernel-errata.mjs: KERNEL-ERRATA-SCHEMA-1 gates K1, K3, K5.
 *
 *   K1  witness holds. Every source record under chaingraph/errata/sources/ matches
 *       chaingraph/errata/kernel-erratum.schema.json; its predicate file matches the recorded
 *       sha256; the predicate is true on the affected vector and false on the unaffected one;
 *       the policy_parameters hashes and the four execution hashes recompute from the two
 *       kernel versions in git; the old and new kernel digests recompute from the blobs.
 *   K3  predicate purity. Every file under chaingraph/errata/predicates/ passes the lint
 *       (no import beyond the shared canonicalizer, no Date, Math.random, fetch, process,
 *       dynamic property access on caller input without Object.hasOwn).
 *   K5  append-only. An entry id is unique and equals its file name; a record or predicate that
 *       exists at the base ref is byte-identical now and not deleted (a correction is a new
 *       entry whose `corrects` names an existing id).
 *
 *   node scripts/check-kernel-errata.mjs [--root <repo>] [--base <ref>] [--require-base]
 *
 * --base defaults to origin/main. When the base ref does not resolve, K5's edit half is
 * reported SKIPPED (exit 0) unless --require-base is given. Exit 1 on any red.
 * Self-test (planted red and green for each gate): scripts/check-kernel-errata.selftest.mjs
 * Node built-ins only; no network, no clock, no randomness.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, SOURCES_DIR, PREDICATES_DIR, ID_RE, git, lintPredicate, verifyEntry } from './lib/kernel-errata.mjs';

const SCHEMA_PATH = 'chaingraph/errata/kernel-erratum.schema.json';
const lf = (s) => s.replace(/\r\n/g, '\n');

// Minimal validator for the schema subset used above: type, enum, pattern, required,
// properties, additionalProperties:false, items, minItems, minLength, maxLength, $ref to $defs.
export function validateSchema(schema, value, root = schema, path = '$') {
  const errs = [];
  if (schema.$ref) return validateSchema(root.$defs[schema.$ref.split('/').pop()], value, root, path);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (schema.type) {
    const t = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (t !== schema.type) return [...errs, `${path}: expected ${schema.type}, got ${t}`];
  }
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path}: does not match ${schema.pattern}`);
    if (schema.minLength && value.length < schema.minLength) errs.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength && value.length > schema.maxLength) errs.push(`${path}: longer than ${schema.maxLength}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((v, i) => errs.push(...validateSchema(schema.items, v, root, `${path}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    for (const k of schema.required ?? []) if (!Object.hasOwn(value, k)) errs.push(`${path}: missing ${k}`);
    for (const k of Object.keys(value)) {
      if (Object.hasOwn(schema.properties, k)) errs.push(...validateSchema(schema.properties[k], value[k], root, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}: unexpected member ${k}`);
    }
  }
  return errs;
}

// K1 over a list of { file, entry } records.
export async function checkK1(root, records, schema) {
  const errs = [];
  for (const { file, entry } of records) {
    const shape = validateSchema(schema, entry);
    if (shape.length) { errs.push(...shape.map((e) => `K1 ${file}: schema: ${e}`)); continue; }
    if (file !== `${entry.id}.json`) errs.push(`K1 ${file}: file name must be ${entry.id}.json`);
    if (entry.affected_predicate.path !== `${PREDICATES_DIR}/${entry.id}.mjs`) errs.push(`K1 ${file}: predicate path must be ${PREDICATES_DIR}/${entry.id}.mjs`);
    errs.push(...(await verifyEntry(root, entry)).map((e) => `K1 ${entry.id}: ${e}`));
  }
  return errs;
}

// K3 over a map of file name -> source text.
export function checkK3(predicates) {
  const errs = [];
  for (const [file, src] of predicates) for (const v of lintPredicate(src)) errs.push(`K3 ${file}: ${v}`);
  return errs;
}

// K5. current / base: Map of repo-relative path -> text, covering sources and predicates.
// entries: [{ file, entry }] for the current tree. base may be null (edit half skipped).
export function checkK5(current, base, entries) {
  const errs = [];
  const seen = new Map();
  for (const { file, entry } of entries) {
    if (!ID_RE.test(entry.id ?? '')) { errs.push(`K5 ${file}: bad id ${entry.id}`); continue; }
    if (seen.has(entry.id)) errs.push(`K5 ${entry.id}: id reused by ${seen.get(entry.id)} and ${file}`);
    seen.set(entry.id, file);
  }
  for (const { file, entry } of entries) {
    if (entry.corrects !== undefined && !seen.has(entry.corrects)) errs.push(`K5 ${entry.id}: corrects ${entry.corrects}, which does not exist`);
    if (entry.corrects === entry.id) errs.push(`K5 ${entry.id}: corrects itself`);
  }
  if (base) {
    for (const [p, text] of base) {
      if (!current.has(p)) errs.push(`K5 ${p}: deleted (entries are append-only)`);
      else if (lf(current.get(p)) !== lf(text)) errs.push(`K5 ${p}: edited (a correction is a new entry that names this one)`);
    }
  }
  return errs;
}

function readDir(root, rel, ext) {
  const out = new Map();
  const abs = join(root, rel);
  if (!existsSync(abs)) return out;
  for (const f of readdirSync(abs).sort()) if (f.endsWith(ext)) out.set(`${rel}/${f}`, readFileSync(join(abs, f), 'utf8'));
  return out;
}

function readBase(root, ref) {
  try { git(root, ['rev-parse', '--verify', `${ref}^{commit}`]); } catch { return null; }
  const base = new Map();
  for (const rel of [SOURCES_DIR, PREDICATES_DIR]) {
    const listing = git(root, ['ls-tree', '-r', '--name-only', ref, '--', rel]).split('\n').filter(Boolean);
    for (const p of listing) base.set(p, git(root, ['show', `${ref}:${p}`]));
  }
  return base;
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const root = resolve(opt('--root') ?? REPO_ROOT);
  const schema = JSON.parse(readFileSync(join(root, SCHEMA_PATH), 'utf8'));
  const sources = readDir(root, SOURCES_DIR, '.json');
  const predicates = readDir(root, PREDICATES_DIR, '.mjs');
  const records = [];
  const errs = [];
  for (const [p, text] of sources) {
    try { records.push({ file: p.split('/').pop(), entry: JSON.parse(text) }); } catch (e) { errs.push(`K1 ${p}: not JSON (${e.message})`); }
  }
  errs.push(...(await checkK1(root, records, schema)));
  errs.push(...checkK3(predicates));
  const ref = opt('--base') ?? 'origin/main';
  const base = readBase(root, ref);
  if (!base && argv.includes('--require-base')) errs.push(`K5: base ref ${ref} does not resolve`);
  if (!base) console.log(`K5 edit/delete check SKIPPED: base ref ${ref} does not resolve here (id uniqueness still checked)`);
  errs.push(...checkK5(new Map([...sources, ...predicates]), base, records));
  for (const e of errs) console.error(e);
  console.log(`check-kernel-errata: ${records.length} entries, ${predicates.size} predicates, ${errs.length ? `${errs.length} RED` : 'K1 K3 K5 GREEN'}`);
  process.exit(errs.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
