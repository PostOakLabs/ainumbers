---
type: DecisionTool
title: "Sanctions Screening-Program Quality Scorer"
description: "Wolfsberg-aligned screening-program quality scorecard: list coverage + match calibration + alert tuning + escalation workflow + model validation -> composite program-conformance grade and improvement priorities."
resource: https://ainumbers.co/chaingraph/art-97-sanctions-screening-quality-scorer.html
tags: ["model_governance", "wave-19", "mcp:score_sanctions_screening_quality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-97-sanctions-screening-quality-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-97-sanctions-screening-quality-scorer.html
    title: "public tool page"
---

# Sanctions Screening-Program Quality Scorer

> Exports a decision via MCP `score_sanctions_screening_quality` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-97-sanctions-screening-quality-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Screening List-Coverage Checker](./art-92-screening-list-coverage-checker.md), [Fuzzy-Match Calibration Scorer](./art-93-fuzzy-match-calibration-scorer.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-97-sanctions-screening-quality-scorer.md) — §10.2.
