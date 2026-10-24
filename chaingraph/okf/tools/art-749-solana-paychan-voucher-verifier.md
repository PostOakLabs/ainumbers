---
type: DecisionTool
title: "Solana Paychan Voucher Verifier"
description: "Values-only check of a Solana payment-channels voucher message against trusted channel terms. The voucher is the 50-byte Ed25519-signed message the payment-channels program reads through the Instructions sysvar: magic bytes 0x56 0x01, a 32-byte channel PDA binding, a u64 little-endian cumulative amount and an i64 little-endian expiry (0 disables). This node recomputes the program validator's own post-signature check sequence by pure byte inspection and trusted inputs: exact 50-byte layout, magic tag/version, channel_id equals the supplied channel PDA, cumulative amount within the escrowed deposit ceiling, cumulative amount strictly above the settled watermark (at-or-below is a stale voucher, mirroring the program's settled >= cumulative failure), expiry 0 or later than the supplied unix clock, and an optional supersession comparison where a second voucher with a lower or equal cumulative amount is superseded by the first. On success it reports the settle delta (cumulative minus settled) a settle of this voucher would add. Values are pasted; every channel term (PDA, ceiling, watermark, clock) is a trusted input computed in BigInt with no floats. Out of scope and stated in every output: the Ed25519 signature itself is NOT verified here and nothing is read from chain; a companion on-chain check or precompile read is required for signature proof. Sibling of the Tempo MPP voucher verifier art-594."
resource: https://ainumbers.co/chaingraph/art-749-solana-paychan-voucher-verifier.html
tags: ["payment_mandate", "wave-134", "mcp:verify_solana_paychan_voucher"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-749-solana-paychan-voucher-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-749-solana-paychan-voucher-verifier.html
    title: "public tool page"
---

# Solana Paychan Voucher Verifier

> Exports a decision via MCP `verify_solana_paychan_voucher` — mandate type `payment_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-749-solana-paychan-voucher-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-749-solana-paychan-voucher-verifier.md) — §10.2.
