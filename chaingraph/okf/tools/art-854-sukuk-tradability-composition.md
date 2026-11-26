---
type: DecisionTool
title: "Sukuk Tradability Composition"
description: "Checks whether sukuk with a mixed asset portfolio are tradable at a negotiated price, per authority and per period, from the portfolio composition alone. Two authority profiles are supported: the Securities Commission Malaysia Shariah Advisory Council 266th meeting resolutions of 16 March 2023, under which at least 33 percent of the sukuk proceeds must sit in non-debt investment assets at the time of each issuance, the percentage need not be maintained through the tenure but a non-debt component must remain at all times, and any non-debt component means the certificates are a portfolio of assets rather than debt, tradable at a negotiated price; and the State Bank of Pakistan IFPD Circular 10 of 2024 Appendix A adoption of AAOIFI Shariah Standard No. 59, under which tangible and like assets must be at least 33 percent of asset value (including ijarah and diminishing musharakah assets with debt created through tawarruq), assets combined without a commingled entity fall under the sale-of-debt provisions, and a genuine commingled entity not entirely composed of debt is tradable. Each authority-period verdict is one of tradable_at_negotiated_price, sale_of_debt_rules_apply or issuance_test_failed, with its paragraph. AAOIFI standards 17 and 59 as published, the draft standard 62 (a status note only, since it is not final), IIFA, CBB, DFSA, DSN-MUI and CMA are refused by name. Whether the portfolio is Shariah compliant overall is a caller determination; this node applies only the cited composition rules. Outputs are arithmetic and rule checks against the cited texts, not a fatwa, Shariah certification, legal opinion or regulatory approval."
resource: https://ainumbers.co/chaingraph/art-854-sukuk-tradability-composition.html
tags: ["compliance_control", "wave-151", "mcp:check_sukuk_tradability_composition"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-854-sukuk-tradability-composition.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-854-sukuk-tradability-composition.html
    title: "public tool page"
---

# Sukuk Tradability Composition

> Exports a decision via MCP `check_sukuk_tradability_composition` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-854-sukuk-tradability-composition.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-854-sukuk-tradability-composition.md) — §10.2.
