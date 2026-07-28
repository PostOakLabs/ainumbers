---
type: Attested Computation
title: "X12 837/835 Healthcare-Claim Records Lint — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-399-lint-x12-claim-records.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-399-lint-x12-claim-records.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# X12 837/835 Healthcare-Claim Records Lint — attested computation

> §10.2 Attested Computation binding for [X12 837/835 Healthcare-Claim Records Lint](../tools/art-399-lint-x12-claim-records.md).

## Executor

Kernel source: `chaingraph/kernels/art-399-lint-x12-claim-records.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b3acb2f4a9c067913ed0abcc7a47a783f033fbb08a6c467341233bae5def2a1f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
