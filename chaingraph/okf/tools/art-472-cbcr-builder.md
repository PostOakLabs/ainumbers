---
type: DecisionTool
title: "OECD Country-by-Country Report Builder"
description: "Builds an OECD BEPS Action 13 Country-by-Country Report XML schema skeleton from a caller-declared Table 1 (jurisdiction revenue/profit/tax/employee/asset data) and Table 2 (constituent-entity list) against a caller-declared, version-pinned Action 13 XML schema version. Runs internal consistency checks -- per-jurisdiction revenue-component sums, employee/asset non-negativity, entity-jurisdiction referential integrity between Table 1 and Table 2 -- and surfaces a profit-with-zero-employees anomaly flag for the downstream §27 review gate. Also produces EU Directive (EU) 2021/2101 and Australian public-CbCR field-subset export modes. NEVER a submission -- not accepted by any national CbCR gateway; each jurisdiction's own portal runs its own additional validation. Comparable-set selection and transfer-pricing judgment stay out of scope (see art-473-interquartile-benchmark for arm's-length range arithmetic). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-472-cbcr-builder.html
tags: ["compliance_mandate", "wave-75", "mcp:build_cbcr_report"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-472-cbcr-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-472-cbcr-builder.html
    title: "public tool page"
---

# OECD Country-by-Country Report Builder

> Exports a decision via MCP `build_cbcr_report` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-472-cbcr-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Transfer-Pricing Interquartile Range Benchmark](./art-473-interquartile-benchmark.md)
