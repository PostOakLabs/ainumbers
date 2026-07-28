---
type: DecisionTool
title: "On-Ledger Transfer Batch Screen"
description: "Batch-level pre-commit sanctions and purpose-code screen for a shared-ledger transfer batch, modeled on the shipped screen_tip20_transfer_batch pattern: per-transfer status, screening-list hits, purpose-code validity, a batch-clean verdict, and coverage gaps. Reuses the same purpose-code enum and screening-hit shape as check_purpose_code_requirement / check_screening_list_coverage rather than duplicating their logic. Zero-network; screens against supplied flagged-name lists only."
resource: https://ainumbers.co/chaingraph/art-291-screen-onledger-transfer-batch.html
tags: ["compliance_mandate", "wave-53", "mcp:screen_onledger_transfer_batch"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-291-screen-onledger-transfer-batch.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-291-screen-onledger-transfer-batch.html
    title: "public tool page"
---

# On-Ledger Transfer Batch Screen

> Exports a decision via MCP `screen_onledger_transfer_batch` — mandate type `compliance_mandate`.

**Context:** Swift shared-ledger MVP live 2026-07-09, 17-bank pilot moving tokenized-deposit transfers.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-291-screen-onledger-transfer-batch.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ISO 20022-to-EVM Calldata Mapper](./art-288-map-iso20022-to-evm-calldata.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-291-screen-onledger-transfer-batch.md) — §10.2.
