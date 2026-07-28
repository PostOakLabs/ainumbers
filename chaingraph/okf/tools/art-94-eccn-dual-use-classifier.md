---
type: DecisionTool
title: "ECCN / Dual-Use Classifier"
description: "Decision-tree from product attributes to ECCN (EAR) + EU Annex I category + controlling regime (Wassenaar/MTCR/AG/NSG) + licence-requirement logic, including 2025 emerging-tech controls (quantum/semiconductor/AM/peptide). EU Annex I updated 15 Nov 2025."
resource: https://ainumbers.co/chaingraph/art-94-eccn-dual-use-classifier.html
tags: ["compliance_mandate", "wave-19", "mcp:classify_eccn_dual_use"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-94-eccn-dual-use-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-94-eccn-dual-use-classifier.html
    title: "public tool page"
---

# ECCN / Dual-Use Classifier

> Exports a decision via MCP `classify_eccn_dual_use` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-94-eccn-dual-use-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Sanctions & Export-Control Screening Fit Diagnostic](./art-90-sanctions-screening-fit-diagnostic.md)

**Feeds:** [Circumvention Diligence Assessor](./art-95-circumvention-diligence-assessor.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
