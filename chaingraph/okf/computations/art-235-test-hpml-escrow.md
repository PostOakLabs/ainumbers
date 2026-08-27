---
type: Attested Computation
title: "HPML Definition and Escrow Requirement Test — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-235-test-hpml-escrow.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-235-test-hpml-escrow.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# HPML Definition and Escrow Requirement Test — attested computation

> §10.2 Attested Computation binding for [HPML Definition and Escrow Requirement Test](../tools/art-235-test-hpml-escrow.md).

## Executor

Kernel source: `chaingraph/kernels/art-235-test-hpml-escrow.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1ae198828032158cef3630502b962e02ce05235c503f0b43bea0f76f0feac74a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
