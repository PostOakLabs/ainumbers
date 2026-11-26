---
type: DecisionTool
title: "Quadratic Funding Round Recompute"
description: "Recomputes how a quadratic funding round splits a matching pool from contribution amounts you supply, in two modes. Plain mode gives each project a subsidy equal to the square of the summed contributor square roots minus the contributions themselves. Pairwise-bounded mode weights each contributor pair by M over M plus the pair overlap across projects, with M in minor units (the coefficient with alpha equal to 1; the alpha variants and the squared-matrix variant are not implemented). Every amount is an integer of minor units and every square root is an exact integer root floored at a declared number of decimal digits, so the result is a pure function of the input. The matching pool is then split in proportion to subsidy with largest-remainder rounding so the matches sum to the pool exactly, or optionally capped at the raw subsidy when that fits. The output states every rounding step and labels the match as within tolerance of any published round, never identical. Caps: 200 contribution rows, 40 contributors, 20 projects, amounts and pool up to 10^12 minor units. Contributor and project labels are pseudonymous strings restricted to letters, digits, underscore and hyphen. Reproduces the published formula on your data. It does not detect sybils, applies no identity or fraud screening, and does not endorse any round or token."
resource: https://ainumbers.co/chaingraph/art-814-qf-pairwise-recompute.html
tags: ["compliance_control", "wave-142", "mcp:recompute_quadratic_funding_round"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-814-qf-pairwise-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-814-qf-pairwise-recompute.html
    title: "public tool page"
---

# Quadratic Funding Round Recompute

> Exports a decision via MCP `recompute_quadratic_funding_round` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-814-qf-pairwise-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-814-qf-pairwise-recompute.md) — §10.2.
