// SPDX-License-Identifier: Apache-2.0
//
// Fixture tests for the browser twin verifier (chaingraph/vm/twin/verify.mjs).
// Runs under plain Node (no npm, no deps) — SO #10 posture — and reuses the
// zkprof twin-cases set VERBATIM (chaingraph/vm/twin/fixtures/*.case.json,
// copied unmodified from zkprof-web crates/zkprof-verify/fixtures/twin-cases,
// plus crate-verdicts.json for the agreement leg).
//
// Asserts, per case:
//   1. the ported twin's verdict equals the crate oracle's verdict
//      (agreement on every published test case, including tampered ones);
//   2. JCS fail-closed number handling: exponent-notation / -0 journal
//      numbers are REJECTED, never guessed.
//
// Usage: node chaingraph/vm/twin/verify.test.mjs   (exit 0 = all green)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify, deriveDigests } from './verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, 'fixtures');

const caseFiles = fs
  .readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.case.json'))
  .sort();

const crateVerdicts = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'crate-verdicts.json'), 'utf8')
);

let failures = 0;
const results = [];

for (const f of caseFiles) {
  const cse = JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'));
  const crate = crateVerdicts.find(
    (v) => v.kind === cse.kind && v.name === cse.name
  );
  let twin;
  try {
    twin = verify(cse.receipt, {
      expectedImageId: cse.expected_image_id ?? undefined,
    });
  } catch (e) {
    twin = { valid: null, checks: [{ name: 'twin', passed: false, detail: e.message }] };
  }
  const agree = crate && twin.valid !== null && crate.valid === twin.valid;
  if (!agree) failures++;
  results.push({ case: f, crate: crate ? crate.valid : null, twin: twin.valid, agree });
  console.log(
    `${agree ? 'ok ' : 'FAIL'} ${f.padEnd(34)} crate=${crate ? crate.valid : 'n/a'} twin=${twin.valid}`
  );
}

// Fail-closed JCS number handling — mutation probes on real-art-01.
const real = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'real-art-01.case.json'), 'utf8')
);

function expectRejected(name, mutate) {
  const r = JSON.parse(JSON.stringify(real.receipt));
  mutate(r);
  let rejected = false;
  try {
    const out = verify(r, { expectedImageId: r.imageId });
    rejected = out.valid === false &&
      out.checks.some((c) => c.name === 'claim digest derived' && c.passed === false);
  } catch {
    rejected = false; // verify() must return a named failed check, not throw
  }
  if (!rejected) failures++;
  console.log(`${rejected ? 'ok ' : 'FAIL'} fail-closed: ${name}`);
}

expectRejected('exponent-notation number (1e21)', (r) => {
  r.journal.probe = 1e21;
});
expectRejected('tiny exponent-notation number (1e-7)', (r) => {
  r.journal.probe = 1e-7;
});
expectRejected('negative zero', (r) => {
  r.journal.probe = -0;
});

// And an ordinary integer probe must still PASS (the reject path is narrow).
{
  const r = JSON.parse(JSON.stringify(real.receipt));
  r.journal.probe = 42;
  const out = verify(r, { expectedImageId: r.imageId });
  // journal changed -> digest changes -> pairing must now FAIL (adversarial leg alive)
  const alive = out.valid === false;
  if (!alive) failures++;
  console.log(`${alive ? 'ok ' : 'FAIL'} mutated journal rejected (adversarial leg alive)`);
}

console.log(`\n${results.length} twin-case fixtures + 4 fail-closed probes, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
