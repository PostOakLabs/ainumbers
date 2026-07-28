---
type: DecisionTool
title: "ViDA Recapitulative Statement Migration Assessor"
description: "Assess an entity's readiness to migrate from EC Sales List (recapitulative statements) to ViDA Digital Reporting Requirements. Checks presence of four ESL fields (seller_vat_id, buyer_vat_id, reporting_period, supply_type), pre-2024 domestic regime flag (harmonization deadline: 2030-07-01 for new regimes, 2035-01-01 for legacy), and transaction_value completeness. Returns migration_ready, drr_gap_fields, and harmonize_deadline. Terminal node of the vida-digital-reporting-requirements chain. Zero network, zero PII. EU 2025/516."
resource: https://ainumbers.co/chaingraph/art-161-vida-recapitulative-statement-migration-assessor.html
tags: ["compliance_mandate", "wave-29", "mcp:assess_vida_recapitulative_migration"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-161-vida-recapitulative-statement-migration-assessor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-161-vida-recapitulative-statement-migration-assessor.html
    title: "public tool page"
---

# ViDA Recapitulative Statement Migration Assessor

> Exports a decision via MCP `assess_vida_recapitulative_migration` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-161-vida-recapitulative-statement-migration-assessor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ViDA DRR Transaction Reporter](./art-160-vida-drr-transaction-reporter.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-161-vida-recapitulative-statement-migration-assessor.md) — §10.2.
