#!/usr/bin/env node
/**
 * Validates one ocg-conformance/third-party/<submitter-slug>/ submission
 * directory against submitter.schema.json + submission-manifest.schema.json,
 * plus the cross-file / cross-hash checks a JSON Schema file cannot express
 * on its own:
 *
 *   1. submitter.json validates against schemas/submitter.schema.json
 *   2. manifest.json validates against schemas/submission-manifest.schema.json
 *   3. manifest.json's submitter_namespace === submitter.json's namespace
 *   4. every vector id starts with "<submitter_namespace>."
 *   5. for every vector: input/output file bytes match *_file_sha256,
 *      canonicalized JSON matches *_canonical_sha256, and
 *      SHA-256(JCS({policy_parameters, output_payload})) matches
 *      expected_execution_hash -- reusing the SAME canonicalizer
 *      (../../chaingraph/kernels/_hash.mjs) every house kernel uses, per
 *      CONTRACT.md's "one canonicalizer, one shape" rule. This script never
 *      hand-builds or re-implements the preimage.
 *
 * Pure Node stdlib (fs, crypto via globalThis.crypto, url) -- no npm
 * dependency, no network call, matching this repo's zero-dep convention.
 * The JSON Schema support here is a minimal interpreter covering only the
 * keywords the two schemas in schemas/ actually use (type, const, enum,
 * pattern, format:uri|date-time, required, properties,
 * additionalProperties:false, items, minItems, minLength, $ref, oneOf,
 * allOf, if/then) -- it is not a general-purpose validator, and is not
 * meant to become one.
 *
 * Usage:
 *   node validate-submission.mjs <submitter-dir>
 *   node validate-submission.mjs example-submitter
 *
 * Exit 0 = every check passed. Exit 1 = at least one failed (each printed).
 */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node validate-submission.mjs <submitter-dir-name-or-path>');
  process.exit(1);
}

const submitterDir = path.isAbsolute(args[0]) ? args[0] : path.join(__dirname, args[0]);
const errors = [];
const note = (msg) => console.log('  ' + msg);
const fail = (msg) => errors.push(msg);

