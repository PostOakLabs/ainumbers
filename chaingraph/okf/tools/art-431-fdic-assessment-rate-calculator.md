---
type: DecisionTool
title: "FDIC Deposit-Insurance Assessment Rate Calculator"
description: "FDIC deposit-insurance assessment rate calculator (12 CFR 327): looks up the base assessment rate for a supplied composite CAMELS + financial-ratio score against a caller-supplied rate schedule, then applies the unsecured-debt and brokered-deposit adjustments and floors/caps the result to a caller-supplied statutory range. The rate schedule is caller-supplied policy input, not hardcoded, so a future FDIC rate-schedule update (including a pending assessments rulemaking) is a policy_parameters change, not a kernel change. Does not compute the composite CAMELS score itself."
resource: https://ainumbers.co/chaingraph/art-431-fdic-assessment-rate-calculator.html
tags: ["compliance_mandate", "wave-71", "mcp:compute_fdic_assessment_rate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-431-fdic-assessment-rate-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-431-fdic-assessment-rate-calculator.html
    title: "public tool page"
---

# FDIC Deposit-Insurance Assessment Rate Calculator

> Exports a decision via MCP `compute_fdic_assessment_rate` — mandate type `compliance_mandate`.

**Context:** A pending FDIC assessments rulemaking (NPR, June 2026) may revise the published rate schedule; verify the current schedule at fdic.gov before relying on this output for any live filing decision.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-431-fdic-assessment-rate-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
