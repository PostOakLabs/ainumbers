---
type: DecisionTool
title: "SOC Report Coverage and Bridge Gap"
description: "Recomputes coverage and gap arithmetic from declared values. It does not read the SOC report, does not assess whether any control is effective, and is not an audit opinion. From a declared report type (type 1 or type 2), declared period start and end, declared opinion type and exception count, the user entity's declared fiscal year-end and as-of date, a declared list of complementary user entity control ids each with the customer's mapped control id or null, and a declared list of subservice organisation ids each marked carved out or inclusive, it returns the uncovered control ids and counts, whether the report period covers the fiscal year-end, the bridge gap in whole days from period end to year-end (zero when covered), the carved-out subservice ids that need their own report, the days from period end to the as-of date, and flags for any opinion other than unmodified or any non-zero exception count. A missing required fact returns INDETERMINATE and is never guessed. Dates are strict ISO calendar dates and impossible dates are refused. Ids must match a short lowercase identifier pattern; an email-like or name-like string is refused with an explicit code. Free text is not accepted. A type 1 report describes a point in time and the node flags it rather than treating it as operating coverage. It decides nothing about which controls are complementary and does not reproduce any report or standard text."
resource: https://ainumbers.co/chaingraph/art-842-soc-report-coverage-gap.html
tags: ["compliance_control", "wave-146", "mcp:compute_soc_report_coverage_gap"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-842-soc-report-coverage-gap.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-842-soc-report-coverage-gap.html
    title: "public tool page"
---

# SOC Report Coverage and Bridge Gap

> Exports a decision via MCP `compute_soc_report_coverage_gap` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-842-soc-report-coverage-gap.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-842-soc-report-coverage-gap.md) — §10.2.
