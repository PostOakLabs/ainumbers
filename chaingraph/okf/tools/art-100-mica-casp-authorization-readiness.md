---
type: DecisionTool
title: "CASP Authorization-Readiness Assessor"
description: "Scores readiness for MiCA CASP authorization (Arts 59-63): service-permission scope, governance/fit-and-proper, custody segregation, complaints/conflicts, ICT/DORA overlap. Gap score + Art 60/62 application-pack outline."
resource: https://ainumbers.co/chaingraph/art-100-mica-casp-authorization-readiness.html
tags: ["compliance_mandate", "wave-20", "mcp:assess_mica_casp_readiness"]
timestamp: 2026-07-14
---

# CASP Authorization-Readiness Assessor

> Exports a decision via MCP `assess_mica_casp_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-100-mica-casp-authorization-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA CASP Fit Diagnostic](./art-98-mica-casp-fit-diagnostic.md), [MiCA Transitional-Deadline Router](./art-99-mica-transitional-deadline-router.md)

**Feeds:** [Art 67 Own-Funds Calculator](./art-101-mica-art67-own-funds-calculator.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
