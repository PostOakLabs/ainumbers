---
type: DecisionTool
title: "Call Report Schedule RC-R (Regulatory Capital) Mapper"
description: "Maps caller-declared FFIEC Call Report (FFIEC 031) Schedule RC-R regulatory-capital components -- CET1, additional Tier 1, Tier 2 capital, total risk-weighted assets, total leverage exposure -- into the standard capital ratios (CET1, Tier 1, Total capital, supplementary leverage ratio) and the 2026-04-01 eSLR final rule's GSIB buffer requirement (§0.2), each checked against caller-declared, version-pinned minimums. Not a filer -- produces evidence artifacts and form-shaped totals only, never a submission. Capital-component and RWA values are caller-declared; this tool performs only ratio arithmetic and threshold comparison, never risk-weight calculation, exposure classification, or GSIB-status derivation. Feeds art-434 (Call Report edit-check gate) for cross-schedule validation against art-432 (Schedule RC). Not for Y-9C HC-R (see the separate Y-9C kernel)."
resource: https://ainumbers.co/chaingraph/art-433-call-report-rcr-capital.html
tags: ["regulatory_reporting", "wave-71", "mcp:map_call_report_schedule_rcr"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-433-call-report-rcr-capital.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-433-call-report-rcr-capital.html
    title: "public tool page"
---

# Call Report Schedule RC-R (Regulatory Capital) Mapper

> Exports a decision via MCP `map_call_report_schedule_rcr` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-433-call-report-rcr-capital.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Call Report Published Edit-Check Gate](./art-434-call-report-edit-check-gate.md)

## Attested computation

[executor + attester binding](../computations/art-433-call-report-rcr-capital.md) — §10.2.
