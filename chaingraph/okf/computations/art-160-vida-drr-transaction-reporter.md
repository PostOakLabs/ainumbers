---
type: Attested Computation
title: "ViDA DRR Transaction Reporter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-160-vida-drr-transaction-reporter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-160-vida-drr-transaction-reporter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ViDA DRR Transaction Reporter — attested computation

> §10.2 Attested Computation binding for [ViDA DRR Transaction Reporter](../tools/art-160-vida-drr-transaction-reporter.md).

## Executor

Kernel source: `chaingraph/kernels/art-160-vida-drr-transaction-reporter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d7f2833446d60e8f7303219930929c8108dd595e8e1574ddb37f60d366d375c8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
