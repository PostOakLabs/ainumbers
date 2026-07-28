---
type: DecisionTool
title: "SII-IFRS 17 Reconciliation Bridger"
description: "Bridge Solvency II technical provisions (best estimate + risk margin) to IFRS 17 insurance contract liabilities (fulfilment cash flows + risk adjustment + CSM). Computes bridge_delta and flags when the relative gap exceeds 10% of SII provisions. Compares risk adjustment against SII risk margin using EIOPA research benchmarks (RA typically 33-44% lower than risk margin for life insurance, FSI Insights 26). Feeds insurance reporting readiness diagnostic (art-182). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-181-sii-ifrs17-reconciliation-bridger.html
tags: ["compliance_mandate", "wave-32", "mcp:reconcile_sii_ifrs17"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-181-sii-ifrs17-reconciliation-bridger.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-181-sii-ifrs17-reconciliation-bridger.html
    title: "public tool page"
---

# SII-IFRS 17 Reconciliation Bridger

> Exports a decision via MCP `reconcile_sii_ifrs17` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-181-sii-ifrs17-reconciliation-bridger.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Solvency II SCR Ratio Calculator](./art-180-solvency2-scr-ratio-calculator.md)

**Feeds:** [Insurance Reporting Readiness Diagnostic](./art-182-insurance-reporting-readiness-diagnostic.md)
