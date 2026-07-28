---
type: DecisionTool
title: "NCCI Experience Modification Calculator"
description: "Workers'-compensation experience rating modification (NCCI Experience Rating Plan Manual published national formula): per-claim primary/excess loss split at the state split point, then Mod = (Ap + W×Ae + (1-W)×Ee + B) / (Ep + B). Split point, expected losses, expected primary losses, weighting value, and ballast value are licensed NCCI/state rating-bureau table values supplied by the caller from their own experience rating worksheet -- this node never vendors or reproduces those tables, only the published split-and-mod formula."
resource: https://ainumbers.co/chaingraph/art-346-compute-experience-mod.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_experience_mod"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-346-compute-experience-mod.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-346-compute-experience-mod.html
    title: "public tool page"
---

# NCCI Experience Modification Calculator

> Exports a decision via MCP `compute_experience_mod` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-346-compute-experience-mod.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-346-compute-experience-mod.md) — §10.2.
