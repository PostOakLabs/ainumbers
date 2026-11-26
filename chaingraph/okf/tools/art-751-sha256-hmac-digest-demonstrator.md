---
type: DecisionTool
title: "SHA-256 and HMAC-SHA256 Digest Demonstrator"
description: "Digests a caller-supplied UTF-8 string or hex byte string with SHA-256, or computes HMAC-SHA256 over it under a caller-supplied hex key, and echoes the algorithm id. It exists to give the shared guest-safe SHA-256 bundle a live execution surface: the kernel carries the bundle verbatim, so its fixtures, property floor and execution_hash exercise the exact bytes other kernels will later inline. Input is bounded at 64 KiB; anything else (unknown mode, unknown encoding, non-string or non-hex input, missing or non-hex key, oversize input) is rejected with a closed reason code and no digest. The kernel makes no policy decision and is not a signature scheme: HMAC here is a keyed digest over data the caller supplies, and the key travels in the request."
resource: https://ainumbers.co/mcp.html
tags: ["compliance_control", "wave-133", "mcp:compute_sha256_hmac_digest"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-751-sha256-hmac-digest-demonstrator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# SHA-256 and HMAC-SHA256 Digest Demonstrator

> Exports a decision via MCP `compute_sha256_hmac_digest` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-751-sha256-hmac-digest-demonstrator.md) — §10.2.
