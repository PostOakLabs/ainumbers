---
type: DecisionTool
title: "ISO 20022-to-EVM Calldata Mapper"
description: "Deterministic bind of an ISO 20022 pacs.008 (customer credit transfer) or pacs.009 (FI credit transfer) payment message to EVM contract-call arguments, plus an OCG receipt of the mapping: resolved call, field bindings, unmapped required fields, and ABI type coercions. Draft-pinned generic ISO-20022-to-EVM profile: Swift blockchain-based shared ledger MVP (Besu/EVM-compatible, live 2026-07-09) has not published a field-binding table or a fixed contract ABI shape. Never queries a chain or RPC."
resource: https://ainumbers.co/chaingraph/art-288-map-iso20022-to-evm-calldata.html
tags: ["compliance_mandate", "wave-53", "mcp:map_iso20022_to_evm_calldata"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-288-map-iso20022-to-evm-calldata.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-288-map-iso20022-to-evm-calldata.html
    title: "public tool page"
---

# ISO 20022-to-EVM Calldata Mapper

> Exports a decision via MCP `map_iso20022_to_evm_calldata` — mandate type `compliance_mandate`.

**Context:** Swift shared-ledger MVP live 2026-07-09, 17-bank pilot; agentic-commerce corridor use is a stated next application.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-288-map-iso20022-to-evm-calldata.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [On-Ledger Transfer Batch Screen](./art-291-screen-onledger-transfer-batch.md)

## Attested computation

[executor + attester binding](../computations/art-288-map-iso20022-to-evm-calldata.md) — §10.2.
