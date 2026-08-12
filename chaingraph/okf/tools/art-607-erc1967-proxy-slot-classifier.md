---
type: DecisionTool
title: "ERC-1967 Proxy Slot Classifier"
description: "Recomputes the four canonical EIP-1967 storage slots (bytes32(uint256(keccak256(label)) - 1) for the implementation, admin, beacon, and rollback labels) fresh on every call using the vendored keccak256 bundle already pinned in this repository, then classifies a caller-supplied (declared_slot, storage_value) pair: which of the four roles declared_slot matches, if any, and whether storage_value looks like the zero-padded 20-byte address EIP-1967 expects at that slot (extracting and EIP-55 checksumming the embedded address when it does). Zero network calls: this tool never reads live chain state -- declared_slot and storage_value are both caller-supplied, read by the caller from their own eth_getStorageAt call or a block explorer, and may already be stale by the time they are pasted in. Address/slot-level fact only: renders no upgrade-safety, admin-trustworthiness, or implementation-safety judgment, and a non-standard declared_slot does not itself prove a contract is not a proxy."
resource: https://ainumbers.co/chaingraph/art-607-erc1967-proxy-slot-classifier.html
tags: ["compliance_control", "wave-99", "mcp:classify_erc1967_proxy_slot"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-607-erc1967-proxy-slot-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-607-erc1967-proxy-slot-classifier.html
    title: "public tool page"
---

# ERC-1967 Proxy Slot Classifier

> Exports a decision via MCP `classify_erc1967_proxy_slot` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-607-erc1967-proxy-slot-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-607-erc1967-proxy-slot-classifier.md) — §10.2.
