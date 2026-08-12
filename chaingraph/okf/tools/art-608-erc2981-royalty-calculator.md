---
type: DecisionTool
title: "ERC-2981 Royalty Calculator"
description: "Recomputes an ERC-2981 royalty amount as floor(sale_price * royalty_fraction_bps / 10000) -- the same integer-division convention the OpenZeppelin reference ERC2981 implementation uses -- from a caller-declared sale_price and royalty_fraction_bps, using BigInt arithmetic throughout so a sale_price beyond Number.MAX_SAFE_INTEGER never loses precision. Flags a bps value above 10000 (100%) as out of range (the value the reference implementation reverts on) while still reporting the raw recompute, and compares against an optional claimed_royalty_amount. Zero network calls: this tool never queries a contract's actual royaltyInfo() return value -- sale_price, royalty_fraction_bps, and receiver are all caller-declared. Cross-links 528-nft-metadata-validator and 521-cant-be-evil-nft-license-picker for adjacent NFT-standard surfaces (metadata shape, license terms) this tool does not cover. ERC-2981 royalty payment is a voluntary off-chain convention: this tool makes no claim that any marketplace will actually pay the computed amount."
resource: https://ainumbers.co/chaingraph/art-608-erc2981-royalty-calculator.html
tags: ["payment_policy", "wave-99", "mcp:calculate_erc2981_royalty"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-608-erc2981-royalty-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-608-erc2981-royalty-calculator.html
    title: "public tool page"
---

# ERC-2981 Royalty Calculator

> Exports a decision via MCP `calculate_erc2981_royalty` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-608-erc2981-royalty-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-608-erc2981-royalty-calculator.md) — §10.2.
