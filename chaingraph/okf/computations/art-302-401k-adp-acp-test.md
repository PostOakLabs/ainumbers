---
type: Attested Computation
title: "401(k) ADP/ACP Nondiscrimination Tester — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-302-401k-adp-acp-test.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-302-401k-adp-acp-test.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# 401(k) ADP/ACP Nondiscrimination Tester — attested computation

> §10.2 Attested Computation binding for [401(k) ADP/ACP Nondiscrimination Tester](../tools/art-302-401k-adp-acp-test.md).

## Executor

Kernel source: `chaingraph/kernels/art-302-401k-adp-acp-test.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b5846a6b36327671eca8553c1a075d732ce6a236e0cf86fbd688c4ee4e52a6ad` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
