---
type: DecisionTool
title: "Transfer-Pricing Interquartile Range Benchmark"
description: "OECD Transfer Pricing Guidelines Ch. III §3.57 interquartile-range arithmetic over a caller-declared array of already-selected comparable financial ratios: linear-interpolation quartiles (Q1/median/Q3), IQR, and a tested-party ratio-vs-range verdict (below/within/above range). Also computes the TNMM net-cost-plus and operating-margin ratios and the Berry ratio directly from caller-declared financial data. Comparable-set SELECTION and functional/DEMPE analysis are entirely caller judgment -- this kernel performs no comparability analysis and never opines on which PLI applies; it is pure downstream arithmetic on an already-selected set. Cross-links art-456 GloBE safe-harbour (consumes the same underlying entity financial data for a different regime). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-473-interquartile-benchmark.html
tags: ["compliance_mandate", "wave-75", "mcp:benchmark_tp_interquartile_range"]
timestamp: 2026-07-14
---

# Transfer-Pricing Interquartile Range Benchmark

> Exports a decision via MCP `benchmark_tp_interquartile_range` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-473-interquartile-benchmark.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [OECD Country-by-Country Report Builder](./art-472-cbcr-builder.md)

**Feeds:** _terminal node_
