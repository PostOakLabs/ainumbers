---
type: DecisionTool
title: "Private-Input Capital Adequacy Check"
description: "Checks a privately held eligible-capital and risk-weighted-assets figure against a pinned regulatory minimum (Basel III/3.1 CET1, or Solvency II SCR coverage), emitting only an above/below-minimum verdict and tier without disclosing capital or RWA. Carries an OCG Standard §25 ocg-private-input@1 declaration: the capital inputs are committed via sha256-salted@1 in policy_parameters.capital_inputs_commitment, never in the clear. Private-input variant of compute_basel31_delta (art-07) / calculate_solvency2_scr_ratio (art-180); use those public-input kernels when disclosure of the capital figures is acceptable; use this one when it is not. ZERO PII disclosed: only the above/below-minimum verdict is public."
resource: https://ainumbers.co/chaingraph/art-415-check-capital-adequacy-private.html
tags: ["analytics_mandate", "wave-51", "mcp:check_capital_adequacy_private"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-415-check-capital-adequacy-private.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-415-check-capital-adequacy-private.html
    title: "public tool page"
---

# Private-Input Capital Adequacy Check

> Exports a decision via MCP `check_capital_adequacy_private` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-415-check-capital-adequacy-private.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
