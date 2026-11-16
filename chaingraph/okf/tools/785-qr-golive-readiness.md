---
type: DecisionTool
title: "QR Go-Live Readiness Assessor"
description: "Assesses a QR payment scheme's pilot, production, or cross-border go-live readiness through weighted blocking and advisory gates: participant certification, UAT completion, configuration sign-off, operating procedures, incident and support cover, communications, and cross-border link agreements, plus a Level One principles checklist (advisory only, separate from the verdict). Any blocking gate not met is NO_GO; a uat_summary with an open severity-1 defect or passed below mandatory_cases fails the UAT gate; otherwise the weighted basis-point score sets GO at or above 9750 or GO_WITH_CONDITIONS with the unmet advisory gates listed as conditions. Weight overrides must stay within 0 to 5000 bp and sum to 10000 bp across applicable gates, and are refused otherwise. Synthetic inputs only; the node names no real participant or scheme operator's readiness state and is a decision-support draft, not a supervisory assessment."
resource: https://ainumbers.co/chaingraph/785-qr-golive-readiness.html
tags: ["compliance_control", "wave-139", "mcp:assess_qr_golive_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/785-qr-golive-readiness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/785-qr-golive-readiness.html
    title: "public tool page"
---

# QR Go-Live Readiness Assessor

> Exports a decision via MCP `assess_qr_golive_readiness` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/785-qr-golive-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/785-qr-golive-readiness.md) — §10.2.
