---
type: DecisionTool
title: "CBAM Default-Value Resolver"
description: "Resolves the Commission default embedded-emissions value for a (CN code x country-of-origin) pair, applies the year-dependent markup vs the actual-data path (+10% 2026, +20% 2027, +30% 2028+), and returns the value with provenance citing the CBAM Implementing Regulation."
resource: https://ainumbers.co/chaingraph/art-70-cbam-default-value-resolver.html
tags: ["compliance_mandate", "wave-16", "mcp:resolve_cbam_default_value"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-70-cbam-default-value-resolver.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-70-cbam-default-value-resolver.html
    title: "public tool page"
---

# CBAM Default-Value Resolver

> Exports a decision via MCP `resolve_cbam_default_value` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-70-cbam-default-value-resolver.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Carbon & Climate Compliance Fit Diagnostic](./art-68-carbon-compliance-fit-diagnostic.md)

**Feeds:** [CBAM Embedded-Emissions Calculator](./art-69-cbam-embedded-emissions-calculator.md)

## Attested computation

[executor + attester binding](../computations/art-70-cbam-default-value-resolver.md) — §10.2.
