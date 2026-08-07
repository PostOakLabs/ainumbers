#!/usr/bin/env node
/**
 * scripts/cre-signerset-snapshot.test.mjs — fixture proof for CRE-SIGNERSET-1.
 *
 * The fixtures below are hand-assembled ABI-encoded return-data hex strings,
 * laid out word-by-word from the real `DONInfo` / `NodeInfo` struct field
 * order in CapabilitiesRegistry.sol / INodeInfoProvider.sol (see the header
 * comment in cre-signerset-snapshot.mjs for the source). They are built with
 * a standalone word-encoding helper in this file, NOT by round-tripping the
 * module's own encode* functions -- a decoder tested only against its own
 * encoder can share the same wrong assumption and still "pass".
 *
 * Usage: node scripts/cre-signerset-snapshot.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */

import {
  encodeGetDONByName,
  encodeGetNodesByP2PIds,
  encodeGetCapabilitiesRegistry,
  decodeDONInfo,
  decodeNodeInfoArray,
  decodeCapabilitiesRegistryPointer,
  buildArtifact,
  SELECTORS,
} from './cre-signerset-snapshot.mjs'

let failures = 0
function assert(cond, msg) {
  if (!cond) {
    failures++
    console.log(`✗ ${msg}`)
  } else {
    console.log(`✓ ${msg}`)
  }
}

// ── standalone hex-word builder (independent of the module under test) ────
function uintWord(n) {
  return n.toString(16).padStart(64, '0')
}
function rawWord(hex64) {
  return hex64.padEnd(64, '0').slice(0, 64)
}
function bytesWord(hexStr) {
  return hexStr.padEnd(64, '0')
}

// ═══════════════════════════════════════════════════════════════════════
// Fixture 1: decodeDONInfo against a hand-assembled DONInfo tuple
// ═══════════════════════════════════════════════════════════════════════
// DONInfo field order: id, configCount, f, isPublic, acceptsWorkflows,
// nodeP2PIds[], donFamilies[], name, config, capabilityConfigurations[]
{
  const p2p1 = '11'.repeat(32)
  const p2p2 = '22'.repeat(32)
  const nameHex = Buffer.from('test-don', 'utf8').toString('hex') // 8 bytes

  // tuple head = 10 words = 320 (0x140) bytes
  const nodeP2PIdsRelOffset = 0x140 // right after the 10-word head
  const nodeP2PIdsBlock = uintWord(2) + rawWord(p2p1) + rawWord(p2p2) // len(1w) + 2 elements(2w) = 96 bytes (0x60)

  const donFamiliesRelOffset = nodeP2PIdsRelOffset + 0x60
  const donFamiliesBlock = uintWord(0) // empty array

  const nameRelOffset = donFamiliesRelOffset + 0x20
  const nameBlock = uintWord(8) + bytesWord(nameHex) // len word + 1 padded word

  const configRelOffset = nameRelOffset + 0x40
  const configBlock = uintWord(0) // empty bytes

  const capConfigsRelOffset = configRelOffset + 0x20
  const capConfigsBlock = uintWord(0) // empty array

  const tupleHead =
    uintWord(7) + // id
    uintWord(3) + // configCount
    uintWord(1) + // f
    uintWord(1) + // isPublic = true
    uintWord(1) + // acceptsWorkflows = true
    uintWord(nodeP2PIdsRelOffset) +
    uintWord(donFamiliesRelOffset) +
    uintWord(nameRelOffset) +
    uintWord(configRelOffset) +
    uintWord(capConfigsRelOffset)

  const data = '0x' + uintWord(0x20) + tupleHead + nodeP2PIdsBlock + donFamiliesBlock + nameBlock + configBlock + capConfigsBlock

  const decoded = decodeDONInfo(data)
  assert(decoded.id === 7, 'decodeDONInfo reads id from the correct word')
  assert(decoded.configCount === 3, 'decodeDONInfo reads configCount')
  assert(decoded.f === 1, 'decodeDONInfo reads f')
  assert(decoded.isPublic === true, 'decodeDONInfo reads isPublic')
  assert(decoded.acceptsWorkflows === true, 'decodeDONInfo reads acceptsWorkflows')
  assert(decoded.name === 'test-don', 'decodeDONInfo decodes the dynamic name string correctly')
  assert(decoded.nodeP2PIds.length === 2, 'decodeDONInfo reads the correct nodeP2PIds length')
  assert(decoded.nodeP2PIds[0] === '0x' + p2p1 && decoded.nodeP2PIds[1] === '0x' + p2p2, 'decodeDONInfo reads both nodeP2PIds values byte-exact')
}

