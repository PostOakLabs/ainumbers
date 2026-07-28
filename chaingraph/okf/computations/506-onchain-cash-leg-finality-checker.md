---
type: Attested Computation
title: "On-Chain Cash-Leg Finality Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/506-onchain-cash-leg-finality-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/506-onchain-cash-leg-finality-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# On-Chain Cash-Leg Finality Checker — attested computation

> §10.2 Attested Computation binding for [On-Chain Cash-Leg Finality Checker](../tools/506-onchain-cash-leg-finality-checker.md).

## Executor

Kernel source: `chaingraph/kernels/506-onchain-cash-leg-finality-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a8dc570f0262a6be9c06dc3b094353f70b4e87b7b379e93f7113086935456dbc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
