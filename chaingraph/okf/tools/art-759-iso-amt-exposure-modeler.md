---
type: DecisionTool
title: "ISO AMT Exposure Modeler"
description: "AMT liability from an ISO exercise spread using the 2026 exemption amounts and phase-out thresholds, ported from ApexLogics Apex #109 (AL-116). For shares, strike price, FMV at exercise, ordinary income, other AMT preference items and a single/mfj filing status, the node computes the ISO spread (an AMT preference under IRC sec. 56(b)(3)), AMTI, the phased-out exemption (90100/140200 reduced by 50 percent above 500000/1000000 per IRC sec. 55(d)(4)(A)(ii), which overrides sec. 55(d)(2)'s 25 percent base rate for tax years beginning after Dec. 31, 2025), tentative minimum tax at 26/28 percent split at the 244500 breakpoint, the regular-tax comparison over the 2026 Rev. Proc. 2025-32 brackets, the AMT owed as the excess of TMT over regular tax, the credit generated, the maximum shares exercisable without triggering AMT (fixed 60-iteration binary search over 0..shares x 10) and a 5-step exercise-quantity scenario ladder. Unknown filing_status or a non-finite input is refused with a named code, never a silent guess. Apex folds MFS into its single option and models the credit as the full AMT owed; both are Apex-value-kept report items (payload DIFFERS.md D2, D6), flagged in the kernel, never silently diverged."
resource: https://ainumbers.co/chaingraph/art-759-iso-amt-exposure-modeler.html
tags: ["consumer_finance", "wave-134", "mcp:estimate_iso_amt_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-759-iso-amt-exposure-modeler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-759-iso-amt-exposure-modeler.html
    title: "public tool page"
---

# ISO AMT Exposure Modeler

> Exports a decision via MCP `estimate_iso_amt_exposure` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-759-iso-amt-exposure-modeler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-759-iso-amt-exposure-modeler.md) — §10.2.
