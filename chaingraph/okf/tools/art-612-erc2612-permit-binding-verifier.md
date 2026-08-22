---
type: DecisionTool
title: "ERC-2612 Permit Binding Verifier"
description: "Recomputes the EIP-712 typed-data digest for an ERC-2612 Permit struct (the gasless-approval rail used by USDC/DAI-style tokens) from caller-supplied domain and message fields, recovers the ECDSA signer from a caller-supplied signature, and reports whether the recovered signer binds to the caller-claimed owner or names the diverging field. All four EIP-712 domain fields (name, version, chainId, verifyingContract) are mandatory inputs and are never defaulted or guessed -- a guessed verifyingContract would defeat domain separation. keccak256 and secp256k1 recovery come from the already-vendored, pinned noble-curves/noble-hashes bundle shared with the sibling art-590/art-591 x402 pair (no new vendoring); the EIP-712/ERC-2612 ABI encoding scheme is implemented directly as public-spec arithmetic on top of it. This node makes no claim about on-chain nonce freshness, current allowance state, or whether deadline has passed relative to now -- it states plainly what it never fetched. Zero network calls; never a facilitator, proxy, or settlement relay. Golden vectors are cross-checked against an independently re-implemented EIP-712 encoding path and real secp256k1 signatures, not round-trip self-tests alone."
resource: https://ainumbers.co/chaingraph/art-612-erc2612-permit-binding-verifier.html
tags: ["compliance_control", "wave-99", "mcp:verify_erc2612_permit_binding"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-612-erc2612-permit-binding-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-612-erc2612-permit-binding-verifier.html
    title: "public tool page"
---

# ERC-2612 Permit Binding Verifier

> Exports a decision via MCP `verify_erc2612_permit_binding` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-612-erc2612-permit-binding-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-612-erc2612-permit-binding-verifier.md) — §10.2.
