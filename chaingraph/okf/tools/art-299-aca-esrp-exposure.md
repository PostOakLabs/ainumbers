---
type: DecisionTool
title: "ACA Employer Shared Responsibility Payment Exposure Calculator"
description: "Compute proposed IRC 4980H(a) (\"no offer to 95%\") and 4980H(b) (\"unaffordable / not minimum value\") Employer Shared Responsibility Payment exposure from supplied full-time-employee counts, minimum-essential-coverage offer counts, and PTC-triggering employee counts, using the version-pinned 2026 per-employee penalty amounts ($3,340 (a) / $5,010 (b) annual, IRS Rev. Proc. 2025-26). Returns the controlling penalty and monthly breakdown. Exposure math only, not a determination that an assessment is owed. Feeds the terminal aca-226j-response-composer receipt. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-299-aca-esrp-exposure.html
tags: ["compliance_mandate", "wave-48", "mcp:compute_esrp_exposure"]
timestamp: 2026-07-14
---

# ACA Employer Shared Responsibility Payment Exposure Calculator

> Exports a decision via MCP `compute_esrp_exposure` — mandate type `compliance_mandate`.

**Context:** 2026 4980H(a)/(b) annual penalty amounts confirmed via IRS Rev. Proc. 2025-26

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-299-aca-esrp-exposure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ACA Affordability Safe-Harbor Calculator](./art-298-aca-affordability-safe-harbor.md)

**Feeds:** [226J Response Evidence Pack Builder](./art-300-aca-226j-response-evidence-pack.md)
