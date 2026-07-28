---
type: DecisionTool
title: "Anchored Extract Verifier"
description: "Verifies an extract's Merkle inclusion against a root only when that root is anchored by a recognized source: a recognized OCG artifact/chain envelope, or an external anchor (RFC 3161 timestamp, OpenTimestamps, Sigstore transparency log, or an on-chain commitment composed via verify_eth_state_proof, VR-1). Explicitly refuses (anchored:false) a self-produced root with no recognized anchor class; the universal self-produced hash-chain explorer stays dead. Not-X-use-Y: use art-280 (verify_reserve_proof) for Merkle-SUM Proof-of-Reserves inclusion specifically; this kernel verifies plain (non-sum) Merkle inclusion for any anchored extract."
resource: https://ainumbers.co/chaingraph/art-286-anchored-extract-verifier.html
tags: ["compliance_mandate", "wave-51", "mcp:verify_anchored_extract"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-286-anchored-extract-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-286-anchored-extract-verifier.html
    title: "public tool page"
---

# Anchored Extract Verifier

> Exports a decision via MCP `verify_anchored_extract` — mandate type `compliance_mandate`.

**Context:** Voluntary evidentiary practice aligned with amended AS 1105 (FY2026) and the AICPA practice aid on not relying on unanchored chain explorers; no statutory deadline.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-286-anchored-extract-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-286-anchored-extract-verifier.md) — §10.2.
