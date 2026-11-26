---
type: DecisionTool
title: "Sales OTE & Commission Analyzer"
description: "Gross W-2 model for a sales OTE offer ported from ApexLogics Apex #89 (AL-96): base salary plus variable pay as a function of quota attainment, with an optional accelerator tier (strictly inactive at or below the threshold) and an optional recoverable draw with a months-to-payback figure and a clawback-elevated flag. Reports the base commission rate (ote-base)/quota, the at-target variable and total (always evaluated at exactly 100% attainment), a flat-rate after-tax figure, the base/variable split with a high/moderate/low risk label at 60%/40% of OTE in variable pay, a six-level attainment scenario ladder (50/75/100/125/150/200), and an accelerator insight row at 150%. Refuses ote <= base and base <= 0 with named reasons in Apex guard order, and refuses a non-calendar as_of: the node reads no clock, as_of is an input. Every numeric input is read with the Apex `||` default semantics, so an explicit 0 is replaced by the default and reported in apex_zero_coercion_applied with an APEX_ZERO_COERCION_APPLIED flag. The node computes NO tax liability (after_tax_at_target is gross times one flat caller rate, not the 2026 marginal schedule, which the kernel records as named literals from Rev. Proc. 2025-32 sec. 4.01 without applying), NO FLSA regular rate and NO overtime. The risk cuts, the 6-month clawback threshold and the 25-point highlight bucket are the Apex tool's own editorial constants with no cited source; the advertised BLS OEWS 2024 vintage is not present in the compute and was not carried across (payload DIFFERS.md D-1..D-4, CITES.md UNGROUNDED)."
resource: https://ainumbers.co/chaingraph/art-756-sales-ote-commission-analyzer.html
tags: ["sales_comp_record", "wave-134", "mcp:analyze_sales_ote_commission"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-756-sales-ote-commission-analyzer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-756-sales-ote-commission-analyzer.html
    title: "public tool page"
---

# Sales OTE & Commission Analyzer

> Exports a decision via MCP `analyze_sales_ote_commission` — mandate type `sales_comp_record`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-756-sales-ote-commission-analyzer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-756-sales-ote-commission-analyzer.md) — §10.2.
