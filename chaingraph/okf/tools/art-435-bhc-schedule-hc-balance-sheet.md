---
type: DecisionTool
title: "FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper"
description: "Maps caller-declared FR Y-9C (Financial Statements for Holding Companies) Schedule HC line items -- cash, securities, loans and leases, other assets; deposits, borrowings, other liabilities; common stock, surplus, retained earnings, AOCI -- into Schedule HC totals (Total assets BHCK2170, Total liabilities BHCK2948, Total equity capital BHCK3210, real public MDRM item codes shared with the Call Report Schedule RC schema under the BHCK consolidated-holding-company prefix) and checks the HC balance-sheet identity within a caller-set rounding tolerance. Y-9C panel = top-tier bank holding companies with total consolidated assets >= $3B (§0.2). NO public XBRL edit taxonomy exists for Y-9C (FFIEC CDR taxonomy covers Call Reports 031/041/051 + UBPR only) -- edits are hand-encoded from FR Y-9C instruction text, not sourced from a machine-readable taxonomy. Schedule mapping logic mirrors art-432 (Call Report Schedule RC) 1:1; only the MDRM prefix (BHCK vs RCON) and report_form differ. Not a filer -- produces evidence artifacts and form-shaped totals only, never a submission. Line-item values are caller-declared from the holding company's own books; this tool performs only arithmetic aggregation and the identity check, never estimation or audit of individual line items. Feeds art-436 (Schedule HC-R capital)."
resource: https://ainumbers.co/chaingraph/art-435-bhc-schedule-hc-balance-sheet.html
tags: ["regulatory_reporting", "wave-71", "mcp:map_bhc_schedule_hc"]
timestamp: 2026-07-14
---

# FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper

> Exports a decision via MCP `map_bhc_schedule_hc` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-435-bhc-schedule-hc-balance-sheet.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [FR Y-9C Schedule HC-R (Regulatory Capital) Calculator](./art-436-bhc-schedule-hcr-capital.md)
