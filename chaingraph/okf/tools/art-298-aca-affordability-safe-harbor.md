---
type: DecisionTool
title: "ACA Affordability Safe-Harbor Calculator"
description: "Compute the ACA employer-mandate affordability percentage under each of the three IRC 4980H(a)(1)(B) safe harbors (W-2 wages, rate-of-pay, federal poverty line) against a supplied lowest-cost self-only monthly premium, using the version-pinned 2026 affordability threshold (9.96%, IRS Rev. Proc. 2025-25). Returns per-harbor affordability verdicts and which harbor(s) the offer satisfies. Root node of the aca-226j-response-composer chain. Not tax or legal advice -- calculation evidence only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-298-aca-affordability-safe-harbor.html
tags: ["compliance_mandate", "wave-48", "mcp:compute_aca_affordability_safe_harbor"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-298-aca-affordability-safe-harbor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-298-aca-affordability-safe-harbor.html
    title: "public tool page"
---

# ACA Affordability Safe-Harbor Calculator

> Exports a decision via MCP `compute_aca_affordability_safe_harbor` — mandate type `compliance_mandate`.

**Context:** 2026 ACA affordability threshold rose to 9.96% (IRS Rev. Proc. 2025-25), largest single-year jump since indexing began

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-298-aca-affordability-safe-harbor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ACA Employer Shared Responsibility Payment Exposure Calculator](./art-299-aca-esrp-exposure.md)
