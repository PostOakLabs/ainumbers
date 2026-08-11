---
type: DecisionTool
title: "Tempo MPP Voucher & Receipt Verifier"
description: "Verifies a Tempo Machine Payments Protocol cumulative EIP-712 session voucher offline (ecrecover, no RPC or database lookup), validates a TIP-20 32-byte memo structurally, and validates/renders a merchant-side HTTP 402 Payment challenge plus a Payment-Receipt-shaped binding to an optional subject execution_hash. Voucher struct and channel-state field names confirmed against the primary TIP20ChannelReserve.sol contract source, not just secondary docs. Never holds a private key, never signs, never escrows third-party funds, never initiates a payment, never operates a live endpoint -- every field is caller-supplied and echoed, nothing is fetched or resolved independently. A receiving address is not custody."
resource: https://ainumbers.co/chaingraph/art-594-tempo-mpp-voucher-receipt-verifier.html
tags: ["compliance_control", "wave-99", "mcp:verify_tempo_mpp_voucher"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-594-tempo-mpp-voucher-receipt-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-594-tempo-mpp-voucher-receipt-verifier.html
    title: "public tool page"
---

# Tempo MPP Voucher & Receipt Verifier

> Exports a decision via MCP `verify_tempo_mpp_voucher` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-594-tempo-mpp-voucher-receipt-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-594-tempo-mpp-voucher-receipt-verifier.md) — §10.2.
