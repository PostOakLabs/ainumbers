#!/usr/bin/env node
/**
 * scripts/cre-signerset-snapshot.mjs — CRE-SIGNERSET-1
 *
 * One-shot tool: reads the Chainlink Capability Registry (`CapabilitiesRegistry`,
 * `smartcontractkit/chainlink-evm` contracts/cre/src/v2/CapabilitiesRegistry.sol,
 * MIT-licensed contract source — no `@chainlink/cre-sdk` code touched, per
 * `CRE-VERIFY-SCOPE-1`'s BUSL-1.1 finding) for a named DON's authorized signer
 * set and writes it as a dated, versioned, offline-verifiable JSON artifact.
 *
 * ⛔⛔ THE TOOL FETCHES; THE ARTIFACT IS WHAT SHIPS. A downstream verifier
 * (e.g. the future `CRE-NODE-1` OCG node) reads the pinned artifact this
 * script writes — it MUST NOT call the network itself. Only this tool, run
 * manually/out-of-band, touches the chain. This keeps the zero-network
 * guarantee for every shipped browser tool and OCG node intact (CONTRACT.md
 * "Zero network calls" applies to shipped tools/kernels, not to this
 * operator-run snapshotting utility).
 *
 * ⚠ WHAT A SNAPSHOT DOES NOT PROVE: that the signer set is CURRENT. A DON can
 * rotate signing keys via routine OCR/OCR3 config updates at any time after
 * this snapshot was taken. This artifact proves the signer set as of a
 * specific block, nothing more. `rePinBy` is the date past which a verifier
 * MUST refuse to trust this artifact rather than silently keep using it
 * (the staleness refusal itself is `CRE-NODE-1`'s job — this tool only
 * carries the date that makes such a refusal possible).
 *
 * Zero npm dependency (CONTRACT.md — site repo is zero-dep, forever). Uses
 * only Node built-ins: global fetch (Node >= 18), node:fs, node:path.
 *
 * ABI function selectors below are 4-byte keccak256 hashes of the function
 * signature, computed offline (not at runtime — no keccak implementation
 * ships in this file) and cross-checked two ways: (1) independently
 * hand-verified against known Ethereum test vectors (keccak256("") and the
 * universally-known ERC-20 `transfer(address,uint256)` selector 0xa9059cbb),
 * and (2) confirmed present as a JUMPDEST dispatch target in the deployed
 * WorkflowRegistry bytecode at 0x4Ac54353FA4Fa961AfcC5ec4B118596d3305E7e5 on
 * Ethereum Mainnet (`eth_getCode` via ethereum-rpc.publicnode.com,
 * 2026-08-06) for `getCapabilitiesRegistry()`.
 *
 * Usage:
 *   node scripts/cre-signerset-snapshot.mjs \
 *     --don-name "<name>" \
 *     --registry-address 0x... \
 *     --rpc-url https://... \
 *     [--repin-days 30] [--out path/to/file.json]
 *
 *   node scripts/cre-signerset-snapshot.mjs --discover-registry \
 *     --workflow-registry-address 0x4Ac54353FA4Fa961AfcC5ec4B118596d3305E7e5 \
 *     --rpc-url https://...
 *   (Helper only — reads WorkflowRegistry.getCapabilitiesRegistry(). As of
 *   2026-08-06 this returns the zero address on Ethereum Mainnet: the public
 *   WorkflowRegistry has not been pointed at a CapabilitiesRegistry yet. The
 *   caller MUST supply --registry-address explicitly for a real snapshot;
 *   this repo does not hardcode a guessed registry address.)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── ABI selectors (see header comment for how these were derived/verified) ──
export const SELECTORS = {
  getDONByName: '0x59110666', // getDONByName(string)
  getNodesByP2PIds: '0x05a51966', // getNodesByP2PIds(bytes32[])
  getCapabilitiesRegistry: '0x865ec9e0', // getCapabilitiesRegistry() -- on WorkflowRegistry, not CapabilitiesRegistry itself
}

// ── low-level ABI helpers (hand-written, targeted at the two return shapes
//    this tool needs -- NOT a general-purpose ABI codec) ──────────────────

function stripHex(hex) {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
}

/** Reads the 32-byte word at byte offset `byteOffset` from a hex string (no 0x prefix). */
function wordAt(dataHex, byteOffset) {
  const start = byteOffset * 2
  return dataHex.slice(start, start + 64).padEnd(64, '0')
}

