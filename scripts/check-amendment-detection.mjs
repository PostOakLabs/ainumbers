#!/usr/bin/env node
/**
 * scripts/check-amendment-detection.mjs — CB7-AMENDMENT-DETECT-1.
 *
 * Diffs the amendment/supersession feed (scripts/amendment-feed.json — a
 * checked-in snapshot of SUPERSESSION-DETECT-1's FLAGGED output; that script
 * asks live publisher indexes and is network-dependent, so it cannot itself
 * be a gate) against CB4's authority index (scripts/check-authority-
 * contradiction.mjs, which knows every live surface asserting a given
 * regulatory identifier as current). For every flagged identifier this
 * unions the feed's own file list with CB4's independently-built index —
 * catching the case where the two citation-extraction instruments disagree,
 * same lesson SUPERSESSION-DETECT-1's report already logged (field-name vs
 * prose-value-shape extraction disagree and both are needed).
 *
 * For each affected file, this checks for qualifying language (supersede,
 * superseded, replaced by, no longer current/in force, historical
 * reference — case-insensitive, anywhere in the file). A flagged citation
 * with NO such marker on its file is an AMENDMENT DETECTED AND UNADDRESSED
 * gap. This is deliberately NOT a hand-maintained "X superseded by Y" table
 * (CLAUSE-BINDING-BUILD-SPEC.md §8/§0.7 ban that outright) — it only checks
 * whether the file itself shows any sign of having been reviewed since the
 * publisher flagged its citation.
 *
 * RED (self-triggering, no human review step, per Standing Order #0):
 * any flagged identifier maps to a file with no qualifying marker AND that
 * (identifier, file) pair is not already in the baseline ratchet (same
 * pattern as scripts/authority-contradiction-baseline.json — shields
 * TODAY'S already-known backlog so the gate can wire into preflight without
 * immediately reddening main; counts only shrink as files get remediated,
 * never grow without deliberate review).
 *
 * ⛔ Never emits a ratio or percentage (CLAUSE-BINDING-BUILD-SPEC.md §0.7/§13)
 * — gap list is file paths + identifier only.
 *
 * Usage: node scripts/check-amendment-detection.mjs [--json out.json] [--update]
 * Exit 0 = no NEW unaddressed amendment gap. Exit 1 = at least one found.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEntries, buildAuthorityIndex } from './check-authority-contradiction.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FEED_PATH = resolve(REPO, 'scripts', 'amendment-feed.json')
const BASELINE_PATH = resolve(REPO, 'scripts', 'amendment-detection-baseline.json')

// Generic "this citation has been reviewed since it was flagged" marker.
// Deliberately NOT tied to any specific successor identifier (that would be
// the banned hand-seeded supersession table) — just: does the file show any
// sign someone looked at this since the publisher flagged it.
const QUALIFYING_MARKER = /supersed(e[sd]?|ing|ure)|replaced\s+by|no\s+longer\s+(current|in\s+force)|historical\s+reference/i

export function loadFeed(path = FEED_PATH) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  return raw.flagged
}

// Union the feed's own file list for a canonical identifier with whatever
// CB4's authority index independently found asserting the same identifier —
// two independently-built extraction passes over the live estate.
export function affectedFiles(feedRows, authorityIndex) {
  const byIdentifier = new Map() // canonical -> Set(file)
  for (const row of feedRows) {
    if (!byIdentifier.has(row.normalized)) byIdentifier.set(row.normalized, new Set())
    byIdentifier.get(row.normalized).add(row.file)
  }
  for (const [canonical, files] of byIdentifier) {
    const fromIndex = authorityIndex.get(canonical)
    if (fromIndex) for (const entry of fromIndex) files.add(entry.file)
  }
  return byIdentifier
}

export function findUnaddressedGaps(byIdentifier, readFile = (f) => readFileSync(resolve(REPO, f), 'utf8')) {
  const gaps = []
  for (const [identifier, files] of byIdentifier) {
    for (const file of [...files].sort()) {
      let text
      try {
        text = readFile(file)
      } catch {
        gaps.push({ identifier, file, reason: 'file not found (feed may be stale)' })
        continue
      }
      if (!QUALIFYING_MARKER.test(text)) {
        gaps.push({ identifier, file, reason: 'amendment flagged, no qualifying/supersession language found on the asserting file' })
      }
    }
  }
  return gaps
}

export function gapKey(g) {
  return `${g.identifier}::${g.file}`
}

function loadBaseline() {
  try {
    return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')))
  } catch {
    return new Set()
  }
}

const isMain = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
  } catch {
    return false
  }
})()

if (isMain) {
  const feedRows = loadFeed()
  const entries = loadEntries()
  const authorityIndex = buildAuthorityIndex(entries)
  const byIdentifier = affectedFiles(feedRows, authorityIndex)
  const gaps = findUnaddressedGaps(byIdentifier)

  const doUpdate = process.argv.includes('--update')
  if (doUpdate) {
    const keys = gaps.map(gapKey).sort()
    writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + '\n')
    console.log(`amendment-detection: baseline written for ${keys.length} known unaddressed gap(s).`)
    process.exit(0)
  }

  const jsonIdx = process.argv.indexOf('--json')
  if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
    writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ gaps }, null, 2))
  }

  const baseline = loadBaseline()
  const known = gaps.filter((g) => baseline.has(gapKey(g)))
  const fresh = gaps.filter((g) => !baseline.has(gapKey(g)))

  if (known.length > 0) {
    console.log(`⚠ ${known.length} known (baselined) unaddressed amendment gap(s) — shrink scripts/amendment-detection-baseline.json as these get remediated:\n`)
    for (const g of known) console.log(`  [${g.identifier}] ${g.file} — ${g.reason}`)
  }

  if (fresh.length > 0) {
    console.log(`\n✗ ${fresh.length} NEW unaddressed amendment gap(s) found:\n`)
    for (const g of fresh) console.log(`  [${g.identifier}] ${g.file} — ${g.reason}`)
  } else if (known.length === 0) {
    console.log('✓ no unaddressed amendment gaps found against the current feed')
  } else {
    console.log('\n✓ no NEW unaddressed amendment gaps beyond the baseline')
  }

  console.log('\nNot yet covered by this check (interpretation records: none exist, §7/CB-6 is parked; chain-level citations: chaingraph.json is not independently indexed for citations by this pass) — file-paths-only scope matches CB4\'s own tools+guides scope, no ratio ever (§0.7/§13).')

  process.exit(fresh.length > 0 ? 1 : 0)
}
