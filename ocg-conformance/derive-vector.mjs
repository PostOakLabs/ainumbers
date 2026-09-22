#!/usr/bin/env node
/**
 * derive-vector.mjs — re-derive a house corpus vector from its shipped kernel.
 *
 * The house corpus (vectors/manifest.json) claims every vector is real shipped-kernel
 * output. That claim is only as good as the ability to re-derive it: this script runs
 * the CURRENT kernel's compute() on the vector's recorded input, and either checks the
 * committed pair against the result (--check, the provenance proof) or rewrites the
 * vector's output file and manifest hash fields from the run (the repair path, used
 * 2026-09-21 after ART09-DORA-FIELDNAME-MISMATCH-1 / #1598 changed the art-09 kernel's
 * input binding without regenerating the corpus).
 *
 * Hash semantics mirror third-party/validate-submission.mjs and the execution_hash
 * definition in README.md, via the one canonicalizer (chaingraph/kernels/_hash.mjs):
 *
 *   execution_hash = SHA-256( JCS-canonicalize( { policy_parameters, output_payload } ) )
 *
 * Usage:
 *   node ocg-conformance/derive-vector.mjs <id> --check   # provenance proof, writes nothing
 *   node ocg-conformance/derive-vector.mjs <id>           # re-derive: rewrite output + manifest hashes
 *
 * Exit 0 = check passed (or derivation written). Exit 1 = drift in --check mode, or
 * unknown id / kernel error. NEVER imports third-party submissions; house corpus only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dir, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const id = args.find((a) => !a.startsWith('--'));

if (!id) {
  console.error('usage: node ocg-conformance/derive-vector.mjs <vector-id> [--check]');
  process.exit(1);
}

const { cgCanon, executionHash } = await import(
  pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_hash.mjs')).href
);
const { createHash } = await import('node:crypto');
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonSha = (obj) => sha256Hex(new TextEncoder().encode(JSON.stringify(cgCanon(obj))));

const manifestPath = resolve(__dir, 'vectors', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entry = manifest.vectors.find((v) => v.id === id);
if (!entry) {
  console.error(`derive-vector: no vector "${id}" in vectors/manifest.json`);
  process.exit(1);
}

const inputPath = resolve(__dir, entry.input_file);
const outputPath = resolve(__dir, entry.expected_output_file);
const inputRaw = readFileSync(inputPath, 'utf8');
const outputRaw = readFileSync(outputPath, 'utf8');
const input = JSON.parse(inputRaw);

const kernel = await import(pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', `${id}.kernel.mjs`)).href);
if (typeof kernel.compute !== 'function') {
  console.error(`derive-vector: ${id}.kernel.mjs does not export compute()`);
  process.exit(1);
}
const result = await kernel.compute(input);
const fresh = result && result.output_payload !== undefined ? result.output_payload : result;

const freshBytes = JSON.stringify(fresh, null, 2) + '\n';
const freshCanonicalSha = canonSha(fresh);
const freshFileSha = sha256Hex(new TextEncoder().encode(freshBytes));
const freshExec = 'sha256:' + (await executionHash(input, fresh));

const inputCanonSha = canonSha(input);
const inputFileSha = sha256Hex(new TextEncoder().encode(inputRaw));

if (CHECK) {
  let ok = true;
  const committed = JSON.parse(outputRaw);
  const outputMatches = canonSha(committed) === freshCanonicalSha;
  console.log(`${id}: kernel re-derivation ${outputMatches ? 'MATCHES' : 'DIFFERS from'} the committed output file`);
  if (!outputMatches) ok = false;
  const expect = (label, declared, actual) => {
    const good = declared === actual;
    if (!good) ok = false;
    console.log(`  ${good ? '[ok]' : '[MISMATCH]'} ${label}${good ? '' : ` (declared ${declared}, actual ${actual})`}`);
  };
  expect('input_file_sha256', entry.input_file_sha256, inputFileSha);
  expect('input_canonical_sha256', entry.input_canonical_sha256, inputCanonSha);
  expect('expected_output_file_sha256', entry.expected_output_file_sha256, sha256Hex(new TextEncoder().encode(outputRaw)));
  expect('expected_output_canonical_sha256', entry.expected_output_canonical_sha256, canonSha(JSON.parse(outputRaw)));
  expect('expected_execution_hash', entry.expected_execution_hash, freshExec);
  console.log(ok ? `derive-vector: ${id} provenance PROVEN` : `derive-vector: ${id} provenance DRIFT`);
  process.exit(ok ? 0 : 1);
}

// Repair path: rewrite the output file from the kernel run, then regenerate every hash
// field of the manifest entry from the bytes actually on disk (never the reverse).
writeFileSync(outputPath, freshBytes);
entry.input_file_sha256 = inputFileSha;
entry.input_canonical_sha256 = inputCanonSha;
entry.expected_output_file_sha256 = freshFileSha;
entry.expected_output_canonical_sha256 = freshCanonicalSha;
entry.expected_execution_hash = freshExec;
manifest.generated_at = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`derive-vector: ${id} output rewritten from the current kernel; manifest hash fields regenerated (generated_at ${manifest.generated_at})`);
console.log(`derive-vector: now run: python ocg-conformance/verify.py   # expect 9/9, exit 0`);
