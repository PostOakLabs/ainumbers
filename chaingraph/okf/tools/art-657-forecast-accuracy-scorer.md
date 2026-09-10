---
type: DecisionTool
title: "Forecast Accuracy Scorer"
description: "Scores a batch of resolved probabilistic forecasts (a stated probability paired with the realized yes/no outcome) using two textbook proper scoring rules -- the Brier score and the logarithmic score -- plus a Brier Skill Score against a caller-supplied reference forecast. Each forecast may optionally carry an informational subject-matter category label (economic indicator, election/political, sports competition, gaming-style event, weather/climate, or other) so results can be broken out per category in the output. Those category labels are descriptive grouping only, supplied by the caller: this node makes no determination of contract eligibility, legality, or regulatory status, and cites no specific rule. Scope limit: it scores calibration of already-resolved forecasts; it does not itself resolve markets, price contracts, or assess venue compliance."
resource: https://ainumbers.co/chaingraph/art-657-forecast-accuracy-scorer.html
tags: ["forecast_accuracy_score", "wave-111", "mcp:compute_forecast_accuracy_score"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-657-forecast-accuracy-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-657-forecast-accuracy-scorer.html
    title: "public tool page"
---

# Forecast Accuracy Scorer

> Exports a decision via MCP `compute_forecast_accuracy_score` — mandate type `forecast_accuracy_score`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-657-forecast-accuracy-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-657-forecast-accuracy-scorer.md) — §10.2.
