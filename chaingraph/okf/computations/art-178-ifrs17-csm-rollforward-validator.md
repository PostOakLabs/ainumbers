---
type: Attested Computation
title: "IFRS 17 CSM Roll-Forward Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-178-ifrs17-csm-rollforward-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-178-ifrs17-csm-rollforward-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IFRS 17 CSM Roll-Forward Validator — attested computation

> §10.2 Attested Computation binding for [IFRS 17 CSM Roll-Forward Validator](../tools/art-178-ifrs17-csm-rollforward-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-178-ifrs17-csm-rollforward-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6d63a964418acbc17998ddac7014b0d42e3a09197ea4e1ffe32feeea586fb11f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
