---
type: DecisionTool
title: "MAR-Crypto Surveillance-Readiness Assessor"
description: "Scores market-abuse arrangements (Arts 86-92 + Dec-2024 RTS): PPAET (prevention/detection), STOR templates, insider lists, manipulation-pattern config on synthetic order batches. Readiness grade + STOR-template completeness."
resource: https://ainumbers.co/chaingraph/art-103-mar-crypto-surveillance-readiness.html
tags: ["compliance_mandate", "wave-20", "mcp:assess_mar_crypto_surveillance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-103-mar-crypto-surveillance-readiness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-103-mar-crypto-surveillance-readiness.html
    title: "public tool page"
---

# MAR-Crypto Surveillance-Readiness Assessor

> Exports a decision via MCP `assess_mar_crypto_surveillance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-103-mar-crypto-surveillance-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA CASP Fit Diagnostic](./art-98-mica-casp-fit-diagnostic.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
