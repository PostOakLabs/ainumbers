---
type: DecisionTool
title: "EIP-7702 Authorization-Tuple Decoder"
description: "Recomputes the EIP-7702 authorization-tuple hash (keccak256(0x05 || rlp([chain_id, address, nonce])), the 'Set EOA account code' standard live on Ethereum mainnet since the Pectra upgrade, 2025-05-07), recovers the ECDSA signer from a caller-supplied signature, and reports the address the recovered signer is authorizing as its delegate. The tuple's own address field IS the delegate: the code the EOA is pointing itself at. This node stops at that address -- it never inspects, fetches, or judges the delegate contract's bytecode, and makes no safe/unsafe verdict about it. chain_id = 0 is EIP-7702-defined as a valid, deliberate cross-chain authorization (replayable on any chain) and is reported as such, never treated as malformed input. RLP encoding is hand-authored public-spec arithmetic (Ethereum Yellow Paper Appendix B); keccak256 and secp256k1 recovery come from the already-vendored, pinned noble-curves bundle, no new vendoring. Zero network calls: does not confirm the authorization was ever submitted on-chain, does not confirm the EOA's account nonce matches the declared nonce at any block, and makes no settlement claim."
resource: https://ainumbers.co/chaingraph/art-614-eip7702-authorization-tuple-decoder.html
tags: ["compliance_control", "wave-99", "mcp:decode_eip7702_authorization_tuple"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-614-eip7702-authorization-tuple-decoder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-614-eip7702-authorization-tuple-decoder.html
    title: "public tool page"
---

# EIP-7702 Authorization-Tuple Decoder

> Exports a decision via MCP `decode_eip7702_authorization_tuple` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-614-eip7702-authorization-tuple-decoder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-614-eip7702-authorization-tuple-decoder.md) — §10.2.