// ---------------------------------------------------------------------------
// Minimal JSON Schema interpreter -- only the keywords used by schemas/*.json
// ---------------------------------------------------------------------------

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref shape: ${ref}`);
  const parts = ref.slice(2).split('/');
  let node = root;
  for (const p of parts) node = node[p];
  if (!node) throw new Error(`$ref not found: ${ref}`);
  return node;
}

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function checkFormat(fmt, value, at, out) {
  if (fmt === 'date-time') {
    if (!DATE_TIME_RE.test(value)) out.push(`${at}: "${value}" does not match ISO 8601 date-time`);
  } else if (fmt === 'uri') {
    if (!/^[a-z][a-z0-9+.-]*:\/\/\S+/i.test(value) && !/^mailto:\S+/i.test(value)) {
      out.push(`${at}: "${value}" does not look like a URI`);
    }
  }
}

function validate(instance, schema, root, at, out) {
  if (schema.$ref) {
    validate(instance, resolveRef(schema.$ref, root), root, at, out);
    return;
  }
  if (schema.const !== undefined) {
    if (instance !== schema.const) out.push(`${at}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(instance)}`);
  }
  if (schema.enum) {
    if (!schema.enum.includes(instance)) out.push(`${at}: ${JSON.stringify(instance)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = instance === null ? 'null' : Array.isArray(instance) ? 'array' : typeof instance;
    if (!types.includes(actual)) out.push(`${at}: expected type ${types.join('|')}, got ${actual}`);
  }
  if (typeof instance === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(instance)) {
      out.push(`${at}: "${instance}" does not match pattern ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && instance.length < schema.minLength) {
      out.push(`${at}: length ${instance.length} < minLength ${schema.minLength}`);
    }
    if (schema.format) checkFormat(schema.format, instance, at, out);
  }
  if (instance && typeof instance === 'object' && !Array.isArray(instance)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in instance)) out.push(`${at}: missing required property "${key}"`);
      }
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in instance) validate(instance[key], sub, root, `${at}.${key}`, out);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(instance)) {
        if (!allowed.has(key)) out.push(`${at}: unexpected property "${key}" (additionalProperties: false)`);
      }
    }
  }
  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined && instance.length < schema.minItems) {
      out.push(`${at}: ${instance.length} items < minItems ${schema.minItems}`);
    }
    if (schema.items) {
      instance.forEach((item, i) => validate(item, schema.items, root, `${at}[${i}]`, out));
    }
  }
  if (schema.oneOf) {
    const results = schema.oneOf.map((s) => {
      const sub = [];
      validate(instance, s, root, at, sub);
      return sub;
    });
    const passing = results.filter((r) => r.length === 0);
    if (passing.length !== 1) {
      out.push(`${at}: expected exactly 1 of ${schema.oneOf.length} oneOf branches to pass, got ${passing.length}`);
    }
  }
  if (schema.allOf) {
    for (const sub of schema.allOf) {
      if (sub.if) {
        const ifErrors = [];
        validate(instance, sub.if, root, at, ifErrors);
        if (ifErrors.length === 0 && sub.then) validate(instance, sub.then, root, at, out);
      } else {
        validate(instance, sub, root, at, out);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Load schemas + instances
// ---------------------------------------------------------------------------

const submitterSchema = JSON.parse(readFileSync(path.join(__dirname, 'schemas', 'submitter.schema.json'), 'utf8'));
const manifestSchema = JSON.parse(readFileSync(path.join(__dirname, 'schemas', 'submission-manifest.schema.json'), 'utf8'));

const submitterPath = path.join(submitterDir, 'submitter.json');
const manifestPath = path.join(submitterDir, 'manifest.json');

if (!existsSync(submitterPath)) fail(`missing ${submitterPath}`);
if (!existsSync(manifestPath)) fail(`missing ${manifestPath}`);
if (errors.length) {
  console.log('FAIL');
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(1);
}

const submitter = JSON.parse(readFileSync(submitterPath, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

console.log(`Validating ${submitterDir}`);

// 1 + 2: schema validation
const submitterErrors = [];
validate(submitter, submitterSchema, submitterSchema, 'submitter.json', submitterErrors);
submitterErrors.forEach(fail);
note(`submitter.json schema check: ${submitterErrors.length === 0 ? 'PASS' : 'FAIL'}`);

const manifestErrors = [];
validate(manifest, manifestSchema, manifestSchema, 'manifest.json', manifestErrors);
manifestErrors.forEach(fail);
note(`manifest.json schema check: ${manifestErrors.length === 0 ? 'PASS' : 'FAIL'}`);

// 3: namespace agreement
if (manifest.submitter_namespace !== submitter.namespace) {
  fail(`manifest.submitter_namespace ("${manifest.submitter_namespace}") !== submitter.namespace ("${submitter.namespace}")`);
} else {
  note('namespace agreement (manifest <-> submitter): PASS');
}

// 4: every vector id is namespaced under submitter_namespace
const nsPrefix = manifest.submitter_namespace + '.';
for (const v of manifest.vectors || []) {
  if (!v.id || !v.id.startsWith(nsPrefix)) {
    fail(`vector id "${v.id}" does not start with submitter namespace "${nsPrefix}"`);
  }
}
note('vector id namespace-prefix check: ' + (errors.some((e) => e.includes('does not start with submitter namespace')) ? 'FAIL' : 'PASS'));

// 5: recompute file/canonical/execution hashes via the ONE canonicalizer
const hashMjsUrl = pathToFileURL(path.join(__dirname, '..', '..', 'chaingraph', 'kernels', '_hash.mjs')).href;
const { cgCanon, executionHash } = await import(hashMjsUrl);

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

for (const v of manifest.vectors || []) {
  const inputFile = path.join(submitterDir, v.input_file);
  const outputFile = path.join(submitterDir, v.expected_output_file);
  if (!existsSync(inputFile)) { fail(`${v.id}: input_file not found at ${inputFile}`); continue; }
  if (!existsSync(outputFile)) { fail(`${v.id}: expected_output_file not found at ${outputFile}`); continue; }

  const inputRaw = readFileSync(inputFile);
  const outputRaw = readFileSync(outputFile);

  const inputFileSha256 = await sha256Hex(inputRaw);
  const outputFileSha256 = await sha256Hex(outputRaw);
  if (inputFileSha256 !== v.input_file_sha256) fail(`${v.id}: input_file_sha256 mismatch (declared ${v.input_file_sha256}, actual ${inputFileSha256})`);
  if (outputFileSha256 !== v.expected_output_file_sha256) fail(`${v.id}: expected_output_file_sha256 mismatch (declared ${v.expected_output_file_sha256}, actual ${outputFileSha256})`);

  const inputParsed = JSON.parse(inputRaw.toString('utf8'));
  const outputParsed = JSON.parse(outputRaw.toString('utf8'));

  const inputCanonicalSha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(cgCanon(inputParsed))));
  const outputCanonicalSha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(cgCanon(outputParsed))));
  if (inputCanonicalSha256 !== v.input_canonical_sha256) fail(`${v.id}: input_canonical_sha256 mismatch (declared ${v.input_canonical_sha256}, actual ${inputCanonicalSha256})`);
  if (outputCanonicalSha256 !== v.expected_output_canonical_sha256) fail(`${v.id}: expected_output_canonical_sha256 mismatch (declared ${v.expected_output_canonical_sha256}, actual ${outputCanonicalSha256})`);

  const execHash = 'sha256:' + (await executionHash(inputParsed, outputParsed));
  if (execHash !== v.expected_execution_hash) fail(`${v.id}: expected_execution_hash mismatch (declared ${v.expected_execution_hash}, actual ${execHash})`);

  note(`${v.id}: file/canonical/execution_hash recompute: ${errors.some((e) => e.startsWith(v.id)) ? 'FAIL' : 'PASS'}`);
}

console.log(errors.length === 0 ? 'PASS' : 'FAIL');
if (errors.length) {
  console.log('Failures:');
  errors.forEach((e) => console.log('  - ' + e));
}
process.exit(errors.length === 0 ? 0 : 1);
