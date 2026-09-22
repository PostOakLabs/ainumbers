#!/usr/bin/env node
/**
 * check-conformance-vectors.test.mjs — paired self-test for
 * scripts/check-conformance-vectors.mjs (CONFCORPUS-GATE-1, GATE-SELFTEST-META-1).
 *
 * Proves the corpus gate CAN go red, not just that it currently reads green:
 * builds a one-vector corpus in a temp directory with hashes computed by the
 * same canonicalizer the gate uses, asserts GREEN (exit 0), then applies three
 * mutations and asserts RED (exit 1) with the failing vector named each time:
 *   M1 — flip a byte in the input file            (byte + canonical + exec drift)
 *   M2 — corrupt expected_execution_hash only      (exec drift, bytes untouched)
 *   M3 — delete the expected-output file           (unreadable-corpus path)
 * Never touches the real ocg-conformance/ corpus.
 *
 * Exit 0 = all controls behaved (green green, every mutation red). Exit 1 = any
 * control failed, which means the GATE is broken, which is exactly what a
 * self-test is for.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dir, '..');
const GATE = resolve(__dir, 'check-conformance-vectors.mjs');

const { cgCanon, executionHash } = await import(
  pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_hash.mjs')).href
);
const { createHash } = await import('node:crypto');
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonSha = (obj) => sha256Hex(new TextEncoder().encode(JSON.stringify(cgCanon(obj))));

const failures = [];
const assert = (cond, label) => {
  if (cond) console.log(`  [ok] ${label}`);
  else { failures.push(label); console.error(`  [FAIL] ${label}`); }
};

function runGate(dir, extra = []) {
  try {
    const out = execFileSync(process.execPath, [GATE, '--vectors-dir', dir, ...extra], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: (err.stdout || '') + (err.stderr || '') };
  }
}

function writeCorpus(dir, inputValue, outputValue, patch) {
  const vecDir = resolve(dir, 'vectors');
  mkdirSync(resolve(vecDir, 'inputs'), { recursive: true });
  mkdirSync(resolve(vecDir, 'outputs'), { recursive: true });
  const inputRaw = JSON.stringify(inputValue, null, 2) + '\n';
  const outputRaw = JSON.stringify(outputValue, null, 2) + '\n';
  writeFileSync(resolve(vecDir, 'inputs', 'v1.input.json'), inputRaw);
  writeFileSync(resolve(vecDir, 'outputs', 'v1.output.json'), outputRaw);
  const input = JSON.parse(inputRaw);
  const manifest = {
    corpus: 'selftest',
    version: '0.0.1',
    vectors: [{
      id: 'selftest-v1',
      input_file: 'vectors/inputs/v1.input.json',
      input_file_sha256: sha256Hex(new TextEncoder().encode(inputRaw)),
      input_canonical_sha256: canonSha(input),
      expected_output_file: 'vectors/outputs/v1.output.json',
      expected_output_file_sha256: sha256Hex(new TextEncoder().encode(outputRaw)),
      expected_output_canonical_sha256: canonSha(outputValue),
      expected_execution_hash: 'sha256:' + '0'.repeat(64),
      source: 'self-test vector',
    }],
  };
  Object.assign(manifest.vectors[0], patch || {});
  writeFileSync(resolve(vecDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

const tmp = mkdtempSync(resolve(tmpdir(), 'confcorpus-selftest-'));
try {
  const input = { amount: 100, currency: 'eur' };
  const output = { verdict: 'PASS', fee_eur: 1.5 };
  const exec = 'sha256:' + (await executionHash(input, output));

  writeCorpus(tmp, input, output, { expected_execution_hash: exec });
  const green = runGate(tmp, ['--quiet']);
  assert(green.code === 0, 'GREEN: intact corpus exits 0');

  writeCorpus(tmp, input, output, { expected_execution_hash: exec });
  const greenLoud = runGate(tmp, []);
  assert(greenLoud.code === 0 && greenLoud.out.includes('PASS  selftest-v1'), 'GREEN: loud run names the vector');

  // M1 — flip an input byte: byte, canonical, and exec checks all drift.
  writeCorpus(tmp, { amount: 101, currency: 'eur' }, output, { expected_execution_hash: exec });
  const m1 = runGate(tmp, ['--quiet']);
  assert(m1.code === 1 && m1.out.includes('selftest-v1'), 'RED M1: flipped input byte exits 1 and names the vector');

  // M2 — corrupt only the declared execution hash; bytes stay untouched.
  writeCorpus(tmp, input, output, { expected_execution_hash: 'sha256:' + '0'.repeat(64) });
  const m2 = runGate(tmp, ['--quiet']);
  assert(m2.code === 1, 'RED M2: corrupted declared execution_hash exits 1');

  // M3 — delete the expected-output file: the unreadable-corpus path.
  writeCorpus(tmp, input, output, { expected_execution_hash: exec });
  rmSync(resolve(tmp, 'vectors', 'outputs', 'v1.output.json'));
  const m3 = runGate(tmp, ['--quiet']);
  assert(m3.code === 1 && m3.out.includes('unreadable'), 'RED M3: missing output file exits 1 via the unreadable path');

  console.log(failures.length
    ? `check-conformance-vectors self-test: ${failures.length} control(s) FAILED`
    : 'check-conformance-vectors self-test: all controls behaved (green green, mutations red)');
  process.exit(failures.length ? 1 : 0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
