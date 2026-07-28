---
type: DecisionTool
title: "TRACE / CAT Reporting Lint"
description: "TRACE (FINRA Rule 6730) trade-report timeliness lint against a caller-declared trading calendar and hours window, computing the reporting deadline from the execution timestamp with weekend/holiday-aware rollover, plus a CAT (Consolidated Audit Trail) equity/option order-event structural format-lint over a representative subset of required fields. Honestly scoped: not a full implementation of the CAT Reporting Technical Specification, and there is no built-in market calendar -- weekend days and holidays are supplied by the caller and versioned via constants_version."
resource: https://ainumbers.co/chaingraph/art-397-lint-trace-cat-reports.html
tags: ["compliance_mandate", "wave-63", "mcp:lint_trace_cat_reports"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-397-lint-trace-cat-reports.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-397-lint-trace-cat-reports.html
    title: "public tool page"
---

# TRACE / CAT Reporting Lint

> Exports a decision via MCP `lint_trace_cat_reports` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-397-lint-trace-cat-reports.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [15c3-3 Customer Reserve Formula Calculator](./art-396-compute-15c3-3-reserve.md)

**Feeds:** _terminal node_
