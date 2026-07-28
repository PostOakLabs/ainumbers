---
type: DecisionTool
title: "Attribute Sampling Plan Generator"
description: "Computes a SOX 404 / ICFR attribute-sampling plan from confidence level, tolerable deviation rate, and expected deviation rate (all policy inputs) using the standard zero-EDR Poisson attribute-sampling formula with an expansion factor for nonzero EDR. Item selection is deterministic interval sampling over the caller-declared population hash -- no randomness, so any auditor can replay the exact same sample from the same declared inputs. If the tolerable deviation rate is at or below the expected deviation rate the plan is statistically indefensible, so the kernel reframes to a full-population census rather than shipping a bad plan. First node in the ICFR control-test evidence chain (feeds art-461 control-test-evidence-composer). NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-458-attribute-sampling-plan.html
tags: ["compliance_control", "wave-74", "mcp:plan_attribute_sample"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-458-attribute-sampling-plan.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-458-attribute-sampling-plan.html
    title: "public tool page"
---

# Attribute Sampling Plan Generator

> Exports a decision via MCP `plan_attribute_sample` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-458-attribute-sampling-plan.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-458-attribute-sampling-plan.md) — §10.2.
