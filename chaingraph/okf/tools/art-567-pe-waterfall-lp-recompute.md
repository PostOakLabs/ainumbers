---
type: DecisionTool
title: "PE Distribution Waterfall LP-Side Recompute"
description: "Recomputes a standard 4-tier PE distribution waterfall (return of capital, preferred return, GP catch-up, residual carry split) from caller-DECLARED dated contribution/distribution cashflows and a caller-DECLARED waterfall parameterization (pref rate + compounding basis, GP catch-up percentage, carry percentage, European whole-fund or American deal-by-deal tier structure, optional clawback check), then diffs the recomputed per-tier LP/GP allocation against a caller-supplied GP-reported allocation. Verdict MATCHES, DIVERGES with per-tier deltas, or INDETERMINATE whenever a required parameter is absent -- never guessed, never defaulted. ILPA's own reporting-template guidance states it was not designed for verifying any of the GP's calculations, cited here only as dated gap evidence, never as an ILPA endorsement or ILPA-compliance claim. Cross-links recompute_fund_nav (art-373), which recomputes NAV, not distribution waterfalls -- the two do not duplicate each other. Zero network, zero PII, fixed-point BigInt money math throughout."
resource: https://ainumbers.co/chaingraph/art-567-pe-waterfall-lp-recompute.html
tags: ["attestation_mandate", "wave-93", "mcp:recompute_pe_waterfall_lp"]
timestamp: 2026-08-06
generated: { by: "ainumbers/generate-okf", at: "2026-08-06" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-567-pe-waterfall-lp-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-567-pe-waterfall-lp-recompute.html
    title: "public tool page"
---

# PE Distribution Waterfall LP-Side Recompute

> Exports a decision via MCP `recompute_pe_waterfall_lp` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; waterfall verification is a continuous LP-side fund-oversight control, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-567-pe-waterfall-lp-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-567-pe-waterfall-lp-recompute.md) — §10.2.
