---
type: DecisionTool
title: "MiCA Token & Service Scoper"
description: "Disambiguation router classifying a case as ART/EMT-issuer (delegated to existing stablecoin-compliance chains) vs CASP-service (MiCA chains). Prevents Title III/IV vs Title V overlap; packages the MiCA suite."
resource: https://ainumbers.co/chaingraph/art-105-mica-token-service-scoper.html
tags: ["agent_guardrail_mandate", "wave-20", "mcp:scope_mica_token_and_service"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-105-mica-token-service-scoper.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-105-mica-token-service-scoper.html
    title: "public tool page"
---

# MiCA Token & Service Scoper

> Exports a decision via MCP `scope_mica_token_and_service` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-105-mica-token-service-scoper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA CASP Fit Diagnostic](./art-98-mica-casp-fit-diagnostic.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-105-mica-token-service-scoper.md) — §10.2.
