---
type: DecisionTool
title: "MiCA Transitional-Deadline Router"
description: "Member-state transitional-deadline routing per Art 143(3) incl. the 30 Jun 2026 cliff (16 EU states). Emits exact end-date, window months, file-vs-wind-down decision, and filing preconditions."
resource: https://ainumbers.co/chaingraph/art-99-mica-transitional-deadline-router.html
tags: ["compliance_mandate", "wave-20", "mcp:route_mica_transitional_deadline"]
timestamp: 2026-07-14
---

# MiCA Transitional-Deadline Router

> Exports a decision via MCP `route_mica_transitional_deadline` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-99-mica-transitional-deadline-router.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA CASP Fit Diagnostic](./art-98-mica-casp-fit-diagnostic.md)

**Feeds:** [CASP Authorization-Readiness Assessor](./art-100-mica-casp-authorization-readiness.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
