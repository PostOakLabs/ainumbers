#!/usr/bin/env node
/**
 * scripts/check-amendment-detection.test.mjs — fixture proof for
 * CB7-AMENDMENT-DETECT-1.
 *
 * Positive control: an in-memory feed row for a made-up identifier against a
 * fake "unaddressed" file (no qualifying language) must be flagged; the same
 * identifier against a file that DOES carry qualifying language must not be.
 * Also proves affectedFiles() unions the feed's own file list with CB4's
 * authority index rather than trusting either alone.
 *
 * Usage: node scripts/check-amendment-detection.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */

import { affectedFiles, findUnaddressedGaps, gapKey } from './check-amendment-detection.mjs'

let failures = 0
function assert(cond, msg) {
  if (!cond) {
    failures++
    console.log(`✗ ${msg}`)
  } else {
    console.log(`✓ ${msg}`)
  }
}

// ── Fixture 1: union of feed file-list with CB4 authority-index file-list ──
const feedRows = [{ file: 'tools/fixture-a.html', normalized: 'SR 99-1', value: 'SR 99-1', type: 'SR', reason: 'absent from index' }]
const fakeAuthorityIndex = new Map([['SR 99-1', [{ file: 'tools/fixture-b.html', raw: 'SR 99-1', family: 'FED-SR' }]]])
const byIdentifier = affectedFiles(feedRows, fakeAuthorityIndex)
assert(byIdentifier.has('SR 99-1'), 'affectedFiles keys by the canonical/normalized identifier')
assert(
  byIdentifier.get('SR 99-1').has('tools/fixture-a.html') && byIdentifier.get('SR 99-1').has('tools/fixture-b.html'),
  'affectedFiles unions the feed-reported file with the CB4-authority-index file for the same identifier (two independent extraction instruments)'
)

// ── Fixture 2: unaddressed file (no qualifying marker) is flagged ─────────
const fakeReader = (files) => (path) => {
  if (!(path in files)) throw new Error('ENOENT')
  return files[path]
}
const unaddressedFiles = {
  'tools/fixture-a.html': '<html>cites SR 99-1 with no further comment</html>',
}
const gapsUnaddressed = findUnaddressedGaps(new Map([['SR 99-1', new Set(['tools/fixture-a.html'])]]), fakeReader(unaddressedFiles))
assert(gapsUnaddressed.length === 1, 'a flagged identifier on a file with no qualifying language is reported as an unaddressed gap')
assert(gapsUnaddressed[0].identifier === 'SR 99-1' && gapsUnaddressed[0].file === 'tools/fixture-a.html', 'the gap names the correct identifier and file')

// ── Fixture 3: addressed file (qualifying marker present) is NOT flagged ───
const addressedFiles = {
  'tools/fixture-a.html': '<div class="notice">SR 99-1 was superseded by SR 99-2 on 2026-01-01.</div>',
}
const gapsAddressed = findUnaddressedGaps(new Map([['SR 99-1', new Set(['tools/fixture-a.html'])]]), fakeReader(addressedFiles))
assert(gapsAddressed.length === 0, 'a flagged identifier on a file that already carries supersession language is NOT reported as a gap')

// ── Fixture 4: missing file reports a gap rather than crashing/silently passing ──
const gapsMissing = findUnaddressedGaps(new Map([['SR 99-1', new Set(['tools/does-not-exist.html'])]]), fakeReader({}))
assert(gapsMissing.length === 1 && /not found/.test(gapsMissing[0].reason), 'a file the reader cannot find is reported as its own gap, never silently skipped')

// ── Fixture 5: gapKey is a stable identifier::file string ─────────────────
assert(gapKey({ identifier: 'SR 99-1', file: 'tools/fixture-a.html' }) === 'SR 99-1::tools/fixture-a.html', 'gapKey produces a stable identifier::file key for the baseline ratchet')

if (failures > 0) {
  console.log(`\n❌ ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n✅ all fixture assertions passed')
