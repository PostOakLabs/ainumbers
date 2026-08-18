---
type: DecisionTool
title: "Ap2 X402 Cart Correlation"
description: "Correlates a built AP2 CartMandate (cart_root, cart_items, merchant) against an x402_spend_evidence pack: does the cart total (sum of quantity*unit_price per currency) match the x402 authorization's value, does the CartMandate's merchant map to the authorization's recipient address, and does the CartMandate's own hash-chain independently re-verify against the supplied cart_items (never trusted as a self-reported flag). Output vocabulary is CORRELATION_STATUS (CORRELATED / NOT_CORRELATED / INDETERMINATE) -- this is a plausibility check over two independently-produced artifacts, never a cryptographic binding. Google has not shipped an AP2-compatible x402 extension; no field or code path here implies one exists. Zero network calls; never a facilitator, proxy, gateway, or settlement relay."
resource: https://ainumbers.co/chaingraph/art-596-ap2-x402-cart-correlation.html
tags: ["compliance_control", "wave-107", "mcp:correlate_ap2_cartmandate_x402"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-596-ap2-x402-cart-correlation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-596-ap2-x402-cart-correlation.html
    title: "public tool page"
---

# Ap2 X402 Cart Correlation

> Exports a decision via MCP `correlate_ap2_cartmandate_x402` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-596-ap2-x402-cart-correlation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-596-ap2-x402-cart-correlation.md) — §10.2.
