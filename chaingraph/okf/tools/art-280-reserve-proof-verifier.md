---
type: DecisionTool
title: "Reserve Proof Verifier"
description: "Verifies a Merkle-sum Proof-of-Reserves customer-inclusion proof (OKX, Binance, Gate, Kraken export formats, or a generic canonical shape) against a declared root, and checks a Chainlink PoR / NAVLink aggregator round for staleness and deviation. Part of the Reserve Verification Family alongside check_genius_reserve_disclosure (art-275). Composes with verify_eth_state_proof (VR-1) when an on-chain storage proof is available. Records what is NOT proven: liabilities completeness, off-balance-sheet encumbrances, and point-in-time-only scope. Not a PCAOB audit."
resource: https://ainumbers.co/chaingraph/art-280-reserve-proof-verifier.html
tags: ["compliance_mandate", "wave-49", "mcp:verify_reserve_proof"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-280-reserve-proof-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-280-reserve-proof-verifier.html
    title: "public tool page"
---

# Reserve Proof Verifier

> Exports a decision via MCP `verify_reserve_proof` — mandate type `compliance_mandate`.

**Context:** Voluntary attestation practice (Merkle-sum PoR + Chainlink PoR/NAVLink); no statutory deadline. Distinct from the GENIUS Act S.394 §4 monthly filing deadline tracked by art-275.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-280-reserve-proof-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-280-reserve-proof-verifier.md) — §10.2.
