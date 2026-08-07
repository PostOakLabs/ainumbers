---
type: DecisionTool
title: "Securitization Trustee-Report Waterfall Recomputation"
description: "Recomputes a securitization priority-of-payments waterfall for one stated distribution period from a caller-declared tier list and the period's own collections, then compares the recomputed distribution against what the monthly trustee report states was distributed. The tier list, its priority order, every cap and every trigger reference come from the deal's own indenture, which the caller pins in an indenture reference that is carried into the artifact, so a later amendment dates an old receipt rather than falsifying it. Trigger states are caller-declared booleans only: a tier naming a trigger is skipped exactly when the caller declares that trigger breached, and this tool computes no coverage ratio, delinquency rate, or other market figure to decide a trigger's state. The recomputed side of every comparison is derived here by allocating the period collections down the tier list, never lifted from the trustee report, so a divergence is a genuine arithmetic finding rather than a re-adding of a published column. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers both an empty tier list and a run where no trustee-reported distribution was supplied to compare against; neither case is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display, and zero collections, an empty tier list, and a tier naming a collection type that was not supplied each resolve to a defined result. Cites the OCC's Comptroller's Handbook on Asset Securitization as a mechanics reference only; the deal's own indenture governs, and this tool says so rather than asserting endorsement by any standard-setter. Stated boundary: a divergence against the trustee report is an arithmetic finding about the tier list and figures supplied here. It is never a compliance determination, never an audit opinion, and never a finding that the deal was administered correctly or incorrectly."
resource: https://ainumbers.co/chaingraph/art-568-securitization-trustee-report-recompute.html
tags: ["analytics_mandate", "wave-92", "mcp:recompute_trustee_report_waterfall"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-568-securitization-trustee-report-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-568-securitization-trustee-report-recompute.html
    title: "public tool page"
---

# Securitization Trustee-Report Waterfall Recomputation

> Exports a decision via MCP `recompute_trustee_report_waterfall` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-568-securitization-trustee-report-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-568-securitization-trustee-report-recompute.md) — §10.2.
