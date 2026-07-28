---
type: DecisionTool
title: "Call Report Published Edit-Check Gate"
description: "Runs a curated battery of FFIEC-style published Call Report edit checks -- balance-sheet identity, capital-stack ordering (CET1 <= Tier 1 <= Total capital), ratio-vs-component consistency, cross-schedule entity/period match -- against art-432 (Schedule RC) and art-433 (Schedule RC-R) output payloads, the same class of check FFIEC's own edit-check system runs against filed data before CDR publication. Emits a per-check pass/fail verdict list plus an overall gate_status (auto_pass | review_required) using the §27 Human Accountability gate-policy vocabulary, so this node can sit directly ahead of a §27 dual_control/review_required gate on downstream export or submission-evidence chains. Curated representative battery, not the FFIEC's full published edit-check catalog (thousands of checks) -- does not claim FFIEC edit-check completeness. Not a filer -- produces evidence artifacts only, never a submission."
resource: https://ainumbers.co/chaingraph/art-434-call-report-edit-check-gate.html
tags: ["regulatory_reporting", "wave-71", "mcp:run_call_report_edit_checks"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-434-call-report-edit-check-gate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-434-call-report-edit-check-gate.html
    title: "public tool page"
---

# Call Report Published Edit-Check Gate

> Exports a decision via MCP `run_call_report_edit_checks` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-434-call-report-edit-check-gate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Call Report Schedule RC (Balance Sheet) Mapper](./art-432-call-report-rc-balance-sheet.md), [Call Report Schedule RC-R (Regulatory Capital) Mapper](./art-433-call-report-rcr-capital.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-434-call-report-edit-check-gate.md) — §10.2.
