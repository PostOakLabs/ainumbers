---
type: DecisionTool
title: "Merkle Batch Verifier"
description: "Batch-verifies Merkle inclusion proofs using SHA-256 over payment batches, settlement message sets, and ISO 20022 sets. Zero-egress, browser-local. DORA Art. 12 audit-trail integrity."
resource: https://ainumbers.co/chaingraph/cry-04-merkle-batch-verifier.html
tags: ["cryptographic_mandate", "wave-3", "mcp:verify_merkle_batch"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/cry-04-merkle-batch-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/cry-04-merkle-batch-verifier.html
    title: "public tool page"
---

# Merkle Batch Verifier

> Exports a decision via MCP `verify_merkle_batch` — mandate type `cryptographic_mandate`.

**Context:** DORA Art.12 cryptographic controls + BIS CPMI PFMI Principle 9 settlement integrity — both in force

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/cry-04-merkle-batch-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA Stablecoin Reserve Stress Simulator](./rca-02-mica-reserve-stress.md), [DORA ICT Cascade Simulator](./pnr-01-dora-ict-cascade-simulator.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
