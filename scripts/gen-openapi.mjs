#!/usr/bin/env node
/**
 * gen-openapi.mjs — Generate openapi.json from manifests + chaingraph.json
 *
 * Outputs:
 *   repo/openapi.json        (served at ainumbers.co/openapi.json via DreamHost)
 *   repo/docs/openapi.json   (served at docs.ainumbers.co/openapi.json via Cloudflare Pages)
 *   repo/docs/catalog.json   (copy of mcp/catalog.json for Cloudflare Pages)
 *
 * Transport note: the live transport is MCP JSON-RPC at https://mcp.ainumbers.co/mcp.
 * The REST paths in this file are a descriptive projection (data-room artifact).
 * They become functional only if the REST shim (Area 2 Path B) is deployed.
 *
 * Never hardcode tool counts — derived at generation time from manifests on disk.
 *
 * Usage:
 *   node scripts/gen-openapi.mjs          # write openapi.json + docs/{openapi,catalog}.json + docs/index.html sentinels
 *   node scripts/gen-openapi.mjs --check  # freshness gate (exit 1 if any output is stale)
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deriveCounts } from './counts.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const CHECK = process.argv.includes('--check')

// Derive counts once — used for the OpenAPI description and docs/index.html sentinels.
const C = deriveCounts()

// ── 1. Read all manifests ────────────────────────────────────────────────────
const manifestsDir = join(repoRoot, 'manifests')
const manifestFiles = readdirSync(manifestsDir)
  .filter(f => f.endsWith('.manifest.json'))
  .sort()

const byMcpName = new Map()

for (const file of manifestFiles) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(manifestsDir, file), 'utf8'))
  } catch {
    console.warn(`  skip (parse error): ${file}`)
    continue
  }
  const mcpName = manifest?.mcp_tool_definition?.name
  if (!mcpName) continue
  if (byMcpName.has(mcpName)) {
    console.warn(`  duplicate mcp_name "${mcpName}" in ${file} — skipping`)
    continue
  }
  byMcpName.set(mcpName, { source: 'manifest', manifest })
}

// ── 2. Supplement with chaingraph nodes not already covered ─────────────────
const chaingraphPath = join(repoRoot, 'chaingraph', 'chaingraph.json')
const chaingraph = JSON.parse(readFileSync(chaingraphPath, 'utf8'))

for (const node of chaingraph.nodes ?? []) {
  const mcpName = node.mcp_name
  if (!mcpName) continue
  if (byMcpName.has(mcpName)) continue   // manifest already covers it
  byMcpName.set(mcpName, { source: 'chaingraph', node })
}

// ── 3. Build OpenAPI paths ───────────────────────────────────────────────────
const paths = {}

for (const [mcpName, entry] of byMcpName) {
  let summary, description, inputSchema, outputSchema, toolUrl, tags, apExport, wave, mandateType

  if (entry.source === 'manifest') {
    const m = entry.manifest
    summary      = m.title ?? mcpName
    description  = m.description ?? ''
    inputSchema  = m.mcp_tool_definition?.inputSchema ?? m.input_schema ?? { type: 'object' }
    outputSchema = m.output_schema ?? { type: 'object', description: 'Tool execution result payload' }
    toolUrl      = `https://ainumbers.co/${m.execution?.entry ?? 'tools/'}`
    tags         = m.tags ?? []
    apExport     = m.ap2_export ?? false
    mandateType  = null
    wave         = null
  } else {
    const n = entry.node
    summary      = n.display_name ?? mcpName
    description  = n.description ?? ''
    inputSchema  = { type: 'object', description: `See tool page for full input schema: ${n.url}` }
    outputSchema = {
      type: 'object',
      description: `OpenChainGraph v0.4 artifact envelope. mandate_type: ${n.mandate_type}. Verify execution_hash at https://ainumbers.co/chaingraph/verify.html`
    }
    toolUrl      = n.url ?? 'https://ainumbers.co/chaingraph/'
    tags         = [n.mandate_type ?? 'chaingraph'].filter(Boolean)
    apExport     = true
    mandateType  = n.mandate_type ?? null
    wave         = n.wave ?? null
  }

  const op = {
    operationId: mcpName,
    summary,
    description: [
      description,
      `\n\n**Tool URL:** ${toolUrl}`,
      entry.source === 'chaingraph' && wave   ? `\n**Wave:** ${wave}` : '',
      mandateType                             ? `\n**mandate_type:** ${mandateType}` : '',
      apExport                                ? '\n**AP2/Policy Mandate export:** yes' : '',
    ].join('').trim(),
    tags,
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: inputSchema }
      }
    },
    responses: {
      '200': {
        description: 'Successful tool execution result',
        content: {
          'application/json': { schema: outputSchema }
        }
      }
    },
    'x-mcp-tool-name': mcpName,
    'x-tool-url': toolUrl,
    'x-source': entry.source,
  }

  if (apExport)    op['x-ap2-export'] = true
  if (mandateType) op['x-mandate-type'] = mandateType
  if (wave)        op['x-ocg-wave'] = wave

  paths[`/v1/tools/${mcpName}`] = { post: op }
}

const toolCount = Object.keys(paths).length
if (toolCount !== C['openapi.ops']) {
  console.warn(`WARNING: generated path count ${toolCount} != counts.mjs openapi.ops ${C['openapi.ops']} — run verify-counts.mjs --fix if they differ`)
}
console.log(`Generated ${toolCount} paths (${[...byMcpName.values()].filter(e => e.source === 'manifest').length} from manifests, ${[...byMcpName.values()].filter(e => e.source === 'chaingraph').length} from chaingraph nodes)`)

// ── 4. Assemble OpenAPI 3.1 document ────────────────────────────────────────
const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'AINumbers.co Fintech Intelligence Suite',
    version: '1.0.0',
    description: [
      `**${toolCount} fintech intelligence tools** covering ISO 20022, A2A payments, CFPB §1033, EU AI Act, DORA, MiCA, AML/KYC, BaaS, DLT/tokenization, ESG/climate finance, agentic payments (AP2, ACP, x402, Visa TAP, Mastercard Agent Pay), PQC migration, sanctions screening, and OpenChainGraph v0.4 computation chains.`,
      '',
      '## Transport',
      '',
      '> **The live transport is MCP JSON-RPC 2.0 at `https://mcp.ainumbers.co/mcp` — not REST.**',
      '>',
      '> This OpenAPI file is a **descriptive data-room artifact** — a machine-readable index of all tools and their input/output schemas. The REST paths (`POST /v1/tools/{name}`) described here are a projection; they become functional only if the optional REST shim (Area 2 Path B) is deployed.',
      '>',
      '> To call tools today, connect via the [official MCP client SDKs](https://docs.ainumbers.co). TypeScript: `@modelcontextprotocol/sdk`. Python: `mcp`.',
      '',
      '## Architecture',
      '',
      'All tools run **entirely client-side** (browser JavaScript). Zero PII. Zero server calls after page load. Deterministic, reproducible outputs. Licensed CC BY 4.0.',
      '',
      'OpenChainGraph v0.4 compute-binding nodes additionally run **server-side on the MCP Worker** and emit verifiable artifacts with `execution_hash` (WebCrypto SHA-256 over RFC 8785 canonical JSON).',
    ].join('\n'),
    contact: {
      name: 'Post Oak Labs',
      url: 'https://postoaklabs.com',
      email: 'tim@postoaklabs.com'
    },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/'
    }
  },

  // x-mcp extension — the real transport
  'x-mcp': {
    transport: 'MCP JSON-RPC 2.0 (streamable HTTP)',
    endpoint: 'https://mcp.ainumbers.co/mcp',
    protocol_version: '2024-11-05',
    authentication: 'none',
    registry: 'co.ainumbers/tools (official MCP registry)',
    note: 'Connect any MCP-compatible client (Claude, ChatGPT, custom agent) directly to this endpoint. The REST paths in this file are descriptive only — they do not exist on the live server unless the REST shim is deployed.'
  },

  servers: [
    {
      url: 'https://ainumbers.co',
      description: 'Static browser-based tool host (DreamHost). Tools run client-side — no REST gateway is active on this origin. See x-mcp for the live MCP endpoint.'
    }
  ],

  // Tags derived from unique tool categories
  tags: [...new Set(
    Object.values(paths).flatMap(p => p.post.tags)
  )].sort().map(name => ({ name })),

  paths,

  components: {
    schemas: {
      PolicyMandateV1: {
        type: 'object',
        description: 'AINumbers Policy Mandate v1.0 — output artifact for all ap2_export:true tools. NOT the AP2 v0.2 standard (FIDO Alliance Intent/Cart/Payment Mandates).',
        properties: {
          mandate_id:            { type: 'string', format: 'uuid' },
          issued_at:             { type: 'string', format: 'date-time' },
          issued_by:             { type: 'string', example: 'ainumbers.co' },
          tool_id:               { type: 'string' },
          tool_version:          { type: 'string' },
          mandate_type:          { type: 'string' },
          jurisdiction:          { type: 'array', items: { type: 'string' } },
          regulatory_frameworks: { type: 'array', items: { type: 'string' } },
          payload:               { type: 'object' },
          summary:               { type: 'string' },
          agent_instructions:    { type: 'array', items: { type: 'string' } },
          valid_from:            { type: 'string', format: 'date-time' },
          valid_until:           { type: 'string', format: 'date-time' },
          source_tool_inputs:    { type: 'object' },
          audit_metadata: {
            type: 'object',
            properties: {
              execution_hash:       { type: 'string', description: 'WebCrypto SHA-256 over RFC 8785 canonical JSON of {policy_parameters, output_payload}' },
              client_side_executed: { type: 'boolean' },
              zero_pii_verified:    { type: 'boolean' },
              deterministic_run:    { type: 'boolean' }
            }
          }
        }
      },
      OCGArtifactV04: {
        type: 'object',
        description: 'OpenChainGraph v0.4 artifact envelope — emitted by all ChainGraph nodes. execution_hash is WebCrypto SHA-256 over RFC 8785/JCS canonical {policy_parameters, output_payload}.',
        properties: {
          mandate_id:        { type: 'string', format: 'uuid' },
          tool_id:           { type: 'string' },
          chaingraph_version: { type: 'string', example: '0.4.0' },
          execution_hash:    { type: 'string', description: 'sha256:<hex> — verifiable at https://ainumbers.co/chaingraph/verify.html' },
          chain: {
            type: 'object',
            properties: {
              parent_hashes:   { type: 'array', items: { type: 'string' } },
              parent_tool_ids: { type: 'array', items: { type: 'string' } },
              chain_depth:     { type: 'integer', minimum: 0 }
            }
          },
          policy_parameters: { type: 'object' },
          output_payload:    { type: 'object' },
          compliance_flags:  { type: 'array', items: { type: 'string' } },
          audit_signature:   { type: 'string' }
        }
      }
    }
  }
}

// ── 5. Render outputs in-memory (so --check can diff against disk without writing) ──
const json = JSON.stringify(openapi, null, 2)

const primaryOut = join(repoRoot, 'openapi.json') // DreamHost → ainumbers.co/openapi.json
const docsDir = join(repoRoot, 'docs')
const docsOpenapi = join(docsDir, 'openapi.json') // Cloudflare Pages → docs.ainumbers.co/openapi.json
const catalogSrc  = join(repoRoot, 'mcp', 'catalog.json')
const catalogDest = join(docsDir, 'catalog.json')
const catalogJson = readFileSync(catalogSrc, 'utf8')

const docsIndexPath = join(docsDir, 'index.html')
let docsHtml = existsSync(docsIndexPath) ? readFileSync(docsIndexPath, 'utf8') : null
if (docsHtml !== null) {
  const SENTINEL_RE = /<!--COUNT:([^-]+?)-->(\d+)<!--\/COUNT-->/g
  const DATA_COUNT_RE = /(<[^>]+\bdata-count="([^"]+)"[^>]*>)(\d+)(<\/)/g
  docsHtml = docsHtml.replace(SENTINEL_RE, (match, key, valStr) => {
    const expected = C[key]
    if (expected === undefined) return match
    if (parseInt(valStr, 10) !== expected) return `<!--COUNT:${key}-->${expected}<!--/COUNT-->`
    return match
  })
  docsHtml = docsHtml.replace(DATA_COUNT_RE, (match, openFull, key, valStr, close) => {
    const expected = C[key]
    if (expected === undefined) return match
    if (parseInt(valStr, 10) !== expected) return `${openFull}${expected}${close}`
    return match
  })
}

// ── 6. Write, or diff against disk for --check ──────────────────────────────
if (CHECK) {
  const problems = []
  const readOrNull = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }
  if (readOrNull(primaryOut) !== json) problems.push(`stale: ${primaryOut}`)
  if (readOrNull(docsOpenapi) !== json) problems.push(`stale: ${docsOpenapi}`)
  if (readOrNull(catalogDest) !== catalogJson) problems.push(`stale: ${catalogDest}`)
  if (docsHtml !== null && readOrNull(docsIndexPath) !== docsHtml) problems.push(`stale sentinels: ${docsIndexPath}`)
  if (problems.length) {
    console.error(`gen-openapi --check: ${problems.length} output(s) out of sync with manifests/chaingraph.json:`)
    for (const p of problems) console.error(`  - ${p}`)
    console.error('Run `node scripts/gen-openapi.mjs` to regenerate.')
    process.exit(1)
  }
  console.log(`gen-openapi --check: OK (${toolCount} operations, all outputs fresh).`)
} else {
  writeFileSync(primaryOut, json, 'utf8')
  console.log(`Wrote ${primaryOut}`)

  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true })
  writeFileSync(docsOpenapi, json, 'utf8')
  console.log(`Wrote ${docsOpenapi}`)

  copyFileSync(catalogSrc, catalogDest)
  console.log(`Copied catalog.json → ${catalogDest}`)

  if (docsHtml !== null) {
    const original = readFileSync(docsIndexPath, 'utf8')
    if (docsHtml !== original) { writeFileSync(docsIndexPath, docsHtml, 'utf8'); console.log(`Updated sentinels in ${docsIndexPath}`) }
    else { console.log(`docs/index.html sentinels already current`) }
  }

  console.log(`\nDone. ${toolCount} operations in openapi.json.`)
}
