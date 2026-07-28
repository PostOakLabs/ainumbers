---
type: DecisionTool
title: "ISO 20022 camt.053 Statement Reconciliation"
description: "Classifies ISO 20022 camt.053 BkTxCd entries by Domain, Family, and SubFamily per the CGI-MP camt.053 Usage Guide v5.0 and the ISO 20022 ExternalBankTransactionCode1Code registry 2023-03. Validates the OPBD + sum(movements) = CLBD balance equation. Scores structured-remittance match rate. Emits reconciliation_status (CLEAN / PARTIAL_MATCH / LOW_MATCH_RATE / FAILED_BALANCE), match_rate_pct, and domain_buckets[]. Used in corporate TMS straight-through reconciliation. ZERO PII: no account-holder names or identifiers enter this kernel."
resource: https://ainumbers.co/chaingraph/art-258-parse-camt053-reconciliation.html
tags: ["analytics_mandate", "wave-44", "mcp:parse_camt053_reconciliation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-258-parse-camt053-reconciliation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-258-parse-camt053-reconciliation.html
    title: "public tool page"
---

# ISO 20022 camt.053 Statement Reconciliation

> Exports a decision via MCP `parse_camt053_reconciliation` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-258-parse-camt053-reconciliation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Cash Forecast Accuracy Scoring](./art-263-score-cash-forecast-accuracy.md)

## Attested computation

[executor + attester binding](../computations/art-258-parse-camt053-reconciliation.md) — §10.2.
