---
type: DecisionTool
title: "x402 EIP-712 Digest Recomputer"
description: "Recomputes the EIP-712 typed-data digest for an EIP-3009 TransferWithAuthorization struct (the x402 payments rail's underlying authorization primitive) from caller-supplied domain and struct fields only: domain separator, struct hash, and the final keccak256(0x19 || 0x01 || domainSeparator || structHash) digest. All four EIP-712 domain fields (name, version, chainId, verifyingContract) are mandatory inputs and are never defaulted or guessed -- a guessed verifyingContract would defeat the entire point of domain separation. keccak256 comes from the already-vendored, pinned noble-curves/noble-hashes bundle (no new vendoring); the EIP-712/EIP-3009 ABI encoding scheme is implemented directly as public-spec arithmetic on top of it. This node performs no signature recovery and no domain/nonce/window checks -- it makes no claim about signature validity, on-chain settlement, or spend. Zero network calls; never a facilitator, proxy, or settlement relay. Golden vectors are cross-checked against externally published references (the EIP-712 spec's own domain-separator worked example, and Circle's production TransferWithAuthorization typehash), not round-trip self-tests alone."
resource: https://ainumbers.co/chaingraph/art-590-x402-eip712-digest-recomputer.html
tags: ["compliance_control", "wave-99", "mcp:recompute_x402_eip712_digest"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-590-x402-eip712-digest-recomputer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-590-x402-eip712-digest-recomputer.html
    title: "public tool page"
---

# x402 EIP-712 Digest Recomputer

> Exports a decision via MCP `recompute_x402_eip712_digest` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-590-x402-eip712-digest-recomputer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-590-x402-eip712-digest-recomputer.md) — §10.2.
