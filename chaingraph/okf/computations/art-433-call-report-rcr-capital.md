---
type: Attested Computation
title: "Call Report Schedule RC-R (Regulatory Capital) Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-433-call-report-rcr-capital.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-433-call-report-rcr-capital.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Call Report Schedule RC-R (Regulatory Capital) Mapper — attested computation

> §10.2 Attested Computation binding for [Call Report Schedule RC-R (Regulatory Capital) Mapper](../tools/art-433-call-report-rcr-capital.md).

## Executor

Kernel source: `chaingraph/kernels/art-433-call-report-rcr-capital.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c62ba6456819dce8756770a395024a9508cf9685dd9d3ca1409ebe2d6e01546c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
