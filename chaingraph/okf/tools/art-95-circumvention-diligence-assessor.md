---
type: DecisionTool
title: "Circumvention Diligence Assessor"
description: "Scores a transaction/contract config vs the EU 20th-package (23 Apr 2026) no-Russia clause + anti-circumvention due-diligence, emitting a liability-allocation verdict (seller liability-shift where DD documented under the safe harbour)."
resource: https://ainumbers.co/chaingraph/art-95-circumvention-diligence-assessor.html
tags: ["compliance_mandate", "wave-19", "mcp:assess_circumvention_diligence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-95-circumvention-diligence-assessor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-95-circumvention-diligence-assessor.html
    title: "public tool page"
---

# Circumvention Diligence Assessor

> Exports a decision via MCP `assess_circumvention_diligence` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-95-circumvention-diligence-assessor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ECCN / Dual-Use Classifier](./art-94-eccn-dual-use-classifier.md)

**Feeds:** [No-Russia-Clause Pack Builder](./art-96-no-russia-clause-pack-builder.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-95-circumvention-diligence-assessor.md) — §10.2.
