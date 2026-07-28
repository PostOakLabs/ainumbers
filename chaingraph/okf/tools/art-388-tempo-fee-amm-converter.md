---
type: DecisionTool
title: "Tempo Fee-AMM Conversion Calculator"
description: "Converts a supplied fee-token amount to the validator's token through Tempo's enshrined protocol Fee AMM (Tempo has no native gas token): validatorTokenOut = userTokenIn x 0.9970, 30bps to LPs. Checks the conversion against declared pool reserves for liquidity sufficiency and returns output-or-failure, never a silent overdraw. Fixed-point BigInt math at attodollar scale; calculator only, zero egress."
resource: https://ainumbers.co/chaingraph/art-388-tempo-fee-amm-converter.html
tags: ["treasury_mandate", "wave-65", "mcp:convert_tempo_fee_amm"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-388-tempo-fee-amm-converter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-388-tempo-fee-amm-converter.html
    title: "public tool page"
---

# Tempo Fee-AMM Conversion Calculator

> Exports a decision via MCP `convert_tempo_fee_amm` — mandate type `treasury_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-388-tempo-fee-amm-converter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
