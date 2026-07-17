#!/usr/bin/env node
/**
 * scripts/check-tool-number-unique.mjs — Tool-number collision gate.
 *
 * tool-page numbers are a global monotonic sequence, hand-derived by whichever
 * session builds next. Two sessions landing in the same window can each self-derive
 * the same number off a base that doesn't yet include the other's PR (the TOOLNUM-FIX-1
 * incident: DATAROOM-1 and FA-4 both shipped "546"). The count-drift gate only counts
 * FILES, so a collision still passes it — this gate parses the leading number itself
 * and fails on any repeat.
 *
 * Scoped to tools/*.html only. manifests/*.manifest.json filenames are NOT checked:
 * chaingraph art-node manifests are pre-existingly filed with plain-number filenames
 * that don't match their own tool_id (e.g. manifests/520-c2pa-manifest-validator.manifest.json
 * has tool_id "art-123-c2pa-manifest-validator") — a separate, out-of-scope manifest-hygiene
 * quirk, not a live tool-page collision. Checking manifests would make this gate permanently
 * red on unrelated pre-existing debt. tools/*.html is the actual tool-number sequence.
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP, no npm/Ajv ever).
 *
 * Usage: node scripts/check-tool-number-unique.mjs
 * Exit 0 = every number unique. Exit 1 = prints every collision and its file paths.
 */

import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const NUM_RE = /^(\d+)-/

function collectNumbers(dir, ext) {
  const files = readdirSync(resolve(root, dir)).filter(f => f.endsWith(ext))
  const byNumber = new Map()
  for (const f of files) {
    const m = NUM_RE.exec(f)
    if (!m) continue
    const n = m[1]
    if (!byNumber.has(n)) byNumber.set(n, [])
    byNumber.get(n).push(`${dir}/${f}`)
  }
  return byNumber
}

const toolsByNumber = collectNumbers('tools', '.html')

let failed = false

for (const [num, paths] of toolsByNumber) {
  if (paths.length > 1) {
    failed = true
    console.error(`check-tool-number-unique: duplicate tool number "${num}" in tools/*.html:`)
    for (const p of paths) console.error(`  ${p}`)
  }
}

if (failed) {
  console.error('check-tool-number-unique: FAILED — resolve the collision (renumber the newer file) before pushing.')
  process.exit(1)
}

console.log(`check-tool-number-unique: OK — ${toolsByNumber.size} unique tool numbers in tools/*.html.`)
