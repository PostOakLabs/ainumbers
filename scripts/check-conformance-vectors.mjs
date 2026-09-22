#!/usr/bin/env node
/**
 * check-conformance-vectors.mjs — house corpus hash gate (CONFCORPUS-GATE-1, 2026-09-21).
 *
 * Enforces the public OCG receipt-conformance corpus (ocg-conformance/vectors/manifest.json)
 * against its own claims, using the ONE canonicalizer (chaingraph/kernels/_hash.mjs):
 *
 *   execution_hash = SHA-256( JCS-canonicalize( { policy_parameters, output_payload } ) )
 *
 * Four checks per vector, the same four verify.py (pure-Python, language-agnostic witness)
 * runs on the same corpus:
 *   1. input bytes match input_file_sha256                (fetch integrity)
 *   2. expected output bytes match expected_output_file_sha256
 *   3. canonicalized JSON matches *_canonical_sha256      (isolates canonicalizer bugs
 *      from hashing bugs)
 *   4. executionHash(preimage) equals expected_execution_hash
 *
 * Why this gate exists: the corpus went red on main between 2026-09-01 and 2026-09-21 —
 * ART09-DORA-FIELDNAME-MISMATCH-1 (#1598) updated the art-09 vector input without
 * regenerating the manifest, and nothing covered vectors/manifest.json, so
 * `python ocg-conformance/verify.py` exited 1 for three weeks unnoticed. This gate makes
 * that state unshippable. Provenance (does the kernel still produce the committed output?)
 * is a separate, complementary check: `node ocg-conformance/derive-vector.mjs <id> --check`.
 *
 * Usage:
 *   node scripts/check-conformance-vectors.mjs                # gate (preflight + CI)
 *   node scripts/check-conformance-vectors.mjs --vectors-dir X  # check a corpus copy
 *   node scripts/check-conformance-vectors.mjs --quiet        # summary line only
 *
 * Exit 0 = every vector passed all four checks. Exit 1 = any check failed, or the
 * manifest/corpus could not be read. Zero dependencies beyond the repo (Node 18+).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dir, '..');

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');
const vectorsDirIdx = args.indexOf('--vectors-dir');
const vectorsDir = vectorsDirIdx !== -1
  ? resolve(process.cwd(), args[vectorsDirIdx + 1])
  : resolve(REPO, 'ocg-conformance');

const manifestPath = resolve(vectorsDir, 'vectors', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`check-conformance-vectors: manifest not found at ${manifestPath}`);
  process.exit(1);
}

const { cgCanon, executionHash } = await import(
  pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_hash.mjs')).href
);
const { createHash } = await import('node:crypto');
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonSha = (obj) => sha256Hex(new TextEncoder().encode(JSON.stringify(cgCanon(obj))));

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let pass = 0;
let fail = 0;

for (const v of manifest.vectors) {
  const problems = [];
  try {
    const inputRaw = readFileSync(resolve(vectorsDir, v.input_file), 'utf8');
    const outputRaw = readFileSync(resolve(vectorsDir, v.expected_output_file), 'utf8');
    const inputParsed = JSON.parse(inputRaw);
    const outputParsed = JSON.parse(outputRaw);

    if (sha256Hex(new TextEncoder().encode(inputRaw)) !== v.input_file_sha256) {
      problems.push('input_file_sha256');
    }
    if (sha256Hex(new TextEncoder().encode(outputRaw)) !== v.expected_output_file_sha256) {
      problems.push('expected_output_file_sha256');
    }
    if (canonSha(inputParsed) !== v.input_canonical_sha256) {
      problems.push('input_canonical_sha256');
    }
    if (canonSha(outputParsed) !== v.expected_output_canonical_sha256) {
      problems.push('expected_output_canonical_sha256');
    }
    const exec = 'sha256:' + (await executionHash(inputParsed, outputParsed));
    if (exec !== v.expected_execution_hash) {
      problems.push(`expected_execution_hash (got ${exec})`);
    }
  } catch (err) {
    problems.push(`unreadable: ${err.message.slice(0, 120)}`);
  }

  if (problems.length) {
    fail += 1;
    // FAIL lines print even under --quiet: a red gate must name the vector and
    // the check that failed, or the summary line is all CI ever shows.
    console.log(`FAIL  ${v.id}\n      [MISMATCH] ${problems.join('; ')}`);
  } else {
    pass += 1;
    if (!QUIET) console.log(`PASS  ${v.id}`);
  }
}

console.log(`${pass}/${manifest.vectors.length} vectors passed all checks.`);
console.log(fail === 0
  ? 'Conforms to the OpenChainGraph execution_hash format.'
  : 'Does NOT conform — see MISMATCH lines above.');
process.exit(fail === 0 ? 0 : 1);
