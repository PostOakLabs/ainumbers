---
type: Attested Computation
title: "CBAM Certificate Cost & Free-Allocation Engine — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-71-cbam-certificate-cost-engine.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-71-cbam-certificate-cost-engine.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CBAM Certificate Cost & Free-Allocation Engine — attested computation

> §10.2 Attested Computation binding for [CBAM Certificate Cost & Free-Allocation Engine](../tools/art-71-cbam-certificate-cost-engine.md).

## Executor

Kernel source: `chaingraph/kernels/art-71-cbam-certificate-cost-engine.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:80df4fc1195a5177c803aad81d51aabbfad003ca7e5c117591b4f557b278f2d9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
