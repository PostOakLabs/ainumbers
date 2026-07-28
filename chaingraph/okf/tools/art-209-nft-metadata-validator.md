---
type: DecisionTool
title: "NFT Metadata Validator"
description: "Validates ERC-721/ERC-1155 and OpenSea NFT metadata JSON against required fields (name, description, image), recommended fields (external_url, animation_url, attributes), attribute entry structure, and license field presence. Schema check only; no on-chain calls. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html
tags: ["compliance_mandate", "wave-35", "mcp:validate_nft_metadata_art209"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-209-nft-metadata-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html
    title: "public tool page"
---

# NFT Metadata Validator

> Exports a decision via MCP `validate_nft_metadata_art209` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-209-nft-metadata-validator.md) — §10.2.
