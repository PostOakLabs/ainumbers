---
type: DecisionTool
title: "EUDR Country Benchmark Risk Scorer"
description: "Score country-of-production against the EUDR benchmark risk classification (low/standard/high per Art. 29): low risk (EU/EEA + strong forest governance) -> 1% inspection rate, simplified due diligence; standard risk (unclassified) -> 3% inspection rate, full due diligence; high risk -> 9% inspection rate, enhanced due diligence. Returns benchmark_risk, inspection_rate_pct, and due_diligence_level. Feeds traceability linker (art-169). Zero network, zero PII. Reg. EU 2023/1115."
resource: https://ainumbers.co/chaingraph/art-168-eudr-country-benchmark-risk-scorer.html
tags: ["compliance_mandate", "wave-30", "mcp:score_eudr_country_risk"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-168-eudr-country-benchmark-risk-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-168-eudr-country-benchmark-risk-scorer.html
    title: "public tool page"
---

# EUDR Country Benchmark Risk Scorer

> Exports a decision via MCP `score_eudr_country_risk` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-168-eudr-country-benchmark-risk-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [EUDR Supply-Chain Traceability Linker](./art-169-eudr-supply-chain-traceability-linker.md)

## Attested computation

[executor + attester binding](../computations/art-168-eudr-country-benchmark-risk-scorer.md) — §10.2.
