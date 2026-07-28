---
type: DecisionTool
title: "ISO 20022 Structured-Address Migration Batch Verifier"
description: "GPU-parallel validation of PostalAddress24 fields across pacs.008 messages (up to 500k). Country-specific rules (UK postcode, DE Postleitzahl, US ZIP+4), MT103 :50K: truncation-risk flagging, November-2026 readiness score."
resource: https://ainumbers.co/chaingraph/rca-03-iso20022-address-migration-verifier.html
tags: ["compliance_mandate", "wave-1", "mcp:verify_address_migration_batch", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/rca-03-iso20022-address-migration-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/rca-03-iso20022-address-migration-verifier.html
    title: "public tool page"
---

# ISO 20022 Structured-Address Migration Batch Verifier

> Exports a decision via MCP `verify_address_migration_batch` — mandate type `compliance_mandate`.

**Deadline:** 2026-11-01 — SWIFT CBPR+ structured-address mandate — November 2026 (~5 months). Hardest deadline tool in suite by proximity.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/rca-03-iso20022-address-migration-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [VoP Batch Match-Rate Analyser](./art-11-vop-batch-match-rate-analyser.md), [EN 16931 / Factur-X E-Invoicing Batch Validator](./art-08-en16931-einvoice-batch-validator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
