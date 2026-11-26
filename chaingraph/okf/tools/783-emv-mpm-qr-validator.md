---
type: DecisionTool
title: "EMV MPM QR Payload Validator"
description: "Decodes and validates an EMV merchant-presented-mode (MPM) QR payload against a pluggable national scheme profile - generic EMV MPM, Fiji FJQR, or Brazil Pix BR Code - covering TLV structure, duplicate and trailing-object detection, the CRC-16/CCITT-FALSE checksum over the payload including the literal 6304 (with a dedicated rule for the common generator bug that excludes it), point-of-initiation static versus dynamic semantics, merchant-account templates 26-51 and their globally unique identifiers, MCC, ISO 4217 currency, amount and tip/convenience consistency, merchant name and city presence and length, additional-data subfield structure, and for Pix dynamic payloads the location-URL shape and the JWS protected-header skeleton (alg allowed set, kid, jku) without any signature verification. Zero network and zero PII echo: merchant name, city, postal, additional-data values and account identifiers are reported as tag/length/verdict only, never echoed; a dynamic payload URL is never fetched. Exclusions: no signature or key verification, no QR image decoding (payload string only), no scheme-operator endorsement implied; the FJQR profile cannot verify scheme-specific account GUIDs because the FJQR technical specification's GUI registry is not public (advisory only)."
resource: https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.html
tags: ["compliance_control", "wave-139", "mcp:validate_emv_mpm_qr_payload"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/783-emv-mpm-qr-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.html
    title: "public tool page"
---

# EMV MPM QR Payload Validator

> Exports a decision via MCP `validate_emv_mpm_qr_payload` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/783-emv-mpm-qr-validator.md) — §10.2.
