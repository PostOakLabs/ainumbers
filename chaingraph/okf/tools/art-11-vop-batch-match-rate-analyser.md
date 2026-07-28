---
type: DecisionTool
title: "VoP Batch Match-Rate Analyser"
description: "Batch IBAN-name matching: match/close-match/no-match classification, configurable strictness (exact/normalized/fuzzy), false-positive vs false-negative trade-off curves, per-corridor mismatch-rate distribution. Upgrades T289 to full ChainGraph export schema."
resource: https://ainumbers.co/chaingraph/art-11-vop-batch-match-rate-analyser.html
tags: ["compliance_mandate", "wave-1", "mcp:simulate_vop_matching", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-11-vop-batch-match-rate-analyser.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-11-vop-batch-match-rate-analyser.html
    title: "public tool page"
---

# VoP Batch Match-Rate Analyser

> Exports a decision via MCP `simulate_vop_matching` — mandate type `compliance_mandate`.

**Context:** EU IPR VoP mandatory since October 2025 — live operational pain today

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-11-vop-batch-match-rate-analyser.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ISO 20022 Structured-Address Migration Batch Verifier](./rca-03-iso20022-address-migration-verifier.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-11-vop-batch-match-rate-analyser.md) — §10.2.
