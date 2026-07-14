---
type: DecisionTool
title: "NFT Metadata Validator"
description: "Validates ERC-721/ERC-1155 and OpenSea NFT metadata JSON against required fields (name, description, image), recommended fields (external_url, animation_url, attributes), attribute entry structure, and license field presence. Schema check only; no on-chain calls. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html
tags: ["compliance_mandate", "wave-35", "mcp:validate_nft_metadata"]
timestamp: 2026-07-14
---

# NFT Metadata Validator

> Exports a decision via MCP `validate_nft_metadata` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