// ═══════════════════════════════════════════════════════════════════════
// Fixture 2: decodeNodeInfoArray against a hand-assembled NodeInfo[] return
// ═══════════════════════════════════════════════════════════════════════
// NodeInfo field order: nodeOperatorId, configCount, workflowDONId, signer,
// p2pId, encryptionPublicKey, csaKey, capabilityIds[], capabilitiesDONIds[]
{
  const signerAddr = 'aBcD'.repeat(10) // 20 bytes = 40 hex chars (arbitrary but fixed)
  const signerWord = '00'.repeat(12) + signerAddr // ABI-encoded address: 12 zero bytes + 20 address bytes
  const p2pId = '33'.repeat(32)
  const encKey = '44'.repeat(32)
  const csaKey = '55'.repeat(32)

  // element tuple head = 9 words = 288 (0x120) bytes
  const capabilityIdsRelOffset = 0x120
  const capabilityIdsBlock = uintWord(0) // empty string[]
  const capabilitiesDONIdsRelOffset = capabilityIdsRelOffset + 0x20
  const capabilitiesDONIdsBlock = uintWord(0) // empty uint256[]

  const elemTupleHead =
    uintWord(11) + // nodeOperatorId
    uintWord(1) + // configCount
    uintWord(0) + // workflowDONId
    rawWord(signerWord) + // signer
    rawWord(p2pId) + // p2pId
    rawWord(encKey) + // encryptionPublicKey
    rawWord(csaKey) + // csaKey
    uintWord(capabilityIdsRelOffset) +
    uintWord(capabilitiesDONIdsRelOffset)

  const elemBlock = elemTupleHead + capabilityIdsBlock + capabilitiesDONIdsBlock

  // array of 1 dynamic tuple: outer offset(0x20) -> len(1) -> [elemOffsetRel(0x20)] -> elemBlock
  const data = '0x' + uintWord(0x20) + uintWord(1) + uintWord(0x20) + elemBlock

  const nodes = decodeNodeInfoArray(data)
  assert(nodes.length === 1, 'decodeNodeInfoArray reads the correct element count')
  assert(nodes[0].p2pId === '0x' + p2pId, 'decodeNodeInfoArray reads p2pId byte-exact')
  assert(nodes[0].signer.toLowerCase() === ('0x' + signerAddr).toLowerCase(), 'decodeNodeInfoArray extracts the low-20-byte address from the signer word')
  assert(nodes[0].nodeOperatorId === 11, 'decodeNodeInfoArray reads nodeOperatorId')
}

// ═══════════════════════════════════════════════════════════════════════
// Fixture 3: decodeCapabilitiesRegistryPointer -- the zero-address case
// measured live against WorkflowRegistry 0x4Ac54353FA4Fa961AfcC5ec4B118596d3305E7e5
// on Ethereum Mainnet, 2026-08-06 (eth_call returned 64 zero bytes)
// ═══════════════════════════════════════════════════════════════════════
{
  const data = '0x' + uintWord(0) + uintWord(0)
  const decoded = decodeCapabilitiesRegistryPointer(data)
  assert(decoded.registry === '0x0000000000000000000000000000000000000000', 'decodeCapabilitiesRegistryPointer decodes the zero-address case correctly')
  assert(decoded.chainSelector === 0, 'decodeCapabilitiesRegistryPointer decodes a zero chainSelector')
}

// ═══════════════════════════════════════════════════════════════════════
// Fixture 4: selectors are the literal 4-byte prefix of the calldata this
// tool emits (encoder self-consistency -- selectors themselves are verified
// against known keccak256 test vectors + on-chain bytecode presence, see
// the header comment in the module under test).
// ═══════════════════════════════════════════════════════════════════════
{
  assert(encodeGetDONByName('x').startsWith(SELECTORS.getDONByName), 'encodeGetDONByName calldata starts with the getDONByName selector')
  assert(encodeGetNodesByP2PIds(['0x' + '00'.repeat(32)]).startsWith(SELECTORS.getNodesByP2PIds), 'encodeGetNodesByP2PIds calldata starts with the getNodesByP2PIds selector')
  assert(encodeGetCapabilitiesRegistry() === SELECTORS.getCapabilitiesRegistry, 'encodeGetCapabilitiesRegistry calldata is exactly the selector (no args)')
}

// ═══════════════════════════════════════════════════════════════════════
// Fixture 5: buildArtifact shape -- carries the honesty fields the WU requires
// ═══════════════════════════════════════════════════════════════════════
{
  const donInfo = { name: 'test-don', id: 7, configCount: 3, f: 1, isPublic: true, acceptsWorkflows: true, nodeP2PIds: [] }
  const nodes = [
    { p2pId: '0x' + '11'.repeat(32), signer: '0x' + 'aa'.repeat(20) },
    { p2pId: '0x' + '22'.repeat(32), signer: '0x' + 'bb'.repeat(20) },
  ]
  const fetchedAt = new Date('2026-08-06T00:00:00.000Z')
  const artifact = buildArtifact({ donInfo, nodes, registryAddress: '0xREGISTRY', chainId: 1, blockNumber: 12345, rePinDays: 30, fetchedAt })

  assert(artifact.version === 1, 'artifact carries a version field')
  assert(artifact.fetchedAt === '2026-08-06T00:00:00.000Z', 'artifact carries the dated fetchedAt field')
  assert(artifact.rePinBy === '2026-09-05T00:00:00.000Z', 'artifact computes rePinBy as fetchedAt + rePinDays')
  assert(artifact.signers.length === 2, 'artifact signer list matches decoded node count')
  assert(typeof artifact.doesNotProve === 'string' && /does not prove/i.test(artifact.doesNotProve) && /rotate/i.test(artifact.doesNotProve), 'artifact states plainly what the snapshot does not prove (staleness)')
  assert(typeof artifact.consumerBoundary === 'string' && /must not call the network/i.test(artifact.consumerBoundary), 'artifact documents the fetch/consume boundary for downstream verifiers')
  assert(artifact.quorum.minSignaturesRequired === donInfo.f + 1, 'artifact quorum.minSignaturesRequired is f+1')
}

if (failures > 0) {
  console.log(`\n❌ ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n✅ all fixture assertions passed')
