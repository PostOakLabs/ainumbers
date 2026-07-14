---
type: DecisionTool
title: "IPFS CID Computer"
description: "Computes a CIDv1 content address for text or metadata using SHA-256 multihash, raw codec (0x55), and base32 lowercase multibase prefix. Use to verify what tokenURI resolves to before minting. Metadata-scale inputs only. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-210-ipfs-cid-computer.html
tags: ["compliance_mandate", "wave-35", "mcp:compute_ipfs_cid"]
timestamp: 2026-07-14
---

# IPFS CID Computer

> Exports a decision via MCP `compute_ipfs_cid` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-210-ipfs-cid-computer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
