---
type: Attested Computation
title: "openIDS Homeowners Record Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-256-validate-openids-homeowners-record.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-256-validate-openids-homeowners-record.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# openIDS Homeowners Record Validator — attested computation

> §10.2 Attested Computation binding for [openIDS Homeowners Record Validator](../tools/art-256-validate-openids-homeowners-record.md).

## Executor

Kernel source: `chaingraph/kernels/art-256-validate-openids-homeowners-record.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1b6e89be4bc17a5622e6bd5153cc9520c91514b8c0ddd89759d30ffae9bd3c5e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
