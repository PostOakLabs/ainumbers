---
type: DecisionTool
title: "CBAM Precursor-Emissions Aggregator"
description: "Rolls up embedded emissions across precursors in a steel/aluminium value chain (incl. the 2028 pre-consumer-scrap rule) so a producer can supply complex-goods emissions to its importer. Pre-positions the downstream-180 scope extension (Council position 12 Jun 2026, application 1 Jan 2028)."
resource: https://ainumbers.co/chaingraph/art-72-cbam-precursor-emissions-aggregator.html
tags: ["compliance_mandate", "wave-16", "mcp:aggregate_cbam_precursor_emissions"]
timestamp: 2026-07-14
---

# CBAM Precursor-Emissions Aggregator

> Exports a decision via MCP `aggregate_cbam_precursor_emissions` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-72-cbam-precursor-emissions-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Carbon & Climate Compliance Fit Diagnostic](./art-68-carbon-compliance-fit-diagnostic.md)

**Feeds:** [CBAM Embedded-Emissions Calculator](./art-69-cbam-embedded-emissions-calculator.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
