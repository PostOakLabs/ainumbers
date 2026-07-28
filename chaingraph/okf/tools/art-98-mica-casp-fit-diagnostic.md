---
type: DecisionTool
title: "MiCA CASP Fit Diagnostic"
description: "12-question A-F diagnostic scoping a crypto-asset service provider's MiCA Title-V lifecycle readiness (authorization, Art 67 own-funds, whitepaper, MAR-crypto, travel rule) and routing to the right MiCA chain. Config-only; ART/EMT-issuer cases route to existing stablecoin chains."
resource: https://ainumbers.co/chaingraph/art-98-mica-casp-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-20", "mcp:run_mica_casp_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-98-mica-casp-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-98-mica-casp-fit-diagnostic.html
    title: "public tool page"
---

# MiCA CASP Fit Diagnostic

> Exports a decision via MCP `run_mica_casp_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-98-mica-casp-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [MiCA Transitional-Deadline Router](./art-99-mica-transitional-deadline-router.md), [CASP Authorization-Readiness Assessor](./art-100-mica-casp-authorization-readiness.md), [Crypto-Asset Whitepaper Linter (iXBRL)](./art-102-crypto-asset-whitepaper-linter.md), [MAR-Crypto Surveillance-Readiness Assessor](./art-103-mar-crypto-surveillance-readiness.md), [TFR Travel-Rule Batch Validator](./art-104-tfr-travel-rule-batch-validator.md), [MiCA Token & Service Scoper](./art-105-mica-token-service-scoper.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
