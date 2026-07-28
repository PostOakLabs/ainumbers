---
type: Attested Computation
title: "pacs.008 Party Completeness Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-242-pacs008-party-completeness-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-242-pacs008-party-completeness-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# pacs.008 Party Completeness Validator — attested computation

> §10.2 Attested Computation binding for [pacs.008 Party Completeness Validator](../tools/art-242-pacs008-party-completeness-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-242-pacs008-party-completeness-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a003fc6cc8dfa80d68668f62938102ca8f06da330407616dc9d04f146303706e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
