---
type: DecisionTool
title: "Pta Verifier"
description: "Verifies a plain-text-accounting journal supplied as synthetic text: parses dated transactions and their indented postings, checks each transaction's postings sum to zero (double-entry balance), checks any inline running-balance assertions against computed account balances, builds a Merkle root over the parsed transactions for tamper evidence, and emits Evidence Envelope v0.1 receipt fields (schema, event_type, input/output hashes, result_status). Unsupported journal directives (anything outside dated-transaction and posting lines) are listed, not silently dropped or errored on. Scope limit: single-currency, plain amounts with at most two decimals and no currency code. A line the parser cannot read is skipped and flagged PTA_UNSUPPORTED_DIRECTIVES_SKIPPED, and the elided posting is then auto-balanced with 0: when that flag is present the journal may be incomplete, so a result_status of success or the PTA_JOURNAL_VERIFIED flag does not cover the skipped lines. No multi-commodity or price-conversion support."
resource: https://ainumbers.co/mcp.html
tags: ["compliance_control", "wave-108", "mcp:compute_pta_verifier"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-653-pta-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# Pta Verifier

> Exports a decision via MCP `compute_pta_verifier` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-653-pta-verifier.md) — §10.2.