function wordToUint(wordHex) {
  return Number(BigInt('0x' + wordHex))
}

function wordToBool(wordHex) {
  return wordToUint(wordHex) !== 0
}

/** Right-pads a UTF-8 string's bytes to a 32-byte boundary, ABI-style. */
function encodeStringArg(str) {
  const bytes = Buffer.from(str, 'utf8')
  const lenWord = bytes.length.toString(16).padStart(64, '0')
  const paddedLen = Math.ceil(bytes.length / 32) * 32 || 32
  const dataHex = bytes.toString('hex').padEnd(paddedLen * 2, '0')
  return lenWord + dataHex
}

/** Encodes calldata for getDONByName(string donName). */
export function encodeGetDONByName(donName) {
  const offsetWord = (32).toString(16).padStart(64, '0')
  return SELECTORS.getDONByName + offsetWord + encodeStringArg(donName)
}

/** Encodes calldata for getNodesByP2PIds(bytes32[] p2pIds). p2pIds are 0x-prefixed 32-byte hex strings. */
export function encodeGetNodesByP2PIds(p2pIds) {
  const offsetWord = (32).toString(16).padStart(64, '0')
  const lenWord = p2pIds.length.toString(16).padStart(64, '0')
  const elements = p2pIds.map((id) => stripHex(id).padStart(64, '0')).join('')
  return SELECTORS.getNodesByP2PIds + offsetWord + lenWord + elements
}

/** Encodes calldata for getCapabilitiesRegistry() -- no arguments. */
export function encodeGetCapabilitiesRegistry() {
  return SELECTORS.getCapabilitiesRegistry
}

/**
 * Decodes a `DONInfo` struct return from getDONByName / getDON.
 * Field order per CapabilitiesRegistry.sol `struct DONInfo` (chainlink-evm,
 * contracts/cre/src/v2/CapabilitiesRegistry.sol):
 *   uint32 id; uint32 configCount; uint8 f; bool isPublic; bool acceptsWorkflows;
 *   bytes32[] nodeP2PIds; string[] donFamilies; string name; bytes config;
 *   CapabilityConfiguration[] capabilityConfigurations;
 * This decoder only extracts the fields this tool needs (id/configCount/f/
 * isPublic/acceptsWorkflows/nodeP2PIds/name) -- donFamilies/config/
 * capabilityConfigurations are left undecoded (out of scope: a signer-set
 * snapshot does not need them).
 */
export function decodeDONInfo(returnDataHex) {
  const data = stripHex(returnDataHex)
  const tupleStart = wordToUint(wordAt(data, 0)) // top-level offset, normally 0x20
  const id = wordToUint(wordAt(data, tupleStart + 0))
  const configCount = wordToUint(wordAt(data, tupleStart + 32))
  const f = wordToUint(wordAt(data, tupleStart + 64))
  const isPublic = wordToBool(wordAt(data, tupleStart + 96))
  const acceptsWorkflows = wordToBool(wordAt(data, tupleStart + 128))
  const nodeP2PIdsOffsetRel = wordToUint(wordAt(data, tupleStart + 160))
  const nameOffsetRel = wordToUint(wordAt(data, tupleStart + 224))

  const nodeP2PIdsAbs = tupleStart + nodeP2PIdsOffsetRel
  const nodeCount = wordToUint(wordAt(data, nodeP2PIdsAbs))
  const nodeP2PIds = []
  for (let i = 0; i < nodeCount; i++) {
    nodeP2PIds.push('0x' + wordAt(data, nodeP2PIdsAbs + 32 + i * 32))
  }

  const nameAbs = tupleStart + nameOffsetRel
  const nameLen = wordToUint(wordAt(data, nameAbs))
  const nameHex = data.slice((nameAbs + 32) * 2, (nameAbs + 32) * 2 + nameLen * 2)
  const name = Buffer.from(nameHex, 'hex').toString('utf8')

  return { id, configCount, f, isPublic, acceptsWorkflows, nodeP2PIds, name }
}

