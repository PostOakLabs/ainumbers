---
type: Attested Computation
title: "FDIC Part 370 Output-File Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-535-fdic370-output-file-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-535-fdic370-output-file-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FDIC Part 370 Output-File Validator — attested computation

> §10.2 Attested Computation binding for [FDIC Part 370 Output-File Validator](../tools/art-535-fdic370-output-file-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-535-fdic370-output-file-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:10cb82f1a665d074500af23e512217234c39f79ad7f298e6f12a74eab4e2eeae` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
