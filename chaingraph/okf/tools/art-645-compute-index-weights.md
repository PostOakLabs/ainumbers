---
type: DecisionTool
title: "Compute Index Weights"
description: "Computes (or receipts an externally-declared) weight per constituent from a stated methodology (market-cap, float-adjusted-market-cap, equal-weight, price-weight, or factor-tilted) and caller-supplied inputs, giving the weight set its own citable execution_hash separate from the constituent-membership fact in art-557. HARD FENCE: every input row (market_cap/price/float_factor/factor_score) is supplied and asserted, never fetched (zero-egress); this attests THAT a weight set was computed exactly as stated from the declared inputs, never whether those inputs are accurate. weight_sum_check is a hard local check (sum of weights within 1e-9 of 1.0), not a re-fetch. constituents_ref is optional and backward-compatible: a caller with no art-557 artifact yet still gets a valid weighting receipt over its declared constituent list. Second entry of the Financial Index/Benchmark Administrator Lineage family. Not fund NAV recomputation (art-373) or any benchmark-publisher scorecard. EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1) and SEBI (Index Providers) Regulations, 2024 Reg 18(1)/18(3) citations informative only."
resource: https://ainumbers.co/chaingraph/art-645-compute-index-weights.html
tags: ["attestation_mandate", "wave-104", "mcp:compute_index_weights"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-645-compute-index-weights.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-645-compute-index-weights.html
    title: "public tool page"
---

# Compute Index Weights

> Exports a decision via MCP `compute_index_weights` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-645-compute-index-weights.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-645-compute-index-weights.md) — §10.2.
