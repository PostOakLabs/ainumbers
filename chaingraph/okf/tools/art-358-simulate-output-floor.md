---
type: DecisionTool
title: "Basel Output-Floor Phase-In Simulator"
description: "Basel III finalization / 2026 reproposal output-floor simulator: applies the published floor mechanic (applied RWA = max(internal-model RWA, floor% x standardized RWA)) across a caller-supplied annual phase-in schedule, returning the year-by-year capital impact path, the first binding-floor year, and the maximum incremental RWA the floor adds versus the internal model. Phase-in years and floor percentages are jurisdiction-specific and, pre-finalization, still proposed -- this node takes them as inputs from the caller's own rule text and never vendors or hardcodes a phase-in table."
resource: https://ainumbers.co/chaingraph/art-358-simulate-output-floor.html
tags: ["compliance_mandate", "wave-61", "mcp:simulate_output_floor"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-358-simulate-output-floor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-358-simulate-output-floor.html
    title: "public tool page"
---

# Basel Output-Floor Phase-In Simulator

> Exports a decision via MCP `simulate_output_floor` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-358-simulate-output-floor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
