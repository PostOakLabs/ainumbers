---
type: DecisionTool
title: "Tempo Fee-Sponsorship & Gas-AMM Economics"
description: "Model Tempo enshrined-AMM gas cost paid in any major stablecoin, server-paid fee sponsorship, and net per-tx saving vs card/SWIFT/ACH baselines. Tempo has no native gas token and uses an enshrined protocol AMM, not ERC-4337/Paymaster (art-46). Outputs blended gas cost, sponsorship break-even volume, annual saving, and CFO memo. Its flat per-tx gas constant predates Tempo's mainnet launch and is not TIP-1010 verified: TIP-1010's published mainnet base fee targets close to $0.001 for a standard TIP-20 transfer, over three times this model's constant. For a mainnet-accurate, TIP-1010-cited fee calculation, see art-389-tempo-mainnet-fee-capacity, the successor node."
resource: https://ainumbers.co/chaingraph/art-107-tempo-gas-economics.html
tags: ["treasury_mandate", "wave-21", "mcp:model_tempo_gas_economics"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-107-tempo-gas-economics.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-107-tempo-gas-economics.html
    title: "public tool page"
---

# Tempo Fee-Sponsorship & Gas-AMM Economics

> Exports a decision via MCP `model_tempo_gas_economics` — mandate type `treasury_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-107-tempo-gas-economics.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo Payments Business Case](./art-35-tempo-payments-business-case.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-107-tempo-gas-economics.md) — §10.2.
