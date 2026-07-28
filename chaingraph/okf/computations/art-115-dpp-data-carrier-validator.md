---
type: Attested Computation
title: "EU ESPR Digital Product Passport Data Carrier Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-115-dpp-data-carrier-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-115-dpp-data-carrier-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EU ESPR Digital Product Passport Data Carrier Validator — attested computation

> §10.2 Attested Computation binding for [EU ESPR Digital Product Passport Data Carrier Validator](../tools/art-115-dpp-data-carrier-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-115-dpp-data-carrier-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7d2f0c60cd204d6e7a54daef6611623df431e3924739025376b1277e3461c343` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
