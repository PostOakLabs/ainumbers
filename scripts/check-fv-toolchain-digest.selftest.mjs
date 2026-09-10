#!/usr/bin/env node
// check-fv-toolchain-digest.selftest.mjs — FVLEG-DIGEST-CONSUMER-1
//
// Pure in-memory fixtures, touches no real research/ file on disk (same shape as
// check-fv-pilot-badge.selftest.mjs). Demonstrates the RED-before-GREEN evidence SO #40b asks
// for: fixture 2 below is the SAME mutation shape research/FV-TRIPLEBIND-MUTATE-1-2026-08-11.md's
// cell 3c described as uncatchable ("any of dafny_exe_sha256 / ... / harness_digest ... byte
// flipped ... no command exists"; "N/A — no checker to run") — a one-hex-char flip on a recorded
// fv_leg sub-digest. This checker now returns MISMATCH for it.
//
// Run: node scripts/check-fv-toolchain-digest.selftest.mjs
import path from 'node:path';
import {
  sha256, MATCH, MISMATCH, NOT_EVALUABLE, NOT_EVALUABLE_PREMISE, NOT_EVALUABLE_NETWORK,
  ALL_FV_LEG_DIGEST_FIELDS, hasFvLeg, deriveFvLegSources, classifyFvLegField, checkFvLegArtifact,
} from './check-fv-toolchain-digest.mjs';

