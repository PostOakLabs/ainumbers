---
type: DecisionTool
title: "Rate Reconciliation 5% Threshold Classifier"
description: "Applies the quantitative 5 percent threshold of ASC 740-10-50-12A(b), as amended by FASB Accounting Standards Update No. 2023-09, to one candidate rate reconciliation item. Takes the signed effect of the item, continuing operations pretax income, the applicable statutory federal or national rate of the domicile jurisdiction, the reconciling item category and whether the filer is a public business entity; returns the item as a percentage of the threshold base, a crossing flag, the separate disclosure consequence, and the disaggregation 740-10-50-12A(b) requires of that category. The comparison is taken in absolute amount on BOTH sides, which is stated at BC35 of the Update and corroborated by 740-10-50-12A(b)(2) requiring separate disclosure where an item's gross amount, positive or negative, meets the threshold. That is what makes the test well defined for a loss making entity, so a negative pretax income is ordinary here rather than degenerate. The category enum has nine members, not eight: 740-10-50-12A(a) closes a list of eight, and 740-10-50-12A(b)(3) separately addresses an item within none of them, which an eight member enum could not express. The arithmetic fact and the legal consequence are separate fields because 740-10-50-12A applies to a public business entity while 740-10-50-13 gives other entities a qualitative requirement and no numerical reconciliation. rounding_steps is none before comparison: every verdict is decided by exact cross multiplication on unrounded inputs, never by rounding a percentage and then comparing, and the reported percentage is computed after the verdict and never feeds it. A zero threshold base is reported as not assessable with a named caveat rather than divided silently, because BC38 records that the Board considered and declined to give guidance for the break even and no or minimal rate cases; for the same reason this node draws no numeric break even band. Zero network calls: it does not compute the rate reconciliation, does not determine the statutory rate, does not decide an item's category, does not choose the level of aggregation at which the threshold is applied, and does not apply the separate income taxes paid test of ASC 740-10-50-23."
resource: https://ainumbers.co/chaingraph/art-635-rate-rec-5pct-threshold-classifier.html
tags: ["compliance_mandate", "wave-99", "mcp:classify_rate_rec_5pct_threshold"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-635-rate-rec-5pct-threshold-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-635-rate-rec-5pct-threshold-classifier.html
    title: "public tool page"
---

# Rate Reconciliation 5% Threshold Classifier

> Exports a decision via MCP `classify_rate_rec_5pct_threshold` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-635-rate-rec-5pct-threshold-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-635-rate-rec-5pct-threshold-classifier.md) — §10.2.
