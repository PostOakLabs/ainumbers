---
type: DecisionTool
title: "ViDA Compliance Readiness Diagnostic"
description: "Scored ViDA readiness diagnostic across four dimensions: einvoice (EN 16931-1:2026 ready), drr (DRR reporting pipeline ready), platform (deemed-supplier assessed or not applicable), and oss (OSS/SVR scheme configured or not applicable). Returns readiness_score (0–100), gaps list, fully_ready boolean, and phased obligation timeline (2028-07-01 platform+SVR, 2030-07-01 DRR+e-invoice mandatory, 2035-01-01 legacy regime harmonization). Terminal node of the vida-platform-and-registration chain. Zero network, zero PII. EU 2025/516."
resource: https://ainumbers.co/chaingraph/art-164-vida-compliance-readiness-diagnostic.html
tags: ["compliance_mandate", "wave-29", "mcp:run_vida_readiness_diagnostic"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-164-vida-compliance-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-164-vida-compliance-readiness-diagnostic.html
    title: "public tool page"
---

# ViDA Compliance Readiness Diagnostic

> Exports a decision via MCP `run_vida_readiness_diagnostic` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-164-vida-compliance-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ViDA OSS Registration Router](./art-163-vida-oss-registration-router.md)

**Feeds:** _terminal node_
