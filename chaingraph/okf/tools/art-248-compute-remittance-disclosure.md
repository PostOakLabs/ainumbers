---
type: DecisionTool
title: "Remittance Disclosure Calculator (Reg E Subpart B)"
description: "Computes the required Reg E subpart B (12 CFR 1005.31/1005.32) remittance disclosure fields: transfer_amount_usd (send minus fees), exchange_rate_disclosed, amount_received_dest in destination currency, fees breakdown, total_to_sender_usd, disclosure_type (EXACT or ESTIMATED), estimate_permissible flag, and accounting identity check. Pre-transfer receipt anchor point for CFPB exam and error-resolution disputes (12 CFR 1005.33). ZERO PII: amounts, rates, fees, and taxes only. Gate node for the remittance-disclosure-and-corridor-cost chain."
resource: https://ainumbers.co/chaingraph/art-248-compute-remittance-disclosure.html
tags: ["compliance_mandate", "wave-42", "mcp:compute_remittance_disclosure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-248-compute-remittance-disclosure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-248-compute-remittance-disclosure.html
    title: "public tool page"
---

# Remittance Disclosure Calculator (Reg E Subpart B)

> Exports a decision via MCP `compute_remittance_disclosure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-248-compute-remittance-disclosure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Corridor Cost Comparator (World Bank RPW)](./art-249-compare-corridor-cost.md)
