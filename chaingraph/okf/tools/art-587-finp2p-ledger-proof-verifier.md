---
type: DecisionTool
title: "FinP2P Ledger Proof Verifier"
description: "Verifies a FinP2P Ledger Proof in Hashlist mode against a caller-supplied secp256k1 public key. Recomputes the FinP2P Hashlist digest (fixed field order, group hash then hash-of-group-hashes, per finp2p-docs.ownera.io) and reports whether it matches the receipt's stated hash, and separately whether the secp256k1 signature over that digest verifies against the supplied key. Zero network calls; the verification key is caller-supplied, never resolved by this tool. Two independently reported results, never fused into one boolean. Makes no claim about ledger finality, settlement, or acceptance. EIP-712 typed-data proofs are out of scope (Hashlist mode only)."
resource: https://ainumbers.co/chaingraph/art-587-finp2p-ledger-proof-verifier.html
tags: ["compliance_mandate", "wave-98", "mcp:verify_finp2p_ledger_proof"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-587-finp2p-ledger-proof-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-587-finp2p-ledger-proof-verifier.html
    title: "public tool page"
---

# FinP2P Ledger Proof Verifier

> Exports a decision via MCP `verify_finp2p_ledger_proof` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-587-finp2p-ledger-proof-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-587-finp2p-ledger-proof-verifier.md) — §10.2.
