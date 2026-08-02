---
type: DecisionTool
title: "Bulk Disbursement Integrity"
description: "Attests that a bulk payment run -- salaries, pensions, social transfers, vendor payments -- is internally consistent and matches its authorization. Reconciles per-payee records against the authorized control total in both count and value, surfaces duplicate-candidate clusters by a caller-supplied opaque key, reports payee roster movement against the prior run, and flags limit breaches including split-payment candidates (multiple sub-limit payments to one payee ref summing past a declared limit) and destination-tier cap breaches (a payment authorized and funded but unable to land because the destination wallet is at its KYC-tier balance cap). Duplicate, split, and cap-breach flags are candidates for review, never findings of fraud or misconduct. Region-portable: every fact is a caller-declared input, with no country, currency, or scheme hardcoded. Deterministic arithmetic only. Zero network, zero PII -- payee is an opaque ref plus an amount and a rail."
resource: https://ainumbers.co/chaingraph/art-518-bulk-disbursement-integrity.html
tags: ["attestation_mandate", "wave-80", "mcp:attest_bulk_disbursement_integrity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-518-bulk-disbursement-integrity.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-518-bulk-disbursement-integrity.html
    title: "public tool page"
---

# Bulk Disbursement Integrity

> Exports a decision via MCP `attest_bulk_disbursement_integrity` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-518-bulk-disbursement-integrity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-518-bulk-disbursement-integrity.md) — §10.2.
