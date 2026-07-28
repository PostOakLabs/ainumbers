---
type: DecisionTool
title: "CBAM Embedded-Emissions Calculator"
description: "Flagship importer tool. Computes embedded emissions (direct + indirect, tCO2e) for a consignment of CBAM goods from actual installation data or Commission default values, applying the system boundaries and monitoring rules of the Implementing Regulation. Handles precursor emissions from ART-72."
resource: https://ainumbers.co/chaingraph/art-69-cbam-embedded-emissions-calculator.html
tags: ["compliance_mandate", "wave-16", "mcp:calculate_cbam_embedded_emissions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-69-cbam-embedded-emissions-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-69-cbam-embedded-emissions-calculator.html
    title: "public tool page"
---

# CBAM Embedded-Emissions Calculator

> Exports a decision via MCP `calculate_cbam_embedded_emissions` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-69-cbam-embedded-emissions-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Carbon & Climate Compliance Fit Diagnostic](./art-68-carbon-compliance-fit-diagnostic.md), [CBAM Default-Value Resolver](./art-70-cbam-default-value-resolver.md), [CBAM Precursor-Emissions Aggregator](./art-72-cbam-precursor-emissions-aggregator.md)

**Feeds:** [CBAM Certificate Cost & Free-Allocation Engine](./art-71-cbam-certificate-cost-engine.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
