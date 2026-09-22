---
type: Attested Computation
title: "HOEPA High-Cost Mortgage Trigger Test — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-234-test-hoepa-high-cost.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# HOEPA High-Cost Mortgage Trigger Test — attested computation

> §10.2 Attested Computation binding for [HOEPA High-Cost Mortgage Trigger Test](../tools/art-234-test-hoepa-high-cost.md).

## Executor

Kernel source: `chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bf1ed2f649fe1dbd7ec585504c545df1c00b12ce5a64cedf4d6e583f01628670` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