/**
 * Decodes a `NodeInfo[]` return from getNodesByP2PIds.
 * Field order per INodeInfoProvider.sol `struct NodeInfo`:
 *   uint32 nodeOperatorId; uint32 configCount; uint32 workflowDONId;
 *   bytes32 signer; bytes32 p2pId; bytes32 encryptionPublicKey; bytes32 csaKey;
 *   string[] capabilityIds; uint256[] capabilitiesDONIds;
 * `signer` is documented as "the ABI encoded version of the node's address,
 * i.e. 0x0000...address" -- so the address is the low 20 bytes of the word.
 * Only signer + p2pId are extracted (this tool's scope is the signer set);
 * capabilityIds/capabilitiesDONIds are left undecoded.
 */
export function decodeNodeInfoArray(returnDataHex) {
  const data = stripHex(returnDataHex)
  const arrayStart = wordToUint(wordAt(data, 0))
  const len = wordToUint(wordAt(data, arrayStart))
  const elementsStart = arrayStart + 32

  const nodes = []
  for (let i = 0; i < len; i++) {
    const elemOffsetRel = wordToUint(wordAt(data, elementsStart + i * 32))
    const elemAbs = elementsStart + elemOffsetRel
    const nodeOperatorId = wordToUint(wordAt(data, elemAbs + 0))
    const configCount = wordToUint(wordAt(data, elemAbs + 32))
    const workflowDONId = wordToUint(wordAt(data, elemAbs + 64))
    const signerWord = wordAt(data, elemAbs + 96)
    const p2pId = '0x' + wordAt(data, elemAbs + 128)
    const signerAddress = '0x' + signerWord.slice(-40)
    nodes.push({ p2pId, signer: signerAddress, nodeOperatorId, configCount, workflowDONId })
  }
  return nodes
}

/** Decodes getCapabilitiesRegistry() -> (address registry, uint64 chainSelector). */
export function decodeCapabilitiesRegistryPointer(returnDataHex) {
  const data = stripHex(returnDataHex)
  const registry = '0x' + wordAt(data, 0).slice(-40)
  const chainSelector = wordToUint(wordAt(data, 32))
  return { registry, chainSelector }
}

// ── JSON-RPC eth_call ────────────────────────────────────────────────────

async function ethCall(rpcUrl, to, data) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`eth_call to ${to} failed: ${JSON.stringify(json.error)}`)
  return json.result
}

async function getBlockNumber(rpcUrl) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`eth_blockNumber failed: ${JSON.stringify(json.error)}`)
  return Number(BigInt(json.result))
}

// ── artifact assembly ────────────────────────────────────────────────────

