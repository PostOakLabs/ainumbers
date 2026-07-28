---
type: Attested Computation
title: "EUDR Supply-Chain Traceability Linker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-169-eudr-supply-chain-traceability-linker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-169-eudr-supply-chain-traceability-linker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EUDR Supply-Chain Traceability Linker — attested computation

> §10.2 Attested Computation binding for [EUDR Supply-Chain Traceability Linker](../tools/art-169-eudr-supply-chain-traceability-linker.md).

## Executor

Kernel source: `chaingraph/kernels/art-169-eudr-supply-chain-traceability-linker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5290987894384c3baf43f5a162fb87c964f0ff074535604e4b89001db38a40b7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
