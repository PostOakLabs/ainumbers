---
type: Attested Computation
title: "Supervisory Scenario Replay (DFAST-lite) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the capital_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-370-supervisory-scenario-replay.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-370-supervisory-scenario-replay.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Supervisory Scenario Replay (DFAST-lite) — attested computation

> §10.2 Attested Computation binding for [Supervisory Scenario Replay (DFAST-lite)](../tools/art-370-supervisory-scenario-replay.md).

## Executor

Kernel source: `chaingraph/kernels/art-370-supervisory-scenario-replay.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1e4fce8fd6091dfe615782e95fda6b777a3c36d0fe5d65cf211f2957d69a64cd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
