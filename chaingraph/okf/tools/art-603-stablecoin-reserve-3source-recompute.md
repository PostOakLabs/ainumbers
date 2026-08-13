---
type: DecisionTool
title: "Stablecoin Reserve 3-Source Recompute"
description: "Recomputes reserve ratio, weighted-average maturity (WAM), and per-holding GENIUS eligible-asset match from three independently-sourced, caller-declared legs, then reconciles them against each other, skew-gated on how far apart their as-of dates are. Leg A is the issuer's own published reserve report extended with a per-asset-class breakdown; Leg B is the EDGAR N-MFP Part 1 series-level summary for the government money-market fund holding reserves (never the Part 3 per-security schedule); Leg C is a declared on-chain supply figure. Each leg is optional at the type level and a missing leg drives every check that depends on it to INDETERMINATE, never a fabricated pass. Emits reserve-ratio, WAM-ceiling, and per-holding GENIUS eligible-asset verdicts in MET/NOT_MET/INDETERMINATE and MATCHES_CRITERION/DOES_NOT_MATCH/INDETERMINATE vocabulary, three cross-source reconcile checks in RECONCILED/DISCREPANT/INDETERMINATE vocabulary, and an overall_determination worst-of rollup. Not re-specifying the shipped art-582 (1:1 top-line coverage + report-timeliness only) or art-584 (Merkle-sum PoR consistency); this node is the granular per-asset-class recompute and cross-source reconcile neither of those covers. A RECOMPUTE only: never a solvency claim, never an audit, never a third-party sign-off, never 'satisfies GENIUS'. Per-holding GENIUS eligible-asset flags report criteria-match only, with the statutory catch-all item always INDETERMINATE and never auto-matched; there is no overall_eligibility field of any kind."
resource: https://ainumbers.co/chaingraph/art-603-stablecoin-reserve-3source-recompute.html
tags: ["compliance_mandate", "wave-100", "mcp:recompute_stablecoin_reserve_3source"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-603-stablecoin-reserve-3source-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-603-stablecoin-reserve-3source-recompute.html
    title: "public tool page"
---

# Stablecoin Reserve 3-Source Recompute

> Exports a decision via MCP `recompute_stablecoin_reserve_3source` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-603-stablecoin-reserve-3source-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-603-stablecoin-reserve-3source-recompute.md) — §10.2.
