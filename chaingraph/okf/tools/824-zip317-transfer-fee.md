---
type: DecisionTool
title: "ZIP-317 Transfer Fee"
description: "Recomputes the conventional transfer fee for a Zcash transaction from a DECLARED shape the caller pastes -- counts and byte totals only, never keys and never raw transactions: the transparent contribution is the greater of ceil(tx_in_total_size/150) and ceil(tx_out_total_size/34), Sprout contributes twice the JoinSplit count, Sapling contributes the greater of spends and outputs, Orchard contributes its action count, and the fee is 5000 zatoshi per logical action floored by the two-action grace window, exactly as the pinned fee-rule text defines. Integer arithmetic only, zero network; no key material is read or required (no viewing key, no spending key); a string in a declared numeric field is refused and never echoed. Honest label: this computes the fee the published rule yields for the declared shape; it is not a statement about what any wallet or node will accept at a given time, and it is not coin marketing. Declared exclusions: draft-revision contributions (added action pools, memo bundles) are refused rather than guessed; negative, fractional, or out-of-range counts and sizes are refused."
resource: https://ainumbers.co/chaingraph/824-zip317-transfer-fee.html
tags: ["compliance_control", "wave-142", "mcp:recompute_zip317_transfer_fee"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/824-zip317-transfer-fee.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/824-zip317-transfer-fee.html
    title: "public tool page"
---

# ZIP-317 Transfer Fee

> Exports a decision via MCP `recompute_zip317_transfer_fee` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/824-zip317-transfer-fee.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/824-zip317-transfer-fee.md) — §10.2.
