---
type: Attested Computation
title: "ERC-1967 Proxy Slot Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-607-erc1967-proxy-slot-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-607-erc1967-proxy-slot-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-1967 Proxy Slot Classifier — attested computation

> §10.2 Attested Computation binding for [ERC-1967 Proxy Slot Classifier](../tools/art-607-erc1967-proxy-slot-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-607-erc1967-proxy-slot-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cb03801af9357ed6b3898dae05c178a7a764302bbb4b1959ac2fa65bad1b065c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
