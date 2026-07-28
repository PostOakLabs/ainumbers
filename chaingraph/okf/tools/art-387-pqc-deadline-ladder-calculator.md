---
type: DecisionTool
title: "CNSA 2.0 Deadline Ladder Calculator"
description: "Per-row CNSA 2.0 post-quantum migration deadline for a supplied system inventory (system class, asset type, deployment date): applicable deadline, days remaining, the earliest binding constraint, and a FIPS 140-2 Historical-list exposure flag. Every deadline is declared with a source citation so a regulatory date shift is a data re-pin, not a code change. Structural date math only, findings asserted, not legal advice."
resource: https://ainumbers.co/chaingraph/art-387-pqc-deadline-ladder-calculator.html
tags: ["compliance_mandate", "wave-65", "mcp:compute_pqc_deadline_ladder"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-387-pqc-deadline-ladder-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-387-pqc-deadline-ladder-calculator.html
    title: "public tool page"
---

# CNSA 2.0 Deadline Ladder Calculator

> Exports a decision via MCP `compute_pqc_deadline_ladder` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-387-pqc-deadline-ladder-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-387-pqc-deadline-ladder-calculator.md) — §10.2.
