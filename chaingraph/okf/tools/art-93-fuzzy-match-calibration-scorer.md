---
type: DecisionTool
title: "Fuzzy-Match Calibration Scorer"
description: "Given a config (algorithm, threshold) and a synthetic labelled name-pair set, computes FPR/recall/F1, scores threshold quality, and recommends calibration. No real names -- synthetic fixtures only."
resource: https://ainumbers.co/chaingraph/art-93-fuzzy-match-calibration-scorer.html
tags: ["model_governance", "wave-19", "mcp:score_fuzzy_match_calibration"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-93-fuzzy-match-calibration-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-93-fuzzy-match-calibration-scorer.html
    title: "public tool page"
---

# Fuzzy-Match Calibration Scorer

> Exports a decision via MCP `score_fuzzy_match_calibration` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-93-fuzzy-match-calibration-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Sanctions & Export-Control Screening Fit Diagnostic](./art-90-sanctions-screening-fit-diagnostic.md)

**Feeds:** [Sanctions Screening-Program Quality Scorer](./art-97-sanctions-screening-quality-scorer.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-93-fuzzy-match-calibration-scorer.md) — §10.2.
