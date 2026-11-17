---
type: Attested Computation
title: "Freelance Quarterly Estimated Tax Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the consumer_finance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-752-freelance-quarterly-estimated-tax.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-752-freelance-quarterly-estimated-tax.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Freelance Quarterly Estimated Tax Calculator — attested computation

> §10.2 Attested Computation binding for [Freelance Quarterly Estimated Tax Calculator](../tools/art-752-freelance-quarterly-estimated-tax.md).

## Executor

Kernel source: `chaingraph/kernels/art-752-freelance-quarterly-estimated-tax.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5fe02008851f9211e0952edc9d0b99ab09485f0b1f7d9452b408961d0bc5e3cf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
