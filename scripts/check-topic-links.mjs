#!/usr/bin/env node
/**
 * scripts/check-topic-links.mjs — TOOLS-GRAPH-BRIDGE-1 gate.
 *
 * data/topic-links.json records same-subject clusters split across tools/
 * (UI) and chaingraph/ (proof node) pages, plus a guide hub where one exists.
 * This gate verifies, for every topic: every listed file exists, and every
 * page in the topic links to every OTHER page in the topic (basename match).
 * Delegates freshness of the generated block itself to apply-topic-links.mjs --check.
 *
 * Zero-dep, node: builtins only.
 *
 * Usage: node scripts/check-topic-links.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const registry = JSON.parse(readFileSync(resolve(root, 'data/topic-links.json'), 'utf8'))

let failed = false
let pages = 0
let links = 0

for (const topic of registry.topics) {
  const allPaths = [...topic.tool_paths, ...topic.node_paths, ...(topic.guide_paths || [])]

  for (const p of allPaths) {
    if (!existsSync(resolve(root, p))) {
      failed = true
      console.error(`check-topic-links: MISSING file ${p} (topic ${topic.key})`)
    }
  }

  for (const selfPath of allPaths) {
    const abs = resolve(root, selfPath)
    if (!existsSync(abs)) continue
    pages++
    const html = readFileSync(abs, 'utf8')
    for (const otherPath of allPaths) {
      if (otherPath === selfPath) continue
      const otherFile = basename(otherPath)
      links++
      if (!html.includes(otherFile)) {
        failed = true
        console.error(`check-topic-links: ${selfPath} does not link to ${otherFile} (topic ${topic.key})`)
      }
    }
  }
}

try {
  execFileSync('node', ['scripts/apply-topic-links.mjs', '--check'], { cwd: root, stdio: 'pipe' })
} catch (e) {
  failed = true
  console.error(e.stdout?.toString() || e.message)
  console.error(e.stderr?.toString() || '')
}

if (failed) {
  console.error('check-topic-links: FAILED — resolve missing files/links before pushing.')
  process.exit(1)
}

console.log(`check-topic-links: OK — ${registry.topics.length} topics, ${pages} pages, ${links} cross-links verified.`)
