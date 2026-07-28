---
type: DecisionTool
title: "NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope)"
description: "Classify an entity as Essential, Important, or Out-of-Scope under NIS2 Directive 2022/2555 Annex I and II, applying sector codes, employee/turnover size thresholds, and automatic-essential carve-outs (DNS providers, qualified trust service providers, public electronic communications networks). Feeds the Art. 21 gap checker (art-142). NIS2 entity classification active October 2024; annual registration window January–June each year."
resource: https://ainumbers.co/chaingraph/art-141-nis2-entity-scope-classifier.html
tags: ["compliance_mandate", "wave-26", "mcp:classify_nis2_entity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-141-nis2-entity-scope-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-141-nis2-entity-scope-classifier.html
    title: "public tool page"
---

# NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope)

> Exports a decision via MCP `classify_nis2_entity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-141-nis2-entity-scope-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)](./art-142-nis2-art21-gap-checker.md)

## Attested computation

[executor + attester binding](../computations/art-141-nis2-entity-scope-classifier.md) — §10.2.
