---
type: DecisionTool
title: "§125 Cafeteria Plan Nondiscrimination Tester"
description: "Runs the §125 cafeteria-plan nondiscrimination tests from supplied aggregate participant counts: an eligibility-ratio test and a contributions-and-benefits ratio test (§410(b)-style ratio-percentage analogy -- IRS has never finalized regs under §125(g)(3), DRAFT pending final rules), and the statutory key-employee 25% concentration limit (IRC §125(b)(2), fixed). Returns per-test pass/fail and the concentration ratio. Not a plan-qualification opinion -- verify-side employer-evidence assembly only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-301-section125-ndt.html
tags: ["compliance_mandate", "wave-48", "mcp:run_section125_ndt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-301-section125-ndt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-301-section125-ndt.html
    title: "public tool page"
---

# §125 Cafeteria Plan Nondiscrimination Tester

> Exports a decision via MCP `run_section125_ndt` — mandate type `compliance_mandate`.

**Context:** Eligibility-ratio and contributions-and-benefits thresholds are DRAFT (no finalized §125(g)(3) regs); key-employee 25% concentration limit is a fixed statutory constant (IRC §125(b)(2))

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-301-section125-ndt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
