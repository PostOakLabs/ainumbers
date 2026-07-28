---
type: DecisionTool
title: "x402 v2 Wire-Format Migration Linter"
description: "Lints a supplied x402 header set / 402 response body against the Protocol Version 2 wire format: flags deprecated v1 headers (X-PAYMENT, X-PAYMENT-RESPONSE) and their v2 replacements (PAYMENT-SIGNATURE, PAYMENT-RESPONSE), flags v1 body-based PaymentRequirements delivery (v2 moves requirements into the PAYMENT-REQUIRED header as a client-selectable array), and checks the network id for CAIP-2 format. Declares protocol_version so a future wire bump is a data re-pin. Pinned to coinbase/x402 specs/x402-specification-v2.md (2025-12-09)."
resource: https://ainumbers.co/chaingraph/art-393-x402-v2-migration-linter.html
tags: ["compliance_control", "wave-66", "mcp:lint_x402_v2_migration"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-393-x402-v2-migration-linter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-393-x402-v2-migration-linter.html
    title: "public tool page"
---

# x402 v2 Wire-Format Migration Linter

> Exports a decision via MCP `lint_x402_v2_migration` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-393-x402-v2-migration-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [x402 Header Decoder, Payload Linter & 402 Flow Simulator](./art-26-x402-payload-decoder-flow-simulator.md)

**Feeds:** [x402 V2 Batch-Settlement Reconciler](./art-61-x402-batch-settlement-reconciler.md), [x402 Deferred-Scheme Handshake Validator](./art-394-x402-deferred-handshake-validator.md)

## Attested computation

[executor + attester binding](../computations/art-393-x402-v2-migration-linter.md) — §10.2.
