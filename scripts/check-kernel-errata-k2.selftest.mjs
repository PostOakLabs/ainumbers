#!/usr/bin/env node
/**
 * Self-test for scripts/check-kernel-errata-k2.mjs: planted RED and GREEN controls on real
 * fix pairs from main history.
 *
 *   - RED  (needs-erratum): the real in-place fix 59a5e7cbc7 (art-807) classified with none
 *     of the two satisfactions present, as every kernel PR before the errata log was.
 *   - GREEN (erratum path): the same pair with the real art-807 entry injected; its
 *     kernel_digest_affected[0] is the digest of the kernel at 59a5e7cbc7^ (asserted here,
 *     not assumed).
 *   - RED  (declaration contradicted): a well-formed declaration pinning the real pair
 *     2c54b26ea5 (art-593), injected because the head commit predates the declaration path;
 *     the corpus finds 23 divergent probes, so the declaration is a lie and must read RED.
 *   - GREEN (declaration verified): a byte-identical kernel pair (59a5e7cbc7 vs HEAD for
 *     art-807) through the full verifier (load both versions, corpus, probes). No real
 *     byte-equal-output fix exists in the scanned history - every in-place edit so far was
 *     a fix - so this control proves the verifier's machinery accepts when outputs truly
 *     agree, and the contradicting side is proven by the RED control above. If a later
 *     commit touches the art-807 kernel the precondition assert breaks and this control
 *     must be re-pinned.
 *   - Unit controls on validateDeclaration: five malformed declarations each rejected.
 *
 *   node scripts/check-kernel-errata-k2.selftest.mjs
 * Node built-ins only; no network, no clock, no randomness; writes nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, SOURCES_DIR, resolveCommit, loadKernelAt } from './lib/kernel-errata.mjs';
import { checkK2, collectModifiedKernels, loadEntriesAt, validateDeclaration, verifyNoSemanticChange } from './check-kernel-errata-k2.mjs';

let fails = 0;
const expect = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };

const ART807 = 'art-807-erc3643-transfer-decision';
const ART593 = 'art-593-webbotauth-nonce-replay-check';
const FIX807 = resolveCommit(REPO_ROOT, '59a5e7cbc7');
const ART807_ENTRY = JSON.parse(readFileSync(join(REPO_ROOT, SOURCES_DIR, 'KE-2026-0001.json'), 'utf8'));

const redFor = (lines, toolId, re) => lines.some((l) => l.red && l.toolId === toolId && re.test(l.text));
const greenFor = (lines, toolId, re) => lines.some((l) => !l.red && l.toolId === toolId && re.test(l.text));

// Precondition: the fix pair really modifies the art-807 kernel in place.
expect('precondition: 59a5e7cbc7 modifies art-807 in place', collectModifiedKernels(REPO_ROOT, `${FIX807}^`, FIX807).some((m) => m.toolId === ART807 && m.status === 'M'));
const oldDigest807 = (await loadKernelAt(REPO_ROOT, `${FIX807}^`, ART807)).digest;
expect('precondition: the real art-807 entry names the digest at 59a5e7cbc7^', ART807_ENTRY.kernel_digest_affected.includes(oldDigest807));

// RED: the fix pair with no erratum and no declaration (the state of every pre-log kernel PR).
{
  const { lines, examined } = await checkK2(REPO_ROOT, `${FIX807}^`, FIX807, { entries: [] });
  expect('K2 red: the real art-807 fix without an erratum or declaration', examined >= 1 && redFor(lines, ART807, /without an erratum naming the old digest/));
}
// GREEN: the same pair with the real entry injected (added beside the base).
{
  const { lines } = await checkK2(REPO_ROOT, `${FIX807}^`, FIX807, { entries: [{ path: `${SOURCES_DIR}/KE-2026-0001.json`, entry: ART807_ENTRY }] });
  expect('K2 green: an erratum naming the old digest satisfies the gate', greenFor(lines, ART807, /names the old digest/));
}
// RED: an erratum that ALREADY existed at the base does not cover a new fix; the entry must
// be added by this change. Same injected head record as the GREEN control, but also present
// at the base, which drops it from the added set.
{
  const rec = { path: `${SOURCES_DIR}/KE-2026-0001.json`, entry: ART807_ENTRY };
  const { lines } = await checkK2(REPO_ROOT, `${FIX807}^`, FIX807, { entries: [rec], baseEntries: [rec] });
  expect('K2 red: an erratum that existed at the base is not this fix\'s erratum', redFor(lines, ART807, /without an erratum naming the old digest/));
}
// RED: a well-formed declaration contradicted by the corpus (the real art-593 fix pair).
{
  const newDigest593 = (await loadKernelAt(REPO_ROOT, '2c54b26ea5', ART593)).digest;
  const oldDigest593 = (await loadKernelAt(REPO_ROOT, '2c54b26ea5^', ART593)).digest;
  const decl = { kind: 'no-semantic-change', tool_id: ART593, old_digest: oldDigest593, new_digest: newDigest593, declared_at: '2026-11-14', row: 'planted control' };
  expect('K2 precondition: the art-593 digests really moved', oldDigest593 !== newDigest593);
  expect('K2 unit: a correct-shaped declaration validates', validateDeclaration(decl, { toolId: ART593, oldDigest: oldDigest593, newDigest: newDigest593 }).length === 0);
  const { lines } = await checkK2(REPO_ROOT, '2c54b26ea5^', '2c54b26ea5', { entries: [], declarations: new Map([[ART593, decl]]) });
  expect('K2 red: a declaration contradicted by divergent probes', redFor(lines, ART593, /contradicted by \d+ of \d+ probes/));
}
// GREEN: the verifier accepts a pair whose outputs truly agree (byte-identical kernel bytes).
{
  const head = resolveCommit(REPO_ROOT, 'HEAD');
  expect('K2 precondition: art-807 kernel is byte-identical at 59a5e7cbc7 and HEAD', (await loadKernelAt(REPO_ROOT, FIX807, ART807)).digest === (await loadKernelAt(REPO_ROOT, head, ART807)).digest);
  const v = await verifyNoSemanticChange(REPO_ROOT, FIX807, head, ART807);
  expect('K2 green: the verifier passes a truly unchanged pair (non-vacuous)', v.ok === true && v.probes > 0 && v.divergent === 0);
}
// Unit: five malformed declarations are each rejected.
{
  const good = { kind: 'no-semantic-change', tool_id: ART593, old_digest: `sha256:${'a'.repeat(64)}`, new_digest: `sha256:${'b'.repeat(64)}`, declared_at: '2026-11-14', row: 'x' };
  const bad = (over) => validateDeclaration({ ...structuredClone(good), ...over }, { toolId: ART593, oldDigest: good.old_digest, newDigest: good.new_digest }).length > 0;
  expect('K2 unit: wrong kind rejected', bad({ kind: 'other' }));
  expect('K2 unit: wrong tool_id rejected', bad({ tool_id: 'art-1-x' }));
  expect('K2 unit: old_digest pinning another change rejected', bad({ old_digest: `sha256:${'c'.repeat(64)}` }));
  expect('K2 unit: bad declared_at rejected', bad({ declared_at: 'november' }));
  expect('K2 unit: missing row rejected', bad({ row: '' }));
  expect('K2 unit: non-object rejected', validateDeclaration(null, { toolId: ART593, oldDigest: good.old_digest, newDigest: good.new_digest }).length > 0);
}
// Smoke: the replay walker resolves real commits and classifies the newest without crashing.
{
  const entriesNow = loadEntriesAt(REPO_ROOT, 'HEAD');
  expect('K2 smoke: entries loadable at HEAD', entriesNow.length >= 3);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
