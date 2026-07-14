---
type: DecisionTool
title: "DSCSA Transaction Statement (T3) Verifier"
description: "Verify the DSCSA T3 set (Transaction Information + History + Statement) completeness, validate the GS1 SGTIN, and map the EPCIS 2.0 event type. Feeds the saleable-returns verifier (art-113). DSCSA §582: enforcement live since Aug 2025."
resource: https://ainumbers.co/chaingraph/art-112-dscsa-transaction-statement-verifier.html
tags: ["compliance_mandate", "wave-22", "mcp:verify_dscsa_transaction_statement"]
timestamp: 2026-07-14
---

# DSCSA Transaction Statement (T3) Verifier

> Exports a decision via MCP `verify_dscsa_transaction_statement` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-112-dscsa-transaction-statement-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [DSCSA Saleable Returns Verifier](./art-113-saleable-returns-verifier.md)
