#!/usr/bin/env node
/**
 * scripts/check-authority-contradiction.test.mjs — fixture proof for
 * CB4-CONTRADICTION-GATE-1.
 *
 * Positive control: reconstructs the PRE-FIX estate shape from
 * board/done/SR2602-SUPERSESSION-1.md (five files asserting SR 11-7
 * unqualified, one asserting SR 26-02, all sharing an MRM topic tag) as an
 * in-memory fixture — never by reverting the live fix — and asserts the
 * checker flags it. Also asserts no false positive on unrelated files, and
 * that co-citing two different families (SR + OCC) on the same file is not
 * itself a contradiction.
 *
 * Usage: node scripts/check-authority-contradiction.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */

import { normalizeIdentifier, computeStoplist, findContradictions, contradictionKey } from './check-authority-contradiction.mjs'

let failures = 0
function assert(cond, msg) {
  if (!cond) {
    failures++
    console.log(`✗ ${msg}`)
  } else {
    console.log(`✓ ${msg}`)
  }
}

// ── Fixture 1: reconstructed pre-fix state ─────────────────────────────
// Five surfaces citing SR 11-7 unqualified, one citing SR 26-02 — the exact
// shape SR2602-SUPERSESSION-1 found and fixed live. Built here as data, not
// by reading any real file, so this test stays valid even after the
// original fix ships.
const preFixEntries = [
  { file: 'tools/312-fixture.html', tags: ['model risk', 'mrm', 'federal reserve', 'compliance', 'banking'], identifiers: [{ raw: 'Federal Reserve SR 11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
  { file: 'tools/451-fixture.html', tags: ['model risk', 'mrm', 'federal reserve', 'compliance', 'banking'], identifiers: [{ raw: 'SR 11-7 (April 2011)', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
  { file: 'tools/452-fixture.html', tags: ['model risk', 'mrm', 'compliance', 'banking'], identifiers: [{ raw: 'SR11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
  { file: 'tools/rbe-09-fixture.html', tags: ['model risk', 'mrm', 'compliance', 'banking'], identifiers: [{ raw: 'SR-11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
  { file: 'tools/158-fixture.html', tags: ['model risk', 'mrm', 'compliance', 'banking'], identifiers: [{ raw: 'SR 11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
  { file: 'tools/339-fixture.html', tags: ['model risk', 'mrm', 'federal reserve', 'compliance', 'banking'], identifiers: [{ raw: 'SR 26-02 (April 17, 2026)', family: 'FED-SR', canonical: 'SR 26-2', contradictionEligible: true }] },
]

// Filler files simulate estate scale (~600 files) so the corpus-derived
// stoplist behaves as it would for real: "compliance"/"banking" are common
// enough across the whole estate to be generic (excluded from topic-overlap
// matching), while "model risk"/"mrm" stay rare and stay informative. Without
// this dilution, a 6-file-only sample would wrongly treat every tag as
// "common" (each appears on 100% of a 6-file corpus) and the topic-overlap
// signal this gate depends on would never fire.
const fillerEntries = Array.from({ length: 150 }, (_, i) => ({
  file: `tools/filler-${i}.html`,
  tags: ['compliance', 'banking', 'unrelated-topic'],
  identifiers: [{ raw: 'FATF Recommendation 16', family: 'UNRELATED', canonical: 'FATF R16' }],
}))

const fullCorpus = [...preFixEntries, ...fillerEntries]
const stoplist = computeStoplist(fullCorpus)
assert(stoplist.has('compliance') && stoplist.has('banking'), 'corpus-derived stoplist excludes tags common across the wider estate ("compliance", "banking")')
assert(!stoplist.has('model risk') && !stoplist.has('mrm'), 'corpus-derived stoplist keeps rare topic tags informative ("model risk", "mrm")')

const contradictions = findContradictions(fullCorpus, stoplist)

assert(contradictions.length > 0, 'positive control: pre-fix fixture (5x SR 11-7 vs 1x SR 26-2, shared MRM topic) is flagged')
assert(
  contradictions.some((c) => c.family === 'FED-SR' && [c.a.file, c.b.file].includes('tools/339-fixture.html')),
  'flagged contradiction correctly names the SR 26-2 outlier file as one side'
)
assert(
  contradictions.every((c) => c.a.identifiers.every((id) => /^SR /.test(id)) && c.b.identifiers.every((id) => /^SR /.test(id))),
  'flagged contradictions stay within the FED-SR family (never cross-family)'
)

// ── Fixture 2: no false positive across unrelated topics ────────────────
const unrelatedEntries = [
  { file: 'tools/a.html', tags: ['sanctions', 'aml'], identifiers: [{ raw: 'SR 11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
  { file: 'tools/b.html', tags: ['crypto', 'stablecoins'], identifiers: [{ raw: 'SR 26-02', family: 'FED-SR', canonical: 'SR 26-2', contradictionEligible: true }] },
]
const stop2 = computeStoplist(unrelatedEntries)
const none = findContradictions(unrelatedEntries, stop2)
assert(none.length === 0, 'no shared topic tag ⇒ no contradiction reported, even with disjoint SR-family identifiers')

// ── Fixture 3: co-citation within one file is not a contradiction ───────
const coCiteEntries = [
  { file: 'tools/c.html', tags: ['model risk', 'ccar'], identifiers: [{ raw: 'SR 11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }, { raw: 'SR 15-18', family: 'FED-SR', canonical: 'SR 15-18', contradictionEligible: true }] },
  { file: 'tools/d.html', tags: ['model risk', 'ccar'], identifiers: [{ raw: 'SR 11-7', family: 'FED-SR', canonical: 'SR 11-7', contradictionEligible: true }] },
]
const stop3 = computeStoplist(coCiteEntries)
const coCite = findContradictions(coCiteEntries, stop3)
assert(coCite.length === 0, 'file citing both SR 11-7 and SR 15-18 alongside a file citing only SR 11-7 is not flagged (overlap exists, not disjoint)')

// ── Fixture 4: identifier normalisation ──────────────────────────────────
assert(normalizeIdentifier('SR 26-02 (April 17, 2026)').canonical === 'SR 26-2', 'leading-zero variant normalises: "SR 26-02" -> "SR 26-2"')
assert(normalizeIdentifier('SR11-7').canonical === 'SR 11-7', 'unspaced variant normalises: "SR11-7" -> "SR 11-7"')
assert(normalizeIdentifier('SR-15-18').canonical === 'SR 15-18', 'hyphenated variant normalises: "SR-15-18" -> "SR 15-18"')
assert(normalizeIdentifier('OCC Bulletin 2011-12').canonical === 'OCC 2011-12', 'OCC Bulletin form normalises')
assert(normalizeIdentifier('OCC 2011-12').canonical === 'OCC 2011-12', 'OCC short form normalises to the same canonical id')
assert(normalizeIdentifier('BCBS239').canonical === 'BCBS 239', 'BCBS unspaced form normalises')
assert(
  normalizeIdentifier('Regulation (EU) 2015/847').family !== normalizeIdentifier('Regulation (EU) 2019/834').family,
  'EMIR (648/2012-lineage) vs EMIR Refit (2019/834) stay distinct families — known-unswept gap, not fused'
)

// ── Fixture 5: baseline ratchet ──────────────────────────────────────────
// A contradiction whose key is in the baseline is "known" (advisory, does
// not fail); one absent from the baseline is "new" (fails). This is what
// lets the gate wire into preflight today, over an estate that already
// carries one baselined contradiction, without immediately reddening main.
const baselineKey = contradictionKey(contradictions[0])
assert(typeof baselineKey === 'string' && baselineKey.includes('::'), 'contradictionKey produces a stable string key from family + sorted file pair')
const baselineSet = new Set([baselineKey])
const stillFresh = contradictions.filter((c) => !baselineSet.has(contradictionKey(c)))
assert(stillFresh.length === contradictions.length - 1, 'a baselined contradiction key is excluded from the fresh (failing) set')

if (failures > 0) {
  console.log(`\n❌ ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n✅ all fixture assertions passed')
