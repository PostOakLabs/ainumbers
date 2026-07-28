---
type: DecisionTool
title: "Supervisory Scenario Replay (DFAST-lite)"
description: "Replays the Fed's published 2026 28-variable supervisory scenario paths (baseline and severely adverse, Q1:2026-Q1:2029) against user-supplied loss and PPNR coefficient functions, producing a quarterly P&L and capital walk. This is a replay of user functions over official published inputs, not the Fed's model and not a DFAST submission."
resource: https://ainumbers.co/chaingraph/art-370-supervisory-scenario-replay.html
tags: ["capital_assessment", "wave-2", "mcp:replay_supervisory_scenario"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-370-supervisory-scenario-replay.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-370-supervisory-scenario-replay.html
    title: "public tool page"
---

# Supervisory Scenario Replay (DFAST-lite)

> Exports a decision via MCP `replay_supervisory_scenario` — mandate type `capital_assessment`.

**Deadline:** 2027-02-01 — Annual re-pin — Fed publishes new supervisory scenarios each February

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-370-supervisory-scenario-replay.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Liquidity Stress Test Simulator (LCR/NSFR)](./sim-01-lcr-nsfr-liquidity-stress-test.md), [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md)
