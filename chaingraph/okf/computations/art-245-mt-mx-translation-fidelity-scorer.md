---
type: Attested Computation
title: "MT103 to MX Translation Fidelity Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-245-mt-mx-translation-fidelity-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-245-mt-mx-translation-fidelity-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MT103 to MX Translation Fidelity Scorer — attested computation

> §10.2 Attested Computation binding for [MT103 to MX Translation Fidelity Scorer](../tools/art-245-mt-mx-translation-fidelity-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-245-mt-mx-translation-fidelity-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:df068aac811711ab2100e95147d96ce76694c32836ca079e405fbd586fbe351a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
