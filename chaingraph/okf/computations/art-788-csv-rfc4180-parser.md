---
type: Attested Computation
title: "RFC 4180 CSV Parser — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-788-csv-rfc4180-parser.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-788-csv-rfc4180-parser.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# RFC 4180 CSV Parser — attested computation

> §10.2 Attested Computation binding for [RFC 4180 CSV Parser](../tools/art-788-csv-rfc4180-parser.md).

## Executor

Kernel source: `chaingraph/kernels/art-788-csv-rfc4180-parser.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c34b449deffbcaba90e9e3d2df644f2bf51f90b1f9b31a00025de8ab6a836152` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
