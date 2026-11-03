#!/usr/bin/env node
/**
 * scripts/migrate-reservations-shards.mjs — one-shot split of the legacy id
 * registry into one file per id (RESERVATIONS-SHARD-1, 2026-11-03).
 *
 * chaingraph/graph/RESERVATIONS.json was one JSON object every node-minting PR
 * appended to, so two PRs reserving DIFFERENT ids conflicted on adjacent tail
 * lines (7 of 12 sampled DIRTY PRs on 2026-11-03). GitHub ignores
 * .gitattributes merge drivers for PR mergeability and the merge queue, so the
 * fix is layout: chaingraph/graph/reservations/art-<n>.json, one file per id.
 * Two PRs reserving the SAME id still create the same path with different
 * bytes (add/add conflict), so the lock check-id-collision.mjs relies on
 * survives.
 *
 * This script writes one shard per legacy entry, object copied as-is
 * (`{row, pr, reserved}` plus any `status`/`note`), 2-space JSON + LF. It
 * never edits RESERVATIONS.json (kept byte-identical so open PRs that already
 * appended to it stay mergeable; check-id-collision.mjs reads the union).
 * An existing shard whose content differs from the legacy entry is reported
 * and left alone: the gate refuses that mismatch, a human decides.
 *
 * Zero-dep, node: builtins only.
 *
 * Usage:
 *   node scripts/migrate-reservations-shards.mjs          # write missing shards
 *   node scripts/migrate-reservations-shards.mjs --check  # exit 1 if any legacy id lacks an equal shard
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const LEGACY = resolve(REPO, 'chaingraph/graph/RESERVATIONS.json')
const DIR = resolve(REPO, 'chaingraph/graph/reservations')
const ID_RE = /^art-\d+$/

const CHECK = process.argv.includes('--check')

/** Canonical shard bytes for one entry (the gate never compares bytes, only parsed objects). */
export function shardText(entry) {
  return JSON.stringify(entry, null, 2) + '\n'
}

const legacy = JSON.parse(readFileSync(LEGACY, 'utf8'))
if (!CHECK) mkdirSync(DIR, { recursive: true })

let written = 0, same = 0, mismatched = 0, missing = 0
for (const [id, entry] of Object.entries(legacy)) {
  if (!ID_RE.test(id)) { console.error(`  skip non-id key ${id}`); continue }
  const path = resolve(DIR, `${id}.json`)
  if (existsSync(path)) {
    if (isDeepStrictEqual(JSON.parse(readFileSync(path, 'utf8')), entry)) { same++; continue }
    mismatched++
    console.error(`  MISMATCH ${id}: shard differs from legacy entry — left alone (check-id-collision refuses it)`)
    continue
  }
  if (CHECK) { missing++; console.error(`  missing shard ${id}`); continue }
  writeFileSync(path, shardText(entry))
  written++
}

console.error(`migrate-reservations-shards${CHECK ? ' --check' : ''}: legacy=${Object.keys(legacy).length} ` +
  `written=${written} already-equal=${same} mismatched=${mismatched}${CHECK ? ` missing=${missing}` : ''}`)
process.exit(mismatched + missing === 0 ? 0 : 1)
