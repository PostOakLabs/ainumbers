---
type: DecisionTool
title: "Control Frequency Sample"
description: "Applies a table you declare. It ships no table, and is not guidance from any audit firm or standard-setter. The sample size is only as defensible as the table. From a control frequency, a declared population size, a declared population hash, a period in days and a caller-supplied policy table keyed by frequency (expected population range and sample size per row), it returns the sample size from the matching row, whether the declared population falls inside the expected range for that frequency (a mismatch is flagged, never corrected), and a deterministic integer selection (a start offset below the population size, derived from the population hash, and evenly spread indices that can reach any position in the population). A missing table, a wrong-typed frequency or hash, a missing or duplicated frequency row, an invalid row, a sample size above the population or above 100000 is refused with an explicit code. No randomness and no clock. Values only, no personal data."
resource: https://ainumbers.co/chaingraph/838-control-frequency-sample.html
tags: ["compliance_control", "wave-145", "mcp:plan_control_frequency_sample"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/838-control-frequency-sample.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/838-control-frequency-sample.html
    title: "public tool page"
---

# Control Frequency Sample

> Exports a decision via MCP `plan_control_frequency_sample` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/838-control-frequency-sample.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/838-control-frequency-sample.md) — §10.2.
