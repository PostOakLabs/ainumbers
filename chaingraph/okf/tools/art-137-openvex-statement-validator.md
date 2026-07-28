---
type: DecisionTool
title: "OpenVEX Statement Validator"
description: "Validates an OpenVEX document: @context includes openvex.dev, every statement carries vulnerability, products[], status in [not_affected,affected,fixed,under_investigation], and not_affected statements must include justification. Emits vex_valid verdict and per-statement gap list. Terminal stage of sbom-provenance-attestation chain."
resource: https://ainumbers.co/chaingraph/art-137-openvex-statement-validator.html
tags: ["compliance_mandate", "wave-25", "mcp:validate_openvex_statement"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-137-openvex-statement-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-137-openvex-statement-validator.html
    title: "public tool page"
---

# OpenVEX Statement Validator

> Exports a decision via MCP `validate_openvex_statement` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-137-openvex-statement-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [SLSA Provenance Verifier](./art-136-slsa-provenance-verifier.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-137-openvex-statement-validator.md) — §10.2.
