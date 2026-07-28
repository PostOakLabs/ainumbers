---
type: DecisionTool
title: "Settlement-Fail Predictor"
description: "Scores a trade's fail probability from anonymized configuration features (SSI match status, instrument liquidity tier, counterparty fail-history band, deadline proximity, partial-settlement availability) and ranks a batch for pre-settlement intervention. No PII. Transparent weighted scorecard: dominant driver per trade."
resource: https://ainumbers.co/chaingraph/art-79-settlement-fail-predictor.html
tags: ["model_governance", "wave-17", "mcp:predict_settlement_fail"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-79-settlement-fail-predictor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-79-settlement-fail-predictor.html
    title: "public tool page"
---

# Settlement-Fail Predictor

> Exports a decision via MCP `predict_settlement_fail` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-79-settlement-fail-predictor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [T+1 Settlement Readiness Diagnostic](./art-77-t1-settlement-readiness-diagnostic.md), [SSI Conformance Checker](./art-80-ssi-conformance-checker.md)

**Feeds:** [Settlement Efficiency KPI Engine](./art-84-settlement-efficiency-kpi.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
