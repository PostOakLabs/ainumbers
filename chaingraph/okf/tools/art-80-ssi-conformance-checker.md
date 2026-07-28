---
type: DecisionTool
title: "SSI Conformance Checker"
description: "Lints standing settlement instructions for completeness, staleness, and format (~30%-of-fails root cause). BIC validated per ISO 9362. Staleness threshold configurable (default 90 days for T+1 cadence). Scores golden-source match rate and provider coverage."
resource: https://ainumbers.co/chaingraph/art-80-ssi-conformance-checker.html
tags: ["compliance_mandate", "wave-17", "mcp:check_ssi_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-80-ssi-conformance-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-80-ssi-conformance-checker.html
    title: "public tool page"
---

# SSI Conformance Checker

> Exports a decision via MCP `check_ssi_conformance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-80-ssi-conformance-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [T+1 Settlement Readiness Diagnostic](./art-77-t1-settlement-readiness-diagnostic.md)

**Feeds:** [Settlement-Fail Predictor](./art-79-settlement-fail-predictor.md), [Settlement Efficiency KPI Engine](./art-84-settlement-efficiency-kpi.md)

## Attested computation

[executor + attester binding](../computations/art-80-ssi-conformance-checker.md) — §10.2.
