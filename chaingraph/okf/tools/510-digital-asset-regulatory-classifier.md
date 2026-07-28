---
type: DecisionTool
title: "Digital Asset Regulatory Classifier"
description: "Classify tokenized assets under GENIUS Act, MiCA, MiFID II, and EU DLT Pilot Regime. Outputs applicable frameworks, MiFID II instrument type, and DLT Pilot eligibility flag."
resource: https://ainumbers.co/tools/510-digital-asset-regulatory-classifier.html
tags: ["compliance_mandate", "wave-8", "mcp:classify_digital_asset_regulatory", "iso20022:party-identification"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/510-digital-asset-regulatory-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/510-digital-asset-regulatory-classifier.html
    title: "public tool page"
---

# Digital Asset Regulatory Classifier

> Exports a decision via MCP `classify_digital_asset_regulatory` — mandate type `compliance_mandate`.

**Context:** digital asset classification. GENIUS Act enacted; MiCA Arts. 3/17/48; MiFID II Annex I; EU DLT Pilot Reg. 2022/858.

**Semantic profile:** `iso20022:party-identification` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/510-digital-asset-regulatory-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Tokenized Security Lifecycle Validator](./512-tokenized-security-lifecycle-validator.md)

## Attested computation

[executor + attester binding](../computations/510-digital-asset-regulatory-classifier.md) — §10.2.
