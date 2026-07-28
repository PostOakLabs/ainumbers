---
type: Attested Computation
title: "226J Response Evidence Pack Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-300-aca-226j-response-evidence-pack.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-300-aca-226j-response-evidence-pack.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# 226J Response Evidence Pack Builder — attested computation

> §10.2 Attested Computation binding for [226J Response Evidence Pack Builder](../tools/art-300-aca-226j-response-evidence-pack.md).

## Executor

Kernel source: `chaingraph/kernels/art-300-aca-226j-response-evidence-pack.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4d4fb49f4aacbbbdeaa9aa38d119217e3cfd2e5234bb80c9fd6bb055afb5fcc9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
