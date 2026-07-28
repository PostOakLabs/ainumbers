---
type: DecisionTool
title: "Parametric Trigger Payout Calculator"
description: "Evaluates parametric insurance triggers and computes payout amounts. Supports three trigger types: threshold (binary payout at a threshold index level), tiered (step-based payout tiers), and linear_index (proportional payout between threshold and exhaustion). Produces a tamper-evident trigger receipt suitable for anchoring at anchor.ainumbers.co/mcp as a neutral dispute artifact per IAIS ICP 19. Use in parametric-trigger-adjudication chain (gated) or cat-bond-trigger-validation chain (linear). ZERO PII: index values, thresholds, and coverage amounts only."
resource: https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.html
tags: ["compliance_mandate", "wave-43", "mcp:compute_parametric_trigger_payout"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-251-compute-parametric-trigger-payout.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.html
    title: "public tool page"
---

# Parametric Trigger Payout Calculator

> Exports a decision via MCP `compute_parametric_trigger_payout` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Cat Bond Trigger Terms Validator](./art-252-validate-cat-bond-trigger-terms.md)
