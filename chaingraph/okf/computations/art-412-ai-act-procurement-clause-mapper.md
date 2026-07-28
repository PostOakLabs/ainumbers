---
type: Attested Computation
title: "AI Act Procurement Clause Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-412-ai-act-procurement-clause-mapper.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-412-ai-act-procurement-clause-mapper.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AI Act Procurement Clause Mapper — attested computation

> §10.2 Attested Computation binding for [AI Act Procurement Clause Mapper](../tools/art-412-ai-act-procurement-clause-mapper.md).

## Executor

Kernel source: `chaingraph/kernels/art-412-ai-act-procurement-clause-mapper.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:892f0f32b3889153f5a40251ad7cf96f85b3588942c675d4f91008061a33927a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
