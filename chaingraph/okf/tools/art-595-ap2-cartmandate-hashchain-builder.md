---
type: DecisionTool
title: "AP2 CartMandate Hash-Chain Builder"
description: "Builds an illustrative Google AP2 CartMandate Verifiable Digital Credential (VDC) skeleton whose credentialSubject carries a deterministic hash-chain over an ordered list of cart line items: link_0 = keccak256(canon({index:0,item})), link_i = keccak256(canon({index:i,item,prev:link_(i-1)})), cart_root = the final link. Reuses this repo's existing RFC 8785/JCS canonicalization (cgCanon, from _hash.mjs) and the already-vendored @noble/hashes keccak256 bundle -- no new vendoring, no hand-rolled canonicalization or hashing. Stands beside art-16 (Google AP2 Mandate Builder) as a new node, not an edit to it -- art-16's flat CheckoutMandate/PaymentMandate shape has no line-item array to chain over. An intact chain proves the ordered cart_items list was not altered after the chain was built; it does NOT prove human authorisation, delivery, settlement, or that item prices are correct or current. Given a prior chain's per-item links (claimed_links) and a (possibly tampered) cart_items, the kernel recomputes and reports CART_CHAIN_INTACT plus the earliest divergent index, never a thrown exception. Zero network calls; never a facilitator, proxy, gateway, or settlement relay."
resource: https://ainumbers.co/chaingraph/art-595-ap2-cartmandate-hashchain-builder.html
tags: ["payment_policy", "wave-99", "mcp:build_ap2_cartmandate_hashchain"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-595-ap2-cartmandate-hashchain-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-595-ap2-cartmandate-hashchain-builder.html
    title: "public tool page"
---

# AP2 CartMandate Hash-Chain Builder

> Exports a decision via MCP `build_ap2_cartmandate_hashchain` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-595-ap2-cartmandate-hashchain-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Ap2 X402 Cart Correlation](./art-596-ap2-x402-cart-correlation.md)

## Attested computation

[executor + attester binding](../computations/art-595-ap2-cartmandate-hashchain-builder.md) — §10.2.
