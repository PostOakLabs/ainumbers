---
type: DecisionTool
title: "FR Y-14 Capital Worksheet Roll-Forward & Cross-Check"
description: "Rolls forward a caller-declared FR Y-14A/Q capital worksheet (CET1, additional Tier 1, Tier 2) from beginning balance through period additions and deductions to an ending balance, applies a caller-declared published-scenario adjustment (e.g. a Federal Reserve DFAST/CCAR severely-adverse published-scenario delta), and cross-checks the computed ending total capital against a caller-declared reported total-capital figure sourced from another schedule (e.g. FR Y-9C Schedule HC-R, art-436) within a caller-declared tolerance. Not a filer -- produces evidence artifacts and worksheet totals only, never a submission. All roll-forward line items, the scenario adjustment amount, and the cross-check reference figure are caller-declared; this tool performs only roll-forward arithmetic (beginning + additions - deductions + scenario adjustment = ending) and a tolerance comparison, never capital-component classification, scenario modeling, or projection -- firm capital-planning models (PPNR, loss forecasts, scenario translation into balance-sheet impact) stay strictly outside this boundary. Complements art-436 (BHC Schedule HC-R capital) as an independent roll-forward/cross-check, not a replacement for it."
resource: https://ainumbers.co/chaingraph/art-439-y14-capital-worksheet-rollforward.html
tags: ["regulatory_reporting", "wave-71", "mcp:rollforward_y14_capital_worksheet"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-439-y14-capital-worksheet-rollforward.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-439-y14-capital-worksheet-rollforward.html
    title: "public tool page"
---

# FR Y-14 Capital Worksheet Roll-Forward & Cross-Check

> Exports a decision via MCP `rollforward_y14_capital_worksheet` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-439-y14-capital-worksheet-rollforward.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-439-y14-capital-worksheet-rollforward.md) — §10.2.
