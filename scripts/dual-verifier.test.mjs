// dual-verifier.test.mjs — mixed-tree cases for verifySealReport (RISC0-310-R4-DUAL-VERIFIER-1).
// Run: node scripts/dual-verifier.test.mjs   (exit 0 = all cases pass)
// Also run by chaingraph/kernels/compute-proof.test.mjs through runDualVerifierCases().
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { verifySeal, verifySealReport, sealParameterSet, LEGACY_IMAGE_IDS, CURRENT_IMAGE_IDS } from '../chaingraph/kernels/_computeproof.mjs';

const KERNELS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'chaingraph', 'kernels');
const read = (p) => JSON.parse(readFileSync(resolve(KERNELS, p), 'utf8'));

/** Runs the six cases; returns the number of failed assertions. */
export function runDualVerifierCases({ log = console.log, err = console.error } = {}) {
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; err('  ✗ (dual) ' + m); } else log('  ✓ (dual) ' + m); };

  const NEW = read('fixtures/compute-proof-310/art-313-traiga-exposure-assessor.receipt.json');
  // OLD = the first standalone receipt fixture still under a legacy image id (sorted, so re-seals move it).
  const OLD_FILE = readdirSync(resolve(KERNELS, 'fixtures/compute-proof')).filter((f) => f.endsWith('.receipt.json')).sort()
    .find((f) => sealParameterSet(read(`fixtures/compute-proof/${f}`).imageId) === 'legacy');
  const OLD = OLD_FILE ? read(`fixtures/compute-proof/${OLD_FILE}`) : null;
  const tamperJournal = (cp) => { const t = structuredClone(cp); t.journal.output = { ...t.journal.output, __tamper_probe: true }; return t; };

  ok(!!OLD, `a legacy-id standalone fixture exists (${OLD_FILE ?? 'none'})`);
  if (!OLD) return fail;
  ok(LEGACY_IMAGE_IDS.length === 7 && CURRENT_IMAGE_IDS.length === 8, 'allowlists hold 7 legacy and 8 current image ids');
  ok(!LEGACY_IMAGE_IDS.some((id) => CURRENT_IMAGE_IDS.includes(id)), 'allowlists are disjoint');
  ok(sealParameterSet(NEW.imageId) === 'current' && sealParameterSet(OLD.imageId) === 'legacy', 'fixtures carry one id from each list');

  // 1. new receipt, new image id
  ok(verifySealReport(NEW) === 'current' && verifySeal(NEW) === true, 'case 1: new receipt + new id = current');
  // 2. old receipt, old image id
  ok(verifySealReport(OLD) === 'legacy' && verifySeal(OLD) === true, 'case 2: old receipt + old id = legacy');
  // 3. new seal, old image id
  ok(verifySealReport({ ...NEW, imageId: OLD.imageId }) === 'invalid', 'case 3: new seal + old id = invalid');
  // 4. old seal, new image id
  ok(verifySealReport({ ...OLD, imageId: NEW.imageId }) === 'invalid', 'case 4: old seal + new id = invalid');
  // 5. tampered journal under each set
  ok(verifySealReport(tamperJournal(NEW)) === 'invalid', 'case 5a: tampered journal under the current set = invalid');
  ok(verifySealReport(tamperJournal(OLD)) === 'invalid', 'case 5b: tampered journal under the legacy set = invalid');
  // 6. image id in neither list = invalid before pairing
  const NEITHER = [
    'sha256:d022c4822d2fee377994fcc2aa06d8b004c2c2709cc128a6428b8f9bcfa07988',
    'sha256:' + 'b'.repeat(64),
    NEW.imageId.toUpperCase().replace('SHA256:', 'sha256:'),
  ];
  for (const id of NEITHER) ok(sealParameterSet(id) === null && verifySealReport({ ...NEW, imageId: id }) === 'invalid', `case 6: ${id.slice(0, 15)}… in neither list = invalid`);
  const unserializable = { ...NEW.journal, probe: 1n };
  let threwUnderKnownId = false;
  try { verifySealReport({ ...OLD, journal: unserializable }); } catch { threwUnderKnownId = true; }
  ok(threwUnderKnownId, 'case 6 probe: a known id reaches the journal hashing step');
  let verdict;
  try { verdict = verifySealReport({ ...NEW, imageId: NEITHER[1], journal: unserializable }); } catch { verdict = 'threw'; }
  ok(verdict === 'invalid', 'case 6: an id in neither list returns invalid without reaching the journal hashing step');
  return fail;
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const fail = runDualVerifierCases();
  console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all dual-verifier mixed-tree cases passed');
  process.exit(fail ? 1 : 0);
}