// A platform-real root (path.resolve drive-qualifies a bare "/ws" on Windows) — fixtures build
// their expectations FROM this via path.resolve too, so the assertions never hardcode a POSIX
// literal that a Windows run would fail for a reason that has nothing to do with the checker.
const WS = path.resolve('/ws');

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  OK:   ${name}`); }
  else { console.error(`  FAIL: ${name}`); failures++; }
}

// ── hasFvLeg: content-detection scopes the checker correctly ──
{
  check('class-C shape (object with fv_leg) → in scope',
    hasFvLeg({ toolchain_digest: { fv_leg: { model_digest: 'sha256:aa' } } }) === true);
  check('class-A shape (plain string) → out of scope',
    hasFvLeg({ toolchain_digest: 'node:v24.15.0' }) === false);
  check('class-B shape (object, no fv_leg) → out of scope',
    hasFvLeg({ toolchain_digest: { node_version: 'v24.15.0', harness_digest: 'sha256:bb' } }) === false);
  check('missing toolchain_digest entirely → out of scope, never throws',
    hasFvLeg({ kernel_id: 'x' }) === false);
}

// ── deriveFvLegSources: derives paths from the artifact's OWN content, never a guessed filename ──
{
  const record = {
    toolchain_digest: { fv_leg: { model_file: 'research/fv-x/Model.dfy' } },
    verification_run: { compile_command: 'dafny build -t:js --include-runtime -o Model.js Model.dfy' },
    reproduce: ['node research/FV-X.harness.mjs', 'dafny verify research/fv-x/Model.dfy'],
  };
  const sources = deriveFvLegSources(record, WS);
  check('model_digest source resolved from model_file field',
    sources.model_digest === path.resolve(WS, 'research/fv-x/Model.dfy'));
  check('compiled_js_digest source derived from compile_command -o target, next to model_file',
    sources.compiled_js_digest === path.resolve(WS, 'research/fv-x/Model.js'));
  check('harness_digest source derived from reproduce[]\'s *.harness.mjs mention',
    sources.harness_digest === path.resolve(WS, 'research/FV-X.harness.mjs'));
}
{
  const sparse = deriveFvLegSources({ toolchain_digest: { fv_leg: {} } }, WS);
  check('no model_file / compile_command / reproduce[] → no sources derived, never guessed', Object.keys(sparse).length === 0);
}

// ── classifyFvLegField: recomputable fields, injected fs (no real disk) ──
{
  const bytes = Buffer.from('export function Foo() {}\n', 'utf8');
  const digest = sha256(bytes);
  const existsFn = () => true;
  const readFileFn = () => bytes;

  const matchResult = classifyFvLegField('model_digest', `sha256:${digest}`, '/ws/research/x/Model.dfy', { existsFn, readFileFn, sha256Fn: sha256 });
  check('recorded digest matches recomputed bytes → MATCH', matchResult.verdict === MATCH);

  // THE MUTATION CASE (FV-TRIPLEBIND-MUTATE-1 cell 3c shape): one hex char flipped on the recorded value.
  const flipped = digest.slice(0, -1) + (digest.slice(-1) === '0' ? '1' : '0');
  const mismatchResult = classifyFvLegField('model_digest', `sha256:${flipped}`, '/ws/research/x/Model.dfy', { existsFn, readFileFn, sha256Fn: sha256 });
  check('RED: one-hex-char-flipped recorded digest vs real recomputed bytes → MISMATCH (was: no checker to run at all)', mismatchResult.verdict === MISMATCH);
  check('MISMATCH names both the recorded and the current digest, never just "failed"',
    mismatchResult.recorded === flipped && mismatchResult.current === digest);

  const missingSourceResult = classifyFvLegField('harness_digest', `sha256:${digest}`, '/ws/research/does-not-exist.harness.mjs', { existsFn: () => false, readFileFn, sha256Fn: sha256 });
  check('recomputable field, source file not found → NOT_EVALUABLE-PREMISE, never a silent pass',
    missingSourceResult.verdict === NOT_EVALUABLE && missingSourceResult.subcode === NOT_EVALUABLE_PREMISE);

  const undeducedResult = classifyFvLegField('compiled_js_digest', `sha256:${digest}`, null, { existsFn, readFileFn, sha256Fn: sha256 });
  check('recomputable field, no derivable source path → NOT_EVALUABLE-PREMISE',
    undeducedResult.verdict === NOT_EVALUABLE && undeducedResult.subcode === NOT_EVALUABLE_PREMISE);

  const malformedResult = classifyFvLegField('model_digest', 'not-a-hex-digest', '/ws/x', { existsFn, readFileFn, sha256Fn: sha256 });
  check('malformed recorded value (not 64 hex chars) → NOT_EVALUABLE-PREMISE, never crashes',
    malformedResult.verdict === NOT_EVALUABLE && malformedResult.subcode === NOT_EVALUABLE_PREMISE);
}

// ── classifyFvLegField: out-of-repo fields — NEVER a pass, whatever the recorded value says ──
{
  const plausibleLookingDigest = 'sha256:' + 'ab'.repeat(32);
  for (const field of ['dafny_exe_sha256', 'dafny_core_dll_sha256', 'z3_4_12_1_sha256', 'z3_4_14_1_sha256']) {
    const r = classifyFvLegField(field, plausibleLookingDigest, null, {});
    check(`${field}: out-of-repo toolchain binary → NOT_EVALUABLE-PREMISE, zero pass-count inflation`,
      r.verdict === NOT_EVALUABLE && r.subcode === NOT_EVALUABLE_PREMISE);
  }
  const zipResult = classifyFvLegField('release_zip_sha256', plausibleLookingDigest, null, {});
  check('release_zip_sha256: would require a network fetch → NOT_EVALUABLE-NETWORK, never fetched',
    zipResult.verdict === NOT_EVALUABLE && zipResult.subcode === NOT_EVALUABLE_NETWORK);
}

// ── checkFvLegArtifact: full 8-field record, end to end, zero pass-count inflation ──
{
  const modelBytes = Buffer.from('// model\n', 'utf8');
  const jsBytes = Buffer.from('// compiled\n', 'utf8');
  const harnessBytes = Buffer.from('// harness\n', 'utf8');
  const modelDigest = sha256(modelBytes);
  const jsDigest = sha256(jsBytes);
  const harnessDigest = sha256(harnessBytes);

  const record = {
    toolchain_digest: {
      fv_leg: {
        dafny_version: '4.11.0',
        dafny_exe_sha256: 'ab'.repeat(32),
        dafny_core_dll_sha256: 'cd'.repeat(32),
        z3_4_12_1_sha256: 'ef'.repeat(32),
        z3_4_14_1_sha256: '12'.repeat(32),
        release_zip_sha256: '34'.repeat(32),
        model_file: 'research/fv-x/Model.dfy',
        model_digest: `sha256:${modelDigest}`,
        compiled_js_digest: `sha256:${jsDigest}`,
        harness_digest: `sha256:${harnessDigest}`,
      },
    },
    verification_run: { compile_command: 'dafny build -t:js --include-runtime -o Model.js Model.dfy' },
    reproduce: ['node research/FV-X.harness.mjs'],
  };

  const byPath = new Map([
    [path.resolve(WS, 'research/fv-x/Model.dfy'), modelBytes],
    [path.resolve(WS, 'research/fv-x/Model.js'), jsBytes],
    [path.resolve(WS, 'research/FV-X.harness.mjs'), harnessBytes],
  ]);
  const fsFns = {
    existsFn: (p) => byPath.has(p),
    readFileFn: (p) => byPath.get(p),
    sha256Fn: sha256,
  };

  const results = checkFvLegArtifact(record, WS, fsFns);
  check('all 8 fv_leg fields produce exactly one result each (none silently dropped)', results.length === ALL_FV_LEG_DIGEST_FIELDS.length);
  const matches = results.filter((r) => r.verdict === MATCH);
  const notEvaluable = results.filter((r) => r.verdict === NOT_EVALUABLE);
  check('the 3 in-repo fields (model/compiled_js/harness) all MATCH on correct bytes', matches.length === 3);
  check('the 5 out-of-repo fields are all NOT_EVALUABLE — NEVER counted among MATCH', notEvaluable.length === 5);
  check('MATCH never includes an out-of-repo field', matches.every((r) => !['dafny_exe_sha256', 'dafny_core_dll_sha256', 'z3_4_12_1_sha256', 'z3_4_14_1_sha256', 'release_zip_sha256'].includes(r.field)));

  // Mutate ONE recorded in-repo digest (model_digest) — the exact FV-TRIPLEBIND-MUTATE-1 cell 3c
  // shape, applied through the full artifact-level orchestrator this time, not just the unit.
  const mutated = structuredClone(record);
  const d = mutated.toolchain_digest.fv_leg.model_digest;
  mutated.toolchain_digest.fv_leg.model_digest = d.slice(0, -1) + (d.slice(-1) === '0' ? '1' : '0');
  const mutatedResults = checkFvLegArtifact(mutated, WS, fsFns);
  const mutatedField = mutatedResults.find((r) => r.field === 'model_digest');
  check('RED (artifact level): mutated model_digest → MISMATCH, caught end to end', mutatedField.verdict === MISMATCH);
  const stillFine = mutatedResults.filter((r) => r.field !== 'model_digest');
  check('mutating one field does not disturb the other 7 verdicts', stillFine.every((r) => r.verdict === MATCH || r.verdict === NOT_EVALUABLE));
}

console.log(`\n${failures === 0 ? '✓' : '✗'} check-fv-toolchain-digest self-test: ${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