export function buildArtifact({ donInfo, nodes, registryAddress, chainId, blockNumber, rePinDays, fetchedAt }) {
  const fetched = fetchedAt ?? new Date()
  const rePinBy = new Date(fetched.getTime() + rePinDays * 24 * 60 * 60 * 1000)
  const signers = nodes.map((n) => ({ p2pId: n.p2pId, signer: n.signer }))
  return {
    artifact: 'cre-don-signer-snapshot',
    version: 1,
    don: {
      name: donInfo.name,
      id: donInfo.id,
      configCount: donInfo.configCount,
      f: donInfo.f,
      isPublic: donInfo.isPublic,
      acceptsWorkflows: donInfo.acceptsWorkflows,
    },
    chain: {
      chainId,
      registryAddress,
      blockNumber,
    },
    fetchedAt: fetched.toISOString(),
    rePinBy: rePinBy.toISOString(),
    quorum: {
      totalNodes: signers.length,
      f: donInfo.f,
      minSignaturesRequired: donInfo.f + 1,
    },
    signers,
    provenance: {
      source: 'CapabilitiesRegistry.getDONByName(name) + getNodesByP2PIds(nodeP2PIds) (Ethereum eth_call, MIT-licensed contract ABI, no @chainlink/cre-sdk code read or vendored)',
      selectorsUsed: { getDONByName: SELECTORS.getDONByName, getNodesByP2PIds: SELECTORS.getNodesByP2PIds },
    },
    doesNotProve:
      'This snapshot proves the DON signer set as of chain.blockNumber, nothing more. It does NOT prove the set is CURRENT: DON operators can rotate signing keys via routine OCR/OCR3 config updates at any time after this snapshot. A verifier MUST refuse to trust this artifact past rePinBy rather than silently keep using it (staleness refusal is CRE-NODE-1 scope; this artifact only carries the date that makes such a refusal possible).',
    consumerBoundary:
      'Consumers of this artifact (e.g. an OCG report-verification node) MUST read this JSON file directly and MUST NOT call the network themselves -- CONTRACT.md requires shipped tools/kernels to make zero network calls. Only this snapshot tool, run manually/out-of-band by an operator, is permitted to touch the chain.',
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        args[key] = true
      } else {
        args[key] = next
        i++
      }
    }
  }
  return args
}

async function discoverRegistry(args) {
  const wfRegistry = args['workflow-registry-address']
  const rpcUrl = args['rpc-url']
  if (!wfRegistry || !rpcUrl) {
    console.error('--discover-registry requires --workflow-registry-address and --rpc-url')
    process.exit(1)
  }
  const result = await ethCall(rpcUrl, wfRegistry, encodeGetCapabilitiesRegistry())
  const { registry, chainSelector } = decodeCapabilitiesRegistryPointer(result)
  console.log(JSON.stringify({ registry, chainSelector }, null, 2))
  if (registry === '0x0000000000000000000000000000000000000000') {
    console.error(
      '\nWARNING: WorkflowRegistry.getCapabilitiesRegistry() returned the zero address -- this WorkflowRegistry has no CapabilitiesRegistry pointer set. You must supply --registry-address explicitly and verify it independently; this tool does not hardcode a guessed registry address.'
    )
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args['discover-registry']) {
    await discoverRegistry(args)
    return
  }

  const donName = args['don-name']
  const registryAddress = args['registry-address']
  const rpcUrl = args['rpc-url']
  const chainId = args['chain-id'] ? Number(args['chain-id']) : 1
  const rePinDays = args['repin-days'] ? Number(args['repin-days']) : 30

  if (!donName || !registryAddress || !rpcUrl) {
    console.error('Usage: node scripts/cre-signerset-snapshot.mjs --don-name <name> --registry-address 0x... --rpc-url <url> [--repin-days 30] [--out path.json]')
    process.exit(1)
  }

  const donResult = await ethCall(rpcUrl, registryAddress, encodeGetDONByName(donName))
  const donInfo = decodeDONInfo(donResult)
  if (donInfo.nodeP2PIds.length === 0) {
    console.error(`DON "${donName}" not found or has no member nodes at registry ${registryAddress}`)
    process.exit(1)
  }

  const nodesResult = await ethCall(rpcUrl, registryAddress, encodeGetNodesByP2PIds(donInfo.nodeP2PIds))
  const nodes = decodeNodeInfoArray(nodesResult)
  const blockNumber = await getBlockNumber(rpcUrl)

  const artifact = buildArtifact({ donInfo, nodes, registryAddress, chainId, blockNumber, rePinDays })

  const outPath = args.out || `scripts/cre-signer-snapshots/${donName.replace(/[^a-zA-Z0-9._-]/g, '_')}-${artifact.fetchedAt.slice(0, 10)}.json`
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n')
  console.log(`Wrote ${outPath}`)
  console.log(`DON "${donInfo.name}": ${nodes.length} signers, f=${donInfo.f}, re-pin by ${artifact.rePinBy}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.stack || err.message)
    process.exit(1)
  })
}
