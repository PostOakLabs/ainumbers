#!/usr/bin/env node
/**
 * scripts/verify-mcp-protocol-version.mjs — MCP protocol-version drift gate.
 *
 * Single source of truth: data/mcp-protocol-version.json's `negotiated_protocol_version`.
 * Four published surfaces quote this string; this gate fails if any of them drifts from
 * the committed value. On a real protocol bump, re-verify live and update ONLY that one
 * JSON file (see its `note` field) — never hand-edit the pages.
 *
 * Modes:
 *   node scripts/verify-mcp-protocol-version.mjs          # --check (CI default)
 *   node scripts/verify-mcp-protocol-version.mjs --fix    # write the canonical value to all sites
 *
 * Deliberately does NOT check `spec_edition_conformed` anywhere — that is a separate,
 * narrower conformance claim this WU's fence forbids adding or upgrading.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const FIX = process.argv.includes('--fix')

const read  = rel => readFileSync(resolve(root, rel), 'utf8')
const write = (rel, txt) => writeFileSync(resolve(root, rel), txt, 'utf8')

const { negotiated_protocol_version: V } = JSON.parse(read('data/mcp-protocol-version.json'))

const RULES = [
  { file: 'docs/index.html', label: 'MCP endpoint details transport row',
    regex: /(Streamable HTTP \(MCP JSON-RPC 2\.0, protocol version )([0-9]{4}-[0-9]{2}-[0-9]{2})(\))/,
  },
  { file: 'docs/openapi.json', label: 'x-mcp.protocol_version',
    regex: /("protocol_version": ")([0-9]{4}-[0-9]{2}-[0-9]{2})(")/,
  },
  { file: 'guides/mcp-clone-guide.html', label: 'curl example header',
    regex: /('mcp-protocol-version: )([0-9]{4}-[0-9]{2}-[0-9]{2})(')/,
  },
  { file: 'guides/mcp-clone-guide.html', label: 'curl example body protocolVersion',
    regex: /("protocolVersion":")([0-9]{4}-[0-9]{2}-[0-9]{2})(",)/,
  },
  { file: 'mcp-playground.html', label: 'doInitialize protocolVersion',
    regex: /(protocolVersion: ')([0-9]{4}-[0-9]{2}-[0-9]{2})(')/,
  },
]

let total = 0
const byFile = new Map()
for (const rule of RULES) {
  if (!byFile.has(rule.file)) byFile.set(rule.file, [])
  byFile.get(rule.file).push(rule)
}

for (const [file, rules] of byFile) {
  let content = read(file)
  let changed = false
  for (const { label, regex } of rules) {
    const re = new RegExp(regex.source, 'g')
    let matched = false
    content = content.replace(re, (match, pre, got, post) => {
      matched = true
      if (got !== V) {
        console.log(`DRIFT  ${file}  ${label}  expected=${V} got=${got}`)
        total++
        if (FIX) { changed = true; return `${pre}${V}${post}` }
      } else {
        console.log(`OK     ${file}  ${label}  ${got}`)
      }
      return match
    })
    if (!matched) {
      console.log(`NO-MATCH  ${file}  ${label}  regex did not match anything - FAIL (update or remove this rule)`)
      total++
    }
  }
  if (FIX && changed) { write(file, content); console.log(`WROTE  ${file}`) }
}

if (total === 0) {
  console.log(`\nAll published MCP protocol-version strings match data/mcp-protocol-version.json (${V}).`)
  process.exit(0)
} else if (FIX) {
  console.log(`\nFixed ${total} drifted site(s).`)
  process.exit(0)
} else {
  console.log(`\n${total} drifted site(s). Run with --fix to repair, or update data/mcp-protocol-version.json if the live version genuinely changed.`)
  process.exit(1)
}
