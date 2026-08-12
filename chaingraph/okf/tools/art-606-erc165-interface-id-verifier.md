---
type: DecisionTool
title: "ERC-165 Interface ID Verifier"
description: "Recomputes an ERC-165 interfaceId as the XOR of 4-byte function selectors (the first 4 bytes of keccak256 of each canonical Solidity signature) over a caller-declared list of function signatures, using the vendored keccak256 bundle already pinned in this repository. Zero network calls: this tool never queries a live contract's supportsInterface(bytes4) and makes no claim about what any deployed contract actually returns. Compares the recomputed id against an optional claimed_interface_id and flags a match against seven well-known standard ids (ERC-165 itself, ERC-721 core/Metadata/Enumerable, ERC-1155 core/MetadataURI, ERC-2981) purely as a courtesy label, never as verification. Malformed signature entries are excluded from the XOR and reported separately rather than silently dropped. A CONSISTENT match only establishes that the declared function list hashes to that value -- never that the list is complete, correct, or actually implemented anywhere."
resource: https://ainumbers.co/chaingraph/art-606-erc165-interface-id-verifier.html
tags: ["compliance_control", "wave-99", "mcp:verify_erc165_interface_id"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-606-erc165-interface-id-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-606-erc165-interface-id-verifier.html
    title: "public tool page"
---

# ERC-165 Interface ID Verifier

> Exports a decision via MCP `verify_erc165_interface_id` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-606-erc165-interface-id-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-606-erc165-interface-id-verifier.md) — §10.2.
