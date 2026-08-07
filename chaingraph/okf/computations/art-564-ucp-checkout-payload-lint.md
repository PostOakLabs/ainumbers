---
type: Attested Computation
title: "UCP Checkout Payload Lint — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-564-ucp-checkout-payload-lint.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-564-ucp-checkout-payload-lint.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# UCP Checkout Payload Lint — attested computation

> §10.2 Attested Computation binding for [UCP Checkout Payload Lint](../tools/art-564-ucp-checkout-payload-lint.md).

## Executor

Kernel source: `chaingraph/kernels/art-564-ucp-checkout-payload-lint.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:828c4890e7f551a049a00ccacf21c33350300f9b10d047e2d05904d0f97e5c62` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
