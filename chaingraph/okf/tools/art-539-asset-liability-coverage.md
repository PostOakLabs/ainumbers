---
type: DecisionTool
title: "Asset/Liability Coverage"
description: "General, jurisdiction-neutral solvency check: total_assets_musd / total_liabilities_musd, plus surplus_shortfall_musd = total_assets_musd - total_liabilities_musd, per asset-class and liability-class breakdown, rolled up. COVERED at or above 1.0, SHORTFALL below it. A zero-liabilities line resolves coverage_ratio null and status NO_LIABILITIES_OUTSTANDING -- never a division artifact. Aggregate totals only (no per-customer or per-wallet line item). No single normative anchor exists for exchange-level asset/liability coverage (unlike bank capital-adequacy ratios elsewhere in the suite) -- stated explicitly rather than inventing a crosswalk citation."
resource: https://ainumbers.co/chaingraph/art-539-asset-liability-coverage.html
tags: ["compliance_control", "wave-84", "mcp:compute_asset_liability_coverage"]
timestamp: 2026-08-04
generated: { by: "ainumbers/generate-okf", at: "2026-08-04" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-539-asset-liability-coverage.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-539-asset-liability-coverage.html
    title: "public tool page"
---

# Asset/Liability Coverage

> Exports a decision via MCP `compute_asset_liability_coverage` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-539-asset-liability-coverage.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-539-asset-liability-coverage.md) — §10.2.
