---
type: DecisionTool
title: "GloBE Article 9.1 Transition Deferred Tax Tracker"
description: "Recomputes the OECD GloBE Article 9.1 transition recast for a jurisdiction, item by item, over a bounded array of caller-declared deferred tax attributes, and reports the jurisdictional roll-forward total. Article 9.1.1 takes attributes into account at the lower of the Minimum Rate or the applicable domestic tax rate. That lower-of rule operates as a cap rather than an upward re-measurement, so an attribute already recorded at or below it is left where it is; the guidance worked example states the same outcome from the other side, and reading it as an unconditional re-measurement would leave Article 9.1.1's third sentence nothing to do. That third sentence is the single path on which a recast rises above the recorded figure: a deferred tax asset recorded below the Minimum Rate may be taken at the Minimum Rate where the taxpayer demonstrates it is attributable to a GloBE Loss, so the node treats the demonstration as a caller declaration and falls back to the general cap when it is absent. The impact of a valuation or accounting recognition adjustment is disregarded, which requires the gross figure from the caller. Article 9.1.2 exclusions apply only where a declared limb holds and, on the date keyed limbs, the attribute arose strictly after the cut off, so an attribute arising on the cut off day itself is not excluded; each exclusion is reported with a named code and contributes exactly zero, never merely dropped from the report. Article 9.1.3 recasts an intra group transfer falling after the cut off and before the Transition Year on the disposing entity's carrying value. The Minimum Rate, the cut off date, the Transition Year start and the enabled exclusion set all arrive as versioned policy parameters, so a guidance change is a parameter version bump and never moves the kernel digest. The item array is bounded by a declared kernel constant and an over length input is a named error rather than a longer loop. Items are reported and summed in a declared total order keyed on arising date, attribute type, carrying amount and input index, so the total never depends on the order the caller supplied, and it equals the sum of the reported per item recasts at the declared precision. Verify only: this node does not characterize an attribute, does not decide whether an arrangement is governmental, does not decide whether a GloBE Loss demonstration succeeds, and does not compute the Grace Period or Grace Period Limitation, which govern deferred tax expense on reversal under a separate computation. Where a characterization is absent, or a recast cannot be justified from a declared parameter, the item carries a manual review flag or a named error code instead of a silently computed number."
resource: https://ainumbers.co/chaingraph/art-636-globe-transition-deferred-tax-tracker.html
tags: ["compliance_mandate", "wave-103", "mcp:track_globe_transition_deferred_tax"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-636-globe-transition-deferred-tax-tracker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-636-globe-transition-deferred-tax-tracker.html
    title: "public tool page"
---

# GloBE Article 9.1 Transition Deferred Tax Tracker

> Exports a decision via MCP `track_globe_transition_deferred_tax` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-636-globe-transition-deferred-tax-tracker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-636-globe-transition-deferred-tax-tracker.md) — §10.2.
