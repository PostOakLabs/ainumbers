---
type: DecisionTool
title: "Call Report Schedule RC (Balance Sheet) Mapper"
description: "Maps caller-declared FFIEC Call Report (FFIEC 031) Schedule RC line items -- cash, securities, loans and leases, other assets; deposits, borrowings, other liabilities; common stock, surplus, retained earnings, AOCI -- into Schedule RC totals (Total assets RCON2170, Total liabilities RCON2948, Total equity capital RCON3210, real public MDRM item codes) and checks the RC balance-sheet identity (Total assets == Total liabilities + Total equity capital) within a caller-set rounding tolerance. Not a filer -- produces evidence artifacts and form-shaped totals only, never a submission. Line-item values are caller-declared from the institution's own books; this tool performs only arithmetic aggregation and the identity check, never estimation or audit of individual line items. Feeds art-433 (Schedule RC-R capital) and art-434 (Call Report edit-check gate) for cross-schedule validation. Not for Y-9C (see the separate Y-9C kernel, which uses instruction-text-encoded edits, not a public taxonomy)."
resource: https://ainumbers.co/chaingraph/art-432-call-report-rc-balance-sheet.html
tags: ["regulatory_reporting", "wave-71", "mcp:map_call_report_schedule_rc"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-432-call-report-rc-balance-sheet.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-432-call-report-rc-balance-sheet.html
    title: "public tool page"
---

# Call Report Schedule RC (Balance Sheet) Mapper

> Exports a decision via MCP `map_call_report_schedule_rc` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-432-call-report-rc-balance-sheet.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Call Report Published Edit-Check Gate](./art-434-call-report-edit-check-gate.md)
