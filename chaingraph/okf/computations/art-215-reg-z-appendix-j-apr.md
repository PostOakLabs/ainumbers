---
type: Attested Computation
title: "Reg Z Appendix J APR Solver — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-215-reg-z-appendix-j-apr.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-215-reg-z-appendix-j-apr.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Reg Z Appendix J APR Solver — attested computation

> §10.2 Attested Computation binding for [Reg Z Appendix J APR Solver](../tools/art-215-reg-z-appendix-j-apr.md).

## Executor

Kernel source: `chaingraph/kernels/art-215-reg-z-appendix-j-apr.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:429bfe0fa27879e429bbd5129f57243ebc99b4e6dc016f0ffebacd35acdd9219` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
