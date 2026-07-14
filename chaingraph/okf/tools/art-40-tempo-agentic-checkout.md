---
type: DecisionTool
title: "Tempo Agentic Checkout Settlement Mapper"
description: "Binds an ACP / Visa TAP / ISO 20022 checkout to a TIP-20 settlement. Maps the 32-byte Tempo memo → ISO 20022 remittance_information, sender/receiver → debtor/creditor (with optional LEI), and normalises an on-chain Tempo tx into the AP2 artifact envelope. The canonical OCG v0.3 pacs.008-subset tool for Tempo: instructs the bilateral settlement receipt that agents and merchants both verify via execution_hash. W-D terminal node."
resource: https://ainumbers.co/chaingraph/art-40-tempo-agentic-checkout.html
tags: ["settlement_mandate", "wave-9", "mcp:map_tempo_settlement"]
timestamp: 2026-07-14
---

# Tempo Agentic Checkout Settlement Mapper

> Exports a decision via MCP `map_tempo_settlement` — mandate type `settlement_mandate`.

**Context:** TIP-20 32-byte memo ↔ ISO 20022 remittance_information crosswalk. ACP/Visa TAP/MPP settlement leg.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-40-tempo-agentic-checkout.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo Fit Diagnostic](./art-34-tempo-fit-diagnostic.md), [Tempo MPP Agent Mandate](./art-36-tempo-mpp-agent-mandate.md)

**Feeds:** _terminal node_
