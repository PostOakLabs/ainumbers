---
type: DecisionTool
title: "Art 67 Own-Funds Calculator"
description: "Computes MiCA Art 67 required own funds = higher of Annex IV permanent minimum (€50k advisory / €125k trading-platform / €150k custody-exchange) or ¼ fixed overheads. Checks CET1/insurance form eligibility."
resource: https://ainumbers.co/chaingraph/art-101-mica-art67-own-funds-calculator.html
tags: ["compliance_mandate", "wave-20", "mcp:calculate_mica_own_funds"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-101-mica-art67-own-funds-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-101-mica-art67-own-funds-calculator.html
    title: "public tool page"
---

# Art 67 Own-Funds Calculator

> Exports a decision via MCP `calculate_mica_own_funds` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-101-mica-art67-own-funds-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CASP Authorization-Readiness Assessor](./art-100-mica-casp-authorization-readiness.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
