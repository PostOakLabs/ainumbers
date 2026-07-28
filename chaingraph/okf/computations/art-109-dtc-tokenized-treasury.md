---
type: Attested Computation
title: "DTC-Custodied Tokenized U.S. Treasury Issuance & DvP — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-109-dtc-tokenized-treasury.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-109-dtc-tokenized-treasury.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DTC-Custodied Tokenized U.S. Treasury Issuance & DvP — attested computation

> §10.2 Attested Computation binding for [DTC-Custodied Tokenized U.S. Treasury Issuance & DvP](../tools/art-109-dtc-tokenized-treasury.md).

## Executor

Kernel source: `chaingraph/kernels/art-109-dtc-tokenized-treasury.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1064b510a277f498468a1e9a05d051d01137cda668f04abae974c0db753376fc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
