---
type: DecisionTool
title: "ETR Possession-Chain Receipt Builder"
description: "Builds a hash-chained possession-receipt evidence pack for an electronic transferable record (ETR) under UNCITRAL MLETR Art. 10/11: given the ETR's own document digest and an ordered set of control-transfer events (from_holder, to_holder, timestamp, signature -- all as supplied), each receipt binds the prior receipt's hash, so reordering, inserting, or deleting a transfer breaks the chain. Also checks holder-to-holder continuity and timestamp ordering, and computes a SHA-256 Merkle root over the chain -- a portable evidence pack a holder can present to a bank or court. Does not itself assess MLETR Art. 10/11 singularity/exclusive-control legal elements; that verdict is check_etr_control_evidence (art-352)."
resource: https://ainumbers.co/chaingraph/art-353-etr-possession-chain-builder.html
tags: ["cryptographic_mandate", "wave-61", "mcp:build_etr_possession_chain"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-353-etr-possession-chain-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-353-etr-possession-chain-builder.html
    title: "public tool page"
---

# ETR Possession-Chain Receipt Builder

> Exports a decision via MCP `build_etr_possession_chain` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-353-etr-possession-chain-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ETR Singularity & Exclusive-Control Evidence Checker](./art-352-etr-control-evidence-checker.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-353-etr-possession-chain-builder.md) — §10.2.
