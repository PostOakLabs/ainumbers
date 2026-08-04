---
type: DecisionTool
title: "Custody Segregation Ratio"
description: "Generic, jurisdiction-neutral custody-segregation check: segregated_custody_assets_musd / customer_claims_musd, per asset class and rolled up. FULLY_SEGREGATED at or above 1.0, UNDER_SEGREGATED below it, OVER_SEGREGATED above an optional configurable ceiling. A zero-claims line resolves segregation_ratio null and status NO_CLAIMS_OUTSTANDING -- never a division artifact. Aggregate totals only (no per-customer or per-wallet line item). SEC Rule 15c3-3 possession-or-control (17 CFR 240.15c3-3(b)) is named as one crosswalk-annex instance among possibly several -- the arithmetic does not depend on that citation, and the SEC 15c3-3 Exhibit A reserve formula stays a distinct, unedited node (art-396)."
resource: https://ainumbers.co/chaingraph/art-538-custody-segregation-ratio.html
tags: ["compliance_control", "wave-84", "mcp:compute_custody_segregation_ratio"]
timestamp: 2026-08-04
generated: { by: "ainumbers/generate-okf", at: "2026-08-04" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-538-custody-segregation-ratio.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-538-custody-segregation-ratio.html
    title: "public tool page"
---

# Custody Segregation Ratio

> Exports a decision via MCP `compute_custody_segregation_ratio` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-538-custody-segregation-ratio.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-538-custody-segregation-ratio.md) — §10.2.
