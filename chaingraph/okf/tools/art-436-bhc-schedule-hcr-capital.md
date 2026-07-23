---
type: DecisionTool
title: "FR Y-9C Schedule HC-R (Regulatory Capital) Calculator"
description: "Given caller-supplied CET1/Tier1/Tier2 capital components and risk-weighted assets, computes FR Y-9C Schedule HC-R standard capital ratios plus the supplementary leverage ratio (SLR), including the enhanced-SLR (eSLR) buffer effective 2026-04-01 (§0.2), for top-tier bank holding companies (Y-9C panel = total consolidated assets >= $3B). Schedule mapping and ratio-calculation logic mirrors art-433 (Call Report Schedule RC-R) 1:1 -- same thresholds, same eSLR buffer treatment; only report_form and entity type (consolidated holding company vs insured depository institution) differ. NO public XBRL edit taxonomy exists for Y-9C (§0.2) -- capital-component field names mirror the FR Y-9/FFIEC BHCK consolidated mnemonic convention, hand-encoded from FR Y-9C instruction text. BOUNDARY: capital component and RWA values are caller-declared; this tool performs only ratio arithmetic and threshold comparison against caller-declared, version-pinned minimums -- it does not calculate risk weights, classify exposures, or derive GSIB status. Not a filer -- produces evidence artifacts only, never a submission."
resource: https://ainumbers.co/chaingraph/art-436-bhc-schedule-hcr-capital.html
tags: ["regulatory_reporting", "wave-71", "mcp:map_bhc_schedule_hcr"]
timestamp: 2026-07-14
---

# FR Y-9C Schedule HC-R (Regulatory Capital) Calculator

> Exports a decision via MCP `map_bhc_schedule_hcr` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-436-bhc-schedule-hcr-capital.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper](./art-435-bhc-schedule-hc-balance-sheet.md)

**Feeds:** _terminal node_
