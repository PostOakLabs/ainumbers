---
type: Attested Computation
title: "FSMA 204 Recall Trace Resolver (24-Hour FDA List) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-120-recall-trace-resolver.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-120-recall-trace-resolver.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FSMA 204 Recall Trace Resolver (24-Hour FDA List) — attested computation

> §10.2 Attested Computation binding for [FSMA 204 Recall Trace Resolver (24-Hour FDA List)](../tools/art-120-recall-trace-resolver.md).

## Executor

Kernel source: `chaingraph/kernels/art-120-recall-trace-resolver.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:572a3d1b5f06617e9230439c2f639209dc51f1969e4f7fa9709c23349334b9b2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
