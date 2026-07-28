---
type: DecisionTool
title: "Digest Manifest Builder"
description: "Binds N file digests into one canonical, hash-anchored manifest. manifest_sha256 is SHA-256 over the JCS-canonical sorted entries array. This builds flat manifests with no tree, which is a different job from verify_merkle_batch (cry-04, which verifies Merkle proofs); BrowserChain's log owns Merkle trees. Also serves the plain checksum-tool use case. Returns the manifest plus checks for duplicate names, duplicate digests, malformed hex, and path-like names that are flagged and basenamed. Feeds the conversion receipt builder. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-194-digest-manifest-builder.html
tags: ["cryptographic_mandate", "wave-34", "mcp:build_digest_manifest"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-194-digest-manifest-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-194-digest-manifest-builder.html
    title: "public tool page"
---

# Digest Manifest Builder

> Exports a decision via MCP `build_digest_manifest` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-194-digest-manifest-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Conversion Receipt Builder](./art-191-conversion-receipt-builder.md)

## Attested computation

[executor + attester binding](../computations/art-194-digest-manifest-builder.md) — §10.2.
