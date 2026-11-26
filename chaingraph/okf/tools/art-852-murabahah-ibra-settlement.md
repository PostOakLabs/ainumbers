---
type: DecisionTool
title: "Murabahah Ibra' Settlement"
description: "Computes the disclosed instalment schedule of a deferred-price sale (cost plus a mark-up fixed at contract) in integer minor units: each period's profit and principal split, the outstanding cost and selling price, and the deferred (unaccrued) profit. It computes the rebate on early settlement as that deferred profit less permitted recovery costs, the settlement amount with late-payment charges shown separately, the variable-rate case with the per-period rebate between the contracted and prevailing profit bases, and the non-delivery case where the rebate also covers undisbursed principal. A conventional-loan side-by-side is available with compensation and penalty lines kept separate. Outputs are arithmetic and rule checks against the cited regulator paragraphs, not a fatwa, Shariah certification, legal opinion or regulatory approval. Explicitly out of scope: buy-now-pay-later and credit-card rebate treatments, and any cap on late-payment charges (amounts are pass-through only). No personal data is accepted."
resource: https://ainumbers.co/chaingraph/art-852-murabahah-ibra-settlement.html
tags: ["compliance_control", "wave-150", "mcp:compute_murabahah_ibra_settle"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-852-murabahah-ibra-settlement.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-852-murabahah-ibra-settlement.html
    title: "public tool page"
---

# Murabahah Ibra' Settlement

> Exports a decision via MCP `compute_murabahah_ibra_settle` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-852-murabahah-ibra-settlement.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-852-murabahah-ibra-settlement.md) — §10.2.
