---
type: DecisionTool
title: "E-Invoice Jurisdiction Mandate Router"
description: "Deterministic lookup over a version-pinned mandate table: given supplier/buyer country, transaction type, and transaction date, routes to the applicable e-invoicing regime, format, phase status, and transmission channel. Covers France (PDP, B2B receive obligation live 2026-09-01), Germany (XRechnung), UAE (PINT-AE pilot), Malaysia (MyInvois), Belgium (Peppol BIS 3.0, mandatory since 2026-01-01), and Poland (KSeF FA(3), mandatory-use phase-in from 2026-02-01). Third node of the einvoice-validation-pipeline chain. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-295-einvoice-jurisdiction-mandate-router.html
tags: ["compliance_mandate", "wave-46", "mcp:route_einvoice_jurisdiction_mandate"]
timestamp: 2026-07-14
---

# E-Invoice Jurisdiction Mandate Router

> Exports a decision via MCP `route_einvoice_jurisdiction_mandate` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-295-einvoice-jurisdiction-mandate-router.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [E-Invoice VAT Calculation Verifier](./art-294-einvoice-vat-calc-verifier.md)

**Feeds:** [E-Invoice Transmission Receipt Builder](./art-296-einvoice-transmission-receipt-builder.md)
