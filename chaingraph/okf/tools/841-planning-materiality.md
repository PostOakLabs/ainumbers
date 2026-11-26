---
type: DecisionTool
title: "Planning Materiality"
description: "Arithmetic on declared policy. It does not choose the benchmark, does not judge whether the percentage is appropriate, and is not a materiality determination. From a declared benchmark id, a benchmark amount in integer minor units, an overall percentage in basis points, a performance percentage of overall in basis points, a clearly-trivial percentage of overall in basis points, a required rationale id and a declared rounding rule (round half up or floor), it recomputes the overall materiality, the performance materiality and the clearly-trivial threshold, and reports whether performance stays at or below overall and clearly-trivial stays at or below performance (a violation is flagged, never corrected). It ships no default percentage and no typical range. A missing rationale id or benchmark id, a percentage of zero or above 10000 basis points, a negative or non-integer amount, or an unknown rounding rule is refused with an explicit code. The performance threshold is the tolerable-misstatement figure that the attribute and monetary-unit sampling node (art-693) takes as an input. The planning standards (ISA 320, AS 2105) are cited for context and never reproduced. No randomness and no clock. Values only, no personal data."
resource: https://ainumbers.co/chaingraph/841-planning-materiality.html
tags: ["compliance_control", "wave-146", "mcp:compute_planning_materiality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/841-planning-materiality.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/841-planning-materiality.html
    title: "public tool page"
---

# Planning Materiality

> Exports a decision via MCP `compute_planning_materiality` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/841-planning-materiality.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/841-planning-materiality.md) — §10.2.
